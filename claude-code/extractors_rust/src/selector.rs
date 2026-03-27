//! CSS selector matching for HTML documents.

use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

/// Represents an HTML element matched by a CSS selector.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Element {
    pub tag: String,
    pub text: String,
    pub html: String,
    pub attributes: Vec<(String, String)>,
}

/// CSS selector wrapper for matching elements in HTML.
pub struct CSSSelector {
    selector_str: String,
}

impl CSSSelector {
    /// Create a new CSSSelector from a selector string.
    pub fn new(selector: &str) -> Self {
        CSSSelector {
            selector_str: selector.to_string(),
        }
    }

    /// Match elements in HTML using the CSS selector.
    /// Returns a vector of matched Element structs.
    pub fn match_elements(&self, html: &str) -> Vec<Element> {
        let document = Html::parse_document(html);

        let selector = match Selector::parse(&self.selector_str) {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };

        document
            .select(&selector)
            .map(|el| {
                let tag = el.value().name().to_string();
                let text = el.text().collect::<Vec<_>>().join(" ");
                let inner_html = el.inner_html();
                let attributes = el
                    .value()
                    .attrs()
                    .map(|(k, v)| (k.to_string(), v.to_string()))
                    .collect();

                Element {
                    tag,
                    text: text.trim().to_string(),
                    html: inner_html,
                    attributes,
                }
            })
            .collect()
    }

    /// Check if the selector matches any elements in the HTML.
    pub fn matches(&self, html: &str) -> bool {
        !self.match_elements(html).is_empty()
    }

    /// Count the number of elements matching the selector.
    pub fn count(&self, html: &str) -> usize {
        let document = Html::parse_document(html);
        match Selector::parse(&self.selector_str) {
            Ok(s) => document.select(&s).count(),
            Err(_) => 0,
        }
    }

    /// Get the text content of the first matching element.
    pub fn first_text(&self, html: &str) -> Option<String> {
        self.match_elements(html)
            .into_iter()
            .next()
            .map(|el| el.text)
    }
}

/// Convenience function to match elements using a CSS selector string.
pub fn match_elements(html: &str, selector: &str) -> Vec<Element> {
    CSSSelector::new(selector).match_elements(html)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_elements_basic() {
        let html = r#"
            <html>
            <body>
                <h1>Title</h1>
                <p class="intro">Hello world</p>
                <p>Second paragraph</p>
            </body>
            </html>
        "#;

        let elements = match_elements(html, "p");
        assert_eq!(elements.len(), 2);
        assert_eq!(elements[0].text, "Hello world");
        assert_eq!(elements[0].tag, "p");
    }

    #[test]
    fn test_match_class_selector() {
        let html = r#"<div class="content"><p>Inside</p></div><div class="sidebar">Side</div>"#;
        let elements = match_elements(html, ".content p");
        assert_eq!(elements.len(), 1);
        assert_eq!(elements[0].text, "Inside");
    }

    #[test]
    fn test_invalid_selector() {
        let elements = match_elements("<p>test</p>", "[[[invalid");
        assert!(elements.is_empty());
    }

    #[test]
    fn test_css_selector_matches() {
        let sel = CSSSelector::new("h1");
        assert!(sel.matches("<h1>Title</h1>"));
        assert!(!sel.matches("<p>No heading</p>"));
    }

    #[test]
    fn test_css_selector_count() {
        let html = "<ul><li>A</li><li>B</li><li>C</li></ul>";
        let sel = CSSSelector::new("li");
        assert_eq!(sel.count(html), 3);
    }

    #[test]
    fn test_first_text() {
        let html = "<h1>First</h1><h1>Second</h1>";
        let sel = CSSSelector::new("h1");
        assert_eq!(sel.first_text(html), Some("First".to_string()));
    }
}
