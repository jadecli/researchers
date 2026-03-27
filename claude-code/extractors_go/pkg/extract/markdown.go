// Package extract provides HTML to markdown conversion.
package extract

import (
	"fmt"
	"regexp"
	"strings"

	"golang.org/x/net/html"
)

// HtmlToMarkdown converts an HTML string to markdown format.
func HtmlToMarkdown(htmlContent string) string {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return htmlContent
	}

	var b strings.Builder
	convertNode(&b, doc, 0)

	result := b.String()
	result = cleanMarkdown(result)
	return strings.TrimSpace(result)
}

func convertNode(b *strings.Builder, n *html.Node, depth int) {
	switch n.Type {
	case html.TextNode:
		text := n.Data
		if strings.TrimSpace(text) != "" {
			b.WriteString(text)
		}
	case html.ElementNode:
		convertElement(b, n, depth)
	case html.DocumentNode:
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			convertNode(b, c, depth)
		}
	}
}

func convertElement(b *strings.Builder, n *html.Node, depth int) {
	tag := strings.ToLower(n.Data)

	// Skip non-content elements
	switch tag {
	case "script", "style", "noscript", "iframe", "svg", "nav", "header", "footer":
		return
	}

	switch tag {
	case "h1":
		b.WriteString("\n\n# ")
		writeChildren(b, n, depth)
		b.WriteString("\n\n")
	case "h2":
		b.WriteString("\n\n## ")
		writeChildren(b, n, depth)
		b.WriteString("\n\n")
	case "h3":
		b.WriteString("\n\n### ")
		writeChildren(b, n, depth)
		b.WriteString("\n\n")
	case "h4":
		b.WriteString("\n\n#### ")
		writeChildren(b, n, depth)
		b.WriteString("\n\n")
	case "h5":
		b.WriteString("\n\n##### ")
		writeChildren(b, n, depth)
		b.WriteString("\n\n")
	case "h6":
		b.WriteString("\n\n###### ")
		writeChildren(b, n, depth)
		b.WriteString("\n\n")
	case "p":
		b.WriteString("\n\n")
		writeChildren(b, n, depth)
		b.WriteString("\n\n")
	case "br":
		b.WriteString("\n")
	case "hr":
		b.WriteString("\n\n---\n\n")
	case "strong", "b":
		b.WriteString("**")
		writeChildren(b, n, depth)
		b.WriteString("**")
	case "em", "i":
		b.WriteString("*")
		writeChildren(b, n, depth)
		b.WriteString("*")
	case "code":
		if parentTag(n) != "pre" {
			b.WriteString("`")
			writeChildren(b, n, depth)
			b.WriteString("`")
		} else {
			writeChildren(b, n, depth)
		}
	case "pre":
		lang := getCodeLanguage(n)
		b.WriteString(fmt.Sprintf("\n\n```%s\n", lang))
		writeChildren(b, n, depth)
		b.WriteString("\n```\n\n")
	case "a":
		href := getAttr(n, "href")
		b.WriteString("[")
		writeChildren(b, n, depth)
		b.WriteString(fmt.Sprintf("](%s)", href))
	case "img":
		alt := getAttr(n, "alt")
		src := getAttr(n, "src")
		b.WriteString(fmt.Sprintf("![%s](%s)", alt, src))
	case "ul", "ol":
		b.WriteString("\n")
		writeListItems(b, n, depth, tag == "ol")
		b.WriteString("\n")
	case "li":
		// Handled by writeListItems
		writeChildren(b, n, depth)
	case "blockquote":
		b.WriteString("\n\n")
		var inner strings.Builder
		writeChildren(&inner, n, depth)
		for _, line := range strings.Split(inner.String(), "\n") {
			b.WriteString("> " + line + "\n")
		}
		b.WriteString("\n")
	case "table":
		b.WriteString("\n\n")
		writeTable(b, n)
		b.WriteString("\n\n")
	default:
		writeChildren(b, n, depth)
	}
}

func writeChildren(b *strings.Builder, n *html.Node, depth int) {
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		convertNode(b, c, depth+1)
	}
}

func writeListItems(b *strings.Builder, n *html.Node, depth int, ordered bool) {
	idx := 1
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.ElementNode && strings.ToLower(c.Data) == "li" {
			indent := strings.Repeat("  ", depth)
			if ordered {
				b.WriteString(fmt.Sprintf("%s%d. ", indent, idx))
				idx++
			} else {
				b.WriteString(fmt.Sprintf("%s- ", indent))
			}
			writeChildren(b, c, depth+1)
			b.WriteString("\n")
		}
	}
}

func writeTable(b *strings.Builder, n *html.Node) {
	var rows [][]string

	var walkTable func(*html.Node)
	walkTable = func(node *html.Node) {
		if node.Type == html.ElementNode && strings.ToLower(node.Data) == "tr" {
			var cells []string
			for c := node.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.ElementNode && (strings.ToLower(c.Data) == "td" || strings.ToLower(c.Data) == "th") {
					var cellBuf strings.Builder
					writeChildren(&cellBuf, c, 0)
					text := strings.TrimSpace(cellBuf.String())
					text = strings.ReplaceAll(text, "|", "\\|")
					cells = append(cells, text)
				}
			}
			if len(cells) > 0 {
				rows = append(rows, cells)
			}
			return
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			walkTable(c)
		}
	}
	walkTable(n)

	if len(rows) == 0 {
		return
	}

	maxCols := 0
	for _, row := range rows {
		if len(row) > maxCols {
			maxCols = len(row)
		}
	}

	for i := range rows {
		for len(rows[i]) < maxCols {
			rows[i] = append(rows[i], "")
		}
	}

	b.WriteString("| " + strings.Join(rows[0], " | ") + " |\n")
	separators := make([]string, maxCols)
	for i := range separators {
		separators[i] = "---"
	}
	b.WriteString("| " + strings.Join(separators, " | ") + " |\n")

	for _, row := range rows[1:] {
		b.WriteString("| " + strings.Join(row, " | ") + " |\n")
	}
}

func getAttr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if strings.ToLower(a.Key) == key {
			return a.Val
		}
	}
	return ""
}

func getCodeLanguage(preNode *html.Node) string {
	// Check for <code> child with language class
	for c := preNode.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == html.ElementNode && strings.ToLower(c.Data) == "code" {
			cls := getAttr(c, "class")
			for _, part := range strings.Fields(cls) {
				for _, prefix := range []string{"language-", "lang-", "highlight-"} {
					if strings.HasPrefix(part, prefix) {
						return strings.TrimPrefix(part, prefix)
					}
				}
			}
			lang := getAttr(c, "data-lang")
			if lang == "" {
				lang = getAttr(c, "data-language")
			}
			if lang != "" {
				return lang
			}
		}
	}
	return ""
}

func parentTag(n *html.Node) string {
	if n.Parent != nil && n.Parent.Type == html.ElementNode {
		return strings.ToLower(n.Parent.Data)
	}
	return ""
}

func cleanMarkdown(md string) string {
	// Remove excessive blank lines
	re := regexp.MustCompile(`\n{4,}`)
	md = re.ReplaceAllString(md, "\n\n\n")

	// Trim trailing whitespace from lines
	lines := strings.Split(md, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimRight(line, " \t")
	}
	return strings.Join(lines, "\n")
}
