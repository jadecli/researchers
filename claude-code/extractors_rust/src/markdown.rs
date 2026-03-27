//! HTML to Markdown conversion using the scraper crate.

use scraper::{Html, Node};

/// Convert HTML content to Markdown format.
pub fn html_to_markdown(html: &str) -> String {
    let document = Html::parse_document(html);
    let mut output = String::new();

    convert_node(&document, document.root_element().id(), &mut output);

    clean_markdown(&output)
}

fn convert_node(doc: &Html, node_id: ego_tree::NodeId, output: &mut String) {
    let node = doc.tree.get(node_id).unwrap();

    match node.value() {
        Node::Text(text) => {
            let t = text.trim();
            if !t.is_empty() {
                output.push_str(t);
            }
        }
        Node::Element(el) => {
            let tag = el.name().to_lowercase();

            // Skip non-content elements
            match tag.as_str() {
                "script" | "style" | "noscript" | "iframe" | "svg" | "nav" | "header"
                | "footer" => return,
                _ => {}
            }

            let (prefix, suffix) = get_tag_wrapper(&tag, el);

            output.push_str(&prefix);

            for child in node.children() {
                convert_node(doc, child.id(), output);
            }

            output.push_str(&suffix);
        }
        Node::Document => {
            for child in node.children() {
                convert_node(doc, child.id(), output);
            }
        }
        _ => {}
    }
}

fn get_tag_wrapper(tag: &str, el: &scraper::node::Element) -> (String, String) {
    match tag {
        "h1" => ("\n\n# ".to_string(), "\n\n".to_string()),
        "h2" => ("\n\n## ".to_string(), "\n\n".to_string()),
        "h3" => ("\n\n### ".to_string(), "\n\n".to_string()),
        "h4" => ("\n\n#### ".to_string(), "\n\n".to_string()),
        "h5" => ("\n\n##### ".to_string(), "\n\n".to_string()),
        "h6" => ("\n\n###### ".to_string(), "\n\n".to_string()),
        "p" => ("\n\n".to_string(), "\n\n".to_string()),
        "br" => ("\n".to_string(), String::new()),
        "hr" => ("\n\n---\n\n".to_string(), String::new()),
        "strong" | "b" => ("**".to_string(), "**".to_string()),
        "em" | "i" => ("*".to_string(), "*".to_string()),
        "code" => {
            // Check if parent is <pre>
            // For simplicity, use backtick
            ("`".to_string(), "`".to_string())
        }
        "pre" => {
            let lang = get_code_language(el);
            (format!("\n\n```{}\n", lang), "\n```\n\n".to_string())
        }
        "a" => {
            let href = el.attr("href").unwrap_or("");
            ("[".to_string(), format!("]({})", href))
        }
        "img" => {
            let alt = el.attr("alt").unwrap_or("");
            let src = el.attr("src").unwrap_or("");
            (format!("![{}]({})", alt, src), String::new())
        }
        "li" => ("\n- ".to_string(), String::new()),
        "blockquote" => ("\n\n> ".to_string(), "\n\n".to_string()),
        "ul" | "ol" => ("\n".to_string(), "\n".to_string()),
        _ => (String::new(), String::new()),
    }
}

fn get_code_language(el: &scraper::node::Element) -> String {
    // Check class attribute for language hints
    if let Some(class) = el.attr("class") {
        for cls in class.split_whitespace() {
            for prefix in &["language-", "lang-", "highlight-"] {
                if let Some(lang) = cls.strip_prefix(prefix) {
                    return lang.to_string();
                }
            }
        }
    }

    if let Some(lang) = el.attr("data-lang") {
        return lang.to_string();
    }
    if let Some(lang) = el.attr("data-language") {
        return lang.to_string();
    }

    String::new()
}

fn clean_markdown(md: &str) -> String {
    let mut result = md.to_string();

    // Remove excessive blank lines
    while result.contains("\n\n\n\n") {
        result = result.replace("\n\n\n\n", "\n\n\n");
    }

    // Trim trailing whitespace from each line
    result = result
        .lines()
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\n");

    result.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_conversion() {
        let html = "<h1>Title</h1><p>Paragraph text here.</p>";
        let md = html_to_markdown(html);
        assert!(md.contains("# Title"));
        assert!(md.contains("Paragraph text here."));
    }

    #[test]
    fn test_code_block() {
        let html = r#"<pre><code class="language-python">def hello():
    pass</code></pre>"#;
        let md = html_to_markdown(html);
        assert!(md.contains("```python"));
        assert!(md.contains("def hello()"));
        assert!(md.contains("```"));
    }

    #[test]
    fn test_links() {
        let html = r#"<a href="https://example.com">Example</a>"#;
        let md = html_to_markdown(html);
        assert!(md.contains("[Example](https://example.com)"));
    }

    #[test]
    fn test_formatting() {
        let html = "<p><strong>bold</strong> and <em>italic</em></p>";
        let md = html_to_markdown(html);
        assert!(md.contains("**bold**"));
        assert!(md.contains("*italic*"));
    }

    #[test]
    fn test_strips_nav() {
        let html = "<nav>Navigation</nav><main><p>Content</p></main>";
        let md = html_to_markdown(html);
        assert!(!md.contains("Navigation"));
        assert!(md.contains("Content"));
    }
}
