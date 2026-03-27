use extractors_rust::markdown::html_to_markdown;
use extractors_rust::quality::score_extraction;
use extractors_rust::selector::{match_elements, CSSSelector};

#[test]
fn test_full_page_extraction() {
    let html = r#"
        <html>
        <head><title>Test Page</title></head>
        <body>
            <nav><a href="/">Home</a></nav>
            <main>
                <h1>Documentation Title</h1>
                <p>This is an introductory paragraph about the topic.</p>
                <h2>Getting Started</h2>
                <p>Follow these steps to begin:</p>
                <pre><code class="language-python">import library
library.init()</code></pre>
                <h2>Features</h2>
                <ul>
                    <li>Feature A</li>
                    <li>Feature B</li>
                    <li>Feature C</li>
                </ul>
                <p>For more info, see <a href="/docs/advanced">advanced docs</a>.</p>
            </main>
            <footer><p>Copyright 2024</p></footer>
        </body>
        </html>
    "#;

    let markdown = html_to_markdown(html);

    // Should contain headings
    assert!(markdown.contains("# Documentation Title"), "Missing h1: {}", markdown);
    assert!(markdown.contains("## Getting Started"), "Missing h2");

    // Should contain code
    assert!(markdown.contains("```python"), "Missing code block language");
    assert!(markdown.contains("import library"), "Missing code content");

    // Should contain list items
    assert!(markdown.contains("- Feature A"), "Missing list item");

    // Should contain link
    assert!(markdown.contains("[advanced docs](/docs/advanced)"), "Missing link");

    // Should NOT contain nav/footer
    assert!(!markdown.contains("Home"), "Nav should be stripped");
    assert!(!markdown.contains("Copyright"), "Footer should be stripped");
}

#[test]
fn test_quality_of_full_extraction() {
    let html = r#"
        <html><body>
        <h1>API Reference</h1>
        <p>Complete API documentation for the service.</p>
        <h2>Authentication</h2>
        <p>Use API keys to authenticate requests.</p>
        <pre><code class="language-bash">curl -H "Authorization: Bearer KEY" https://api.example.com/v1</code></pre>
        <h2>Endpoints</h2>
        <ul>
            <li>GET /v1/users - List users</li>
            <li>POST /v1/users - Create user</li>
            <li>GET /v1/users/:id - Get user</li>
        </ul>
        <p>See <a href="/docs/errors">error codes</a> for details.</p>
        </body></html>
    "#;

    let markdown = html_to_markdown(html);
    let score = score_extraction(&markdown);

    assert!(
        score > 0.4,
        "Expected decent quality score for well-structured page, got {}",
        score
    );
}

#[test]
fn test_selector_integration() {
    let html = r#"
        <div class="api-endpoint">
            <span class="method">POST</span>
            <span class="path">/v1/messages</span>
        </div>
        <div class="api-endpoint">
            <span class="method">GET</span>
            <span class="path">/v1/models</span>
        </div>
    "#;

    let selector = CSSSelector::new(".api-endpoint");
    let elements = selector.match_elements(html);
    assert_eq!(elements.len(), 2);

    let methods = match_elements(html, ".method");
    assert_eq!(methods.len(), 2);
    assert_eq!(methods[0].text, "POST");
    assert_eq!(methods[1].text, "GET");

    let paths = match_elements(html, ".path");
    assert_eq!(paths[0].text, "/v1/messages");
    assert_eq!(paths[1].text, "/v1/models");
}
