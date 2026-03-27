package com.researchers

import org.jsoup.Jsoup
import org.jsoup.nodes.Document

/**
 * Page type classification based on URL and content analysis.
 */
enum class PageType {
    API_REFERENCE,
    SDK_GUIDE,
    TUTORIAL,
    BLOG_POST,
    RESEARCH_PAPER,
    CHANGELOG,
    FAQ,
    LANDING_PAGE,
    DOCUMENTATION,
    UNKNOWN
}

/**
 * Classify an HTML page into a PageType based on URL patterns and content heuristics.
 */
fun classify(html: String, url: String = ""): PageType {
    val doc = Jsoup.parse(html)
    val urlLower = url.lowercase()
    val content = doc.text().lowercase()
    val title = (doc.selectFirst("title")?.text() ?: "").lowercase()

    // URL-based classification (highest confidence)
    val urlType = classifyByUrl(urlLower)
    if (urlType != PageType.UNKNOWN) return urlType

    // Content-based classification
    return classifyByContent(doc, content, title)
}

private fun classifyByUrl(url: String): PageType {
    return when {
        url.contains("/api/") || url.contains("/reference/") -> PageType.API_REFERENCE
        url.contains("/sdk/") || url.contains("/library/") -> PageType.SDK_GUIDE
        url.contains("/tutorial") || url.contains("/getting-started") || url.contains("/quickstart") -> PageType.TUTORIAL
        url.contains("/blog/") || url.contains("/news/") || url.contains("/posts/") -> PageType.BLOG_POST
        url.contains("/research/") || url.contains("/paper") -> PageType.RESEARCH_PAPER
        url.contains("/changelog") || url.contains("/releases") || url.contains("/whatsnew") -> PageType.CHANGELOG
        url.contains("/faq") || url.contains("/questions") -> PageType.FAQ
        url.endsWith("/") && url.count { it == '/' } <= 3 -> PageType.LANDING_PAGE
        url.contains("/docs/") || url.contains("/guide/") || url.contains("/documentation/") -> PageType.DOCUMENTATION
        else -> PageType.UNKNOWN
    }
}

private fun classifyByContent(doc: Document, content: String, title: String): PageType {
    // API reference signals
    val apiSignals = listOf("endpoint", "request body", "response", "status code", "authentication", "api key")
    val apiScore = apiSignals.count { content.contains(it) }
    if (apiScore >= 3) return PageType.API_REFERENCE

    // SDK/library signals
    val sdkSignals = listOf("import ", "install", "npm ", "pip ", "require(", "dependency")
    val sdkScore = sdkSignals.count { content.contains(it) }
    if (sdkScore >= 3) return PageType.SDK_GUIDE

    // Research paper signals
    val researchSignals = listOf("abstract", "authors", "arxiv", "citation", "methodology", "findings")
    val researchScore = researchSignals.count { content.contains(it) }
    if (researchScore >= 3) return PageType.RESEARCH_PAPER

    // Blog post signals
    val blogSignals = listOf("posted", "published", "author", "share", "comments", "read more")
    val blogScore = blogSignals.count { content.contains(it) }
    val hasDateMeta = doc.selectFirst("meta[property=article:published_time]") != null
            || doc.selectFirst("time") != null
    if (blogScore >= 2 && hasDateMeta) return PageType.BLOG_POST

    // Tutorial signals
    val tutorialSignals = listOf("step ", "next step", "example", "try it", "let's", "follow along")
    val tutorialScore = tutorialSignals.count { content.contains(it) }
    if (tutorialScore >= 3) return PageType.TUTORIAL

    // Changelog signals
    val changelogSignals = listOf("version ", "release", "fixed", "added", "changed", "breaking change")
    val changelogScore = changelogSignals.count { content.contains(it) }
    if (changelogScore >= 3) return PageType.CHANGELOG

    // FAQ signals
    val faqSignals = listOf("?", "question", "answer", "how do", "what is", "why does")
    val faqScore = faqSignals.count { content.contains(it) }
    if (faqScore >= 4 && (title.contains("faq") || title.contains("question"))) return PageType.FAQ

    // Check for documentation structure
    val headingCount = doc.select("h1, h2, h3").size
    val codeBlockCount = doc.select("pre, code").size
    if (headingCount >= 3 && codeBlockCount >= 1) return PageType.DOCUMENTATION

    // Landing page heuristic
    val hasHero = doc.selectFirst(".hero, .banner, .jumbotron") != null
    val hasCTA = doc.select("a.btn, a.button, .cta").isNotEmpty()
    if (hasHero || hasCTA) return PageType.LANDING_PAGE

    return PageType.UNKNOWN
}
