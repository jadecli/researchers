using System.Text;
using AngleSharp;
using AngleSharp.Dom;
using AngleSharp.Html.Parser;

namespace Researchers.Extractors;

/// <summary>
/// Extracts structured content from HTML using AngleSharp.
/// </summary>
public class HtmlExtractor
{
    private static readonly string[] NavSelectors =
    {
        "nav", "header", "footer",
        "[role=navigation]", ".nav", ".sidebar", ".menu", ".breadcrumb"
    };

    private static readonly string[] ContentSelectors =
    {
        "main", "article", "[role=main]", "#content", "#main-content",
        ".content", ".main-content", ".post-content", ".markdown-body", ".docs-content"
    };

    /// <summary>
    /// Extract structured content from HTML.
    /// </summary>
    public async Task<ExtractionResult> ExtractAsync(string html)
    {
        var config = Configuration.Default;
        var context = BrowsingContext.New(config);
        var parser = context.GetService<IHtmlParser>()!;
        var document = parser.ParseDocument(html);

        // Remove non-content elements
        RemoveElements(document, "script, style, noscript, iframe, svg");
        foreach (var selector in NavSelectors)
        {
            RemoveElements(document, selector);
        }

        var mainContent = FindMainContent(document);
        var title = ExtractTitle(document);
        var markdown = ConvertToMarkdown(mainContent);
        var headings = ExtractHeadings(mainContent);
        var codeBlocks = ExtractCodeBlocks(mainContent);
        var links = ExtractLinks(mainContent);

        return new ExtractionResult
        {
            Title = title,
            Content = markdown,
            Headings = headings,
            CodeBlocks = codeBlocks,
            Links = links
        };
    }

    private static void RemoveElements(IDocument document, string selector)
    {
        var elements = document.QuerySelectorAll(selector);
        foreach (var el in elements)
        {
            el.Remove();
        }
    }

    private static string ExtractTitle(IDocument document)
    {
        var ogTitle = document.QuerySelector("meta[property='og:title']");
        if (ogTitle != null)
        {
            var content = ogTitle.GetAttribute("content");
            if (!string.IsNullOrWhiteSpace(content)) return content.Trim();
        }

        var titleEl = document.QuerySelector("title");
        if (titleEl != null)
        {
            var text = titleEl.TextContent.Trim();
            if (!string.IsNullOrEmpty(text)) return text;
        }

        var h1 = document.QuerySelector("h1");
        return h1?.TextContent.Trim() ?? "";
    }

    private static IElement FindMainContent(IDocument document)
    {
        foreach (var selector in ContentSelectors)
        {
            var el = document.QuerySelector(selector);
            if (el != null && el.TextContent.Trim().Length > 100)
            {
                return el;
            }
        }

        return document.Body ?? document.DocumentElement;
    }

    private static string ConvertToMarkdown(IElement element)
    {
        var sb = new StringBuilder();

        foreach (var child in element.QuerySelectorAll("h1, h2, h3, h4, h5, h6, p, pre, li, blockquote"))
        {
            var tagName = child.LocalName.ToLowerInvariant();

            switch (tagName)
            {
                case "h1": sb.AppendLine().AppendLine().Append("# ").AppendLine(child.TextContent.Trim()).AppendLine(); break;
                case "h2": sb.AppendLine().AppendLine().Append("## ").AppendLine(child.TextContent.Trim()).AppendLine(); break;
                case "h3": sb.AppendLine().AppendLine().Append("### ").AppendLine(child.TextContent.Trim()).AppendLine(); break;
                case "h4": sb.AppendLine().AppendLine().Append("#### ").AppendLine(child.TextContent.Trim()).AppendLine(); break;
                case "h5": sb.AppendLine().AppendLine().Append("##### ").AppendLine(child.TextContent.Trim()).AppendLine(); break;
                case "h6": sb.AppendLine().AppendLine().Append("###### ").AppendLine(child.TextContent.Trim()).AppendLine(); break;
                case "p":
                    var text = child.TextContent.Trim();
                    if (!string.IsNullOrEmpty(text))
                    {
                        sb.AppendLine().AppendLine(text).AppendLine();
                    }
                    break;
                case "pre":
                    var lang = GetCodeLanguage(child);
                    sb.AppendLine().Append("```").AppendLine(lang);
                    sb.AppendLine(child.TextContent);
                    sb.AppendLine("```").AppendLine();
                    break;
                case "li":
                    sb.Append("- ").AppendLine(child.TextContent.Trim());
                    break;
                case "blockquote":
                    foreach (var line in child.TextContent.Trim().Split('\n'))
                    {
                        sb.Append("> ").AppendLine(line);
                    }
                    sb.AppendLine();
                    break;
            }
        }

        return sb.ToString().Trim();
    }

    private static List<HeadingInfo> ExtractHeadings(IElement element)
    {
        var headings = new List<HeadingInfo>();

        foreach (var h in element.QuerySelectorAll("h1, h2, h3, h4, h5, h6"))
        {
            headings.Add(new HeadingInfo
            {
                Level = int.Parse(h.LocalName[1..]),
                Text = h.TextContent.Trim(),
                Id = h.Id ?? ""
            });
        }

        return headings;
    }

    private static List<CodeBlockInfo> ExtractCodeBlocks(IElement element)
    {
        var blocks = new List<CodeBlockInfo>();

        foreach (var pre in element.QuerySelectorAll("pre"))
        {
            blocks.Add(new CodeBlockInfo
            {
                Language = GetCodeLanguage(pre),
                Content = pre.TextContent,
                LineCount = pre.TextContent.Split('\n').Length
            });
        }

        return blocks;
    }

    private static List<LinkInfo> ExtractLinks(IElement element)
    {
        var links = new List<LinkInfo>();

        foreach (var a in element.QuerySelectorAll("a[href]"))
        {
            var href = a.GetAttribute("href") ?? "";
            if (href.StartsWith('#') || href.StartsWith("javascript:")) continue;

            links.Add(new LinkInfo
            {
                Text = a.TextContent.Trim(),
                Href = href,
                IsInternal = href.StartsWith('/') || href.StartsWith("./") || href.StartsWith("../")
            });
        }

        return links;
    }

    private static string GetCodeLanguage(IElement preElement)
    {
        var code = preElement.QuerySelector("code");
        if (code != null)
        {
            foreach (var cls in code.ClassList)
            {
                if (cls.StartsWith("language-")) return cls[9..];
                if (cls.StartsWith("lang-")) return cls[5..];
                if (cls.StartsWith("highlight-")) return cls[10..];
            }

            var dataLang = code.GetAttribute("data-lang");
            if (!string.IsNullOrEmpty(dataLang)) return dataLang;

            var dataLanguage = code.GetAttribute("data-language");
            if (!string.IsNullOrEmpty(dataLanguage)) return dataLanguage;
        }

        return "";
    }
}

public class ExtractionResult
{
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public List<HeadingInfo> Headings { get; set; } = new();
    public List<CodeBlockInfo> CodeBlocks { get; set; } = new();
    public List<LinkInfo> Links { get; set; } = new();
}

public class HeadingInfo
{
    public int Level { get; set; }
    public string Text { get; set; } = "";
    public string Id { get; set; } = "";
}

public class CodeBlockInfo
{
    public string Language { get; set; } = "";
    public string Content { get; set; } = "";
    public int LineCount { get; set; }
}

public class LinkInfo
{
    public string Text { get; set; } = "";
    public string Href { get; set; } = "";
    public bool IsInternal { get; set; }
}
