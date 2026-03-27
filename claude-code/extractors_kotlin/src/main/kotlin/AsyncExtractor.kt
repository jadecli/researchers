package com.researchers

import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element

/**
 * Represents an extracted page with structured content.
 */
data class ExtractedPage(
    val url: String,
    val title: String,
    val content: String,
    val headings: List<Heading>,
    val codeBlocks: List<CodeBlock>,
    val links: List<PageLink>,
    val qualityScore: Double
)

data class Heading(val level: Int, val text: String)
data class CodeBlock(val language: String, val content: String, val lineCount: Int)
data class PageLink(val text: String, val href: String, val isInternal: Boolean)

private val NAV_SELECTORS = listOf(
    "nav", "header", "footer",
    "[role=navigation]", ".nav", ".sidebar", ".menu", ".breadcrumb"
)

private val CONTENT_SELECTORS = listOf(
    "main", "article", "[role=main]", "#content", "#main-content",
    ".content", ".main-content", ".post-content", ".markdown-body", ".docs-content"
)

/**
 * Asynchronously extract content from multiple URLs using coroutines.
 *
 * @param urls List of URLs to extract from
 * @param concurrency Maximum number of concurrent extractions
 * @param timeoutMs Timeout per URL in milliseconds
 * @return List of extracted pages
 */
suspend fun extractAsync(
    urls: List<String>,
    concurrency: Int = 5,
    timeoutMs: Long = 15000
): List<ExtractedPage> = coroutineScope {
    val semaphore = Semaphore(concurrency)

    urls.map { url ->
        async {
            semaphore.withPermit {
                try {
                    withTimeout(timeoutMs) {
                        extractFromUrl(url)
                    }
                } catch (e: Exception) {
                    ExtractedPage(
                        url = url,
                        title = "",
                        content = "",
                        headings = emptyList(),
                        codeBlocks = emptyList(),
                        links = emptyList(),
                        qualityScore = 0.0
                    )
                }
            }
        }
    }.awaitAll()
}

/**
 * Extract content from a single URL.
 */
suspend fun extractFromUrl(url: String): ExtractedPage = withContext(Dispatchers.IO) {
    val doc = Jsoup.connect(url)
        .userAgent("ScrapyResearchers/0.1 KotlinExtractor")
        .timeout(15000)
        .get()

    extractFromDocument(doc, url)
}

/**
 * Extract content from an already-parsed Jsoup Document.
 */
fun extractFromDocument(doc: Document, url: String = ""): ExtractedPage {
    // Remove non-content elements
    doc.select("script, style, noscript, iframe, svg").remove()
    NAV_SELECTORS.forEach { selector ->
        doc.select(selector).remove()
    }

    val mainContent = findMainContent(doc)
    val title = extractTitle(doc)
    val content = elementToMarkdown(mainContent)
    val headings = extractHeadings(mainContent)
    val codeBlocks = extractCodeBlocks(mainContent)
    val links = extractLinks(mainContent)
    val qualityScore = scoreQuality(content)

    return ExtractedPage(
        url = url,
        title = title,
        content = content,
        headings = headings,
        codeBlocks = codeBlocks,
        links = links,
        qualityScore = qualityScore
    )
}

private fun extractTitle(doc: Document): String {
    doc.selectFirst("meta[property=og:title]")?.attr("content")
        ?.takeIf { it.isNotBlank() }?.let { return it.trim() }

    doc.selectFirst("title")?.text()
        ?.takeIf { it.isNotBlank() }?.let { return it.trim() }

    doc.selectFirst("h1")?.text()
        ?.takeIf { it.isNotBlank() }?.let { return it.trim() }

    return ""
}

private fun findMainContent(doc: Document): Element {
    for (selector in CONTENT_SELECTORS) {
        val el = doc.selectFirst(selector)
        if (el != null && el.text().trim().length > 100) {
            return el
        }
    }
    return doc.body() ?: doc
}

private fun elementToMarkdown(element: Element): String {
    val sb = StringBuilder()

    for (child in element.select("h1, h2, h3, h4, h5, h6, p, pre, li")) {
        when (child.tagName().lowercase()) {
            "h1" -> sb.appendLine().appendLine().append("# ${child.text().trim()}").appendLine().appendLine()
            "h2" -> sb.appendLine().appendLine().append("## ${child.text().trim()}").appendLine().appendLine()
            "h3" -> sb.appendLine().appendLine().append("### ${child.text().trim()}").appendLine().appendLine()
            "h4" -> sb.appendLine().appendLine().append("#### ${child.text().trim()}").appendLine().appendLine()
            "h5" -> sb.appendLine().appendLine().append("##### ${child.text().trim()}").appendLine().appendLine()
            "h6" -> sb.appendLine().appendLine().append("###### ${child.text().trim()}").appendLine().appendLine()
            "p" -> {
                val text = child.text().trim()
                if (text.isNotEmpty()) sb.appendLine().appendLine(text).appendLine()
            }
            "pre" -> {
                val lang = getCodeLanguage(child)
                sb.appendLine().append("```$lang").appendLine().appendLine(child.text()).append("```").appendLine()
            }
            "li" -> sb.append("- ${child.ownText().trim()}").appendLine()
        }
    }

    return sb.toString().trim()
}

private fun extractHeadings(element: Element): List<Heading> =
    element.select("h1, h2, h3, h4, h5, h6").map { h ->
        Heading(
            level = h.tagName().substring(1).toInt(),
            text = h.text().trim()
        )
    }

private fun extractCodeBlocks(element: Element): List<CodeBlock> =
    element.select("pre").map { pre ->
        CodeBlock(
            language = getCodeLanguage(pre),
            content = pre.text(),
            lineCount = pre.text().split("\n").size
        )
    }

private fun extractLinks(element: Element): List<PageLink> =
    element.select("a[href]")
        .filter { a ->
            val href = a.attr("href")
            !href.startsWith("#") && !href.startsWith("javascript:")
        }
        .map { a ->
            val href = a.attr("href")
            PageLink(
                text = a.text().trim(),
                href = href,
                isInternal = href.startsWith("/") || href.startsWith("./") || href.startsWith("../")
            )
        }

private fun getCodeLanguage(preElement: Element): String {
    val code = preElement.selectFirst("code") ?: return ""
    for (cls in code.classNames()) {
        if (cls.startsWith("language-")) return cls.substring(9)
        if (cls.startsWith("lang-")) return cls.substring(5)
        if (cls.startsWith("highlight-")) return cls.substring(10)
    }
    code.attr("data-lang").takeIf { it.isNotEmpty() }?.let { return it }
    code.attr("data-language").takeIf { it.isNotEmpty() }?.let { return it }
    return ""
}

private fun scoreQuality(content: String): Double {
    if (content.isBlank()) return 0.0

    val words = content.split(Regex("\\s+")).size
    val lines = content.split("\n")
    val headingCount = lines.count { it.trim().startsWith("#") }
    val codeBlockCount = Regex("```").findAll(content).count() / 2
    val listCount = lines.count { it.trim().startsWith("- ") || it.trim().startsWith("* ") }
    val linkCount = Regex("\\[[^\\]]+\\]\\([^)]+\\)").findAll(content).count()

    val wordScore = (words.toDouble() / 1000).coerceAtMost(1.0)
    val headingScore = (headingCount.toDouble() / 5).coerceAtMost(1.0)
    val codeScore = (codeBlockCount.toDouble() / 3).coerceAtMost(1.0)
    val listScore = (listCount.toDouble() / 5).coerceAtMost(1.0)
    val linkScore = (linkCount.toDouble() / 5).coerceAtMost(1.0)

    return (0.30 * wordScore + 0.20 * headingScore + 0.20 * codeScore + 0.15 * listScore + 0.15 * linkScore)
        .coerceIn(0.0, 1.0)
}
