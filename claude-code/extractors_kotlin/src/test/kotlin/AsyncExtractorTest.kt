package com.researchers

import kotlinx.coroutines.test.runTest
import org.jsoup.Jsoup
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class AsyncExtractorTest {

    @Test
    fun `extractFromDocument extracts basic page`() {
        val html = """
            <html>
            <head><title>Test Page</title></head>
            <body>
                <main>
                    <h1>Main Title</h1>
                    <p>This is a paragraph with enough content to be detected as the main content area.</p>
                    <h2>Section</h2>
                    <p>More content for the section with additional text for detection.</p>
                </main>
            </body>
            </html>
        """.trimIndent()

        val doc = Jsoup.parse(html)
        val result = extractFromDocument(doc, "https://example.com/test")

        assertEquals("Test Page", result.title)
        assertEquals("https://example.com/test", result.url)
        assertTrue(result.content.contains("Main Title"))
        assertTrue(result.content.contains("Section"))
    }

    @Test
    fun `extractFromDocument extracts code blocks`() {
        val html = """
            <html><body><main>
                <h1>Code Page</h1>
                <p>Sufficient content for the main content detection to work properly in this test.</p>
                <pre><code class="language-python">def hello():
                    print("hello")</code></pre>
                <p>More text after code.</p>
            </main></body></html>
        """.trimIndent()

        val doc = Jsoup.parse(html)
        val result = extractFromDocument(doc)

        assertTrue(result.codeBlocks.isNotEmpty())
        assertEquals("python", result.codeBlocks[0].language)
        assertTrue(result.codeBlocks[0].content.contains("def hello()"))
    }

    @Test
    fun `extractFromDocument removes navigation`() {
        val html = """
            <html><body>
                <nav><a href="/">Home</a></nav>
                <main>
                    <h1>Content</h1>
                    <p>The actual content that should be extracted without any navigation elements.</p>
                </main>
                <footer>Footer text</footer>
            </body></html>
        """.trimIndent()

        val doc = Jsoup.parse(html)
        val result = extractFromDocument(doc)

        assertTrue(!result.content.contains("Home"), "Navigation should be removed")
        assertTrue(!result.content.contains("Footer text"), "Footer should be removed")
        assertTrue(result.content.contains("Content"))
    }

    @Test
    fun `extractFromDocument extracts headings`() {
        val html = """
            <html><body><main>
                <h1>Title</h1>
                <p>Padding text for main content detection to work properly.</p>
                <h2>Section One</h2>
                <p>Content.</p>
                <h3>Subsection</h3>
                <p>More content.</p>
            </main></body></html>
        """.trimIndent()

        val doc = Jsoup.parse(html)
        val result = extractFromDocument(doc)

        assertEquals(3, result.headings.size)
        assertEquals(1, result.headings[0].level)
        assertEquals("Title", result.headings[0].text)
        assertEquals(2, result.headings[1].level)
        assertEquals(3, result.headings[2].level)
    }

    @Test
    fun `classify identifies API reference`() {
        val html = """
            <html><body>
                <h1>API Reference</h1>
                <p>Authentication requires an API key. Include it in the request body.</p>
                <p>The endpoint returns a response with the following status code.</p>
            </body></html>
        """.trimIndent()

        val result = classify(html, "https://docs.example.com/api/messages")
        assertEquals(PageType.API_REFERENCE, result)
    }

    @Test
    fun `classify identifies blog post`() {
        val html = """
            <html><head>
                <meta property="article:published_time" content="2024-01-15" />
            </head><body>
                <h1>Our Latest Update</h1>
                <p>Posted by the team. Share this article with others.</p>
                <p>Read more about our author and their work.</p>
            </body></html>
        """.trimIndent()

        val result = classify(html, "https://example.com/blog/update")
        assertEquals(PageType.BLOG_POST, result)
    }

    @Test
    fun `quality score for empty content is zero`() {
        val doc = Jsoup.parse("<html><body></body></html>")
        val result = extractFromDocument(doc)
        assertEquals(0.0, result.qualityScore)
    }
}
