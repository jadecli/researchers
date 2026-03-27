import SwiftSoup

/// Extracts structured content from HTML using SwiftSoup.
public struct HtmlExtractor {

    public init() {}

    /// Result of HTML extraction.
    public struct ExtractionResult {
        public let title: String
        public let content: String
        public let headings: [Heading]
        public let codeBlocks: [CodeBlock]
        public let links: [PageLink]
    }

    public struct Heading {
        public let level: Int
        public let text: String
    }

    public struct CodeBlock {
        public let language: String
        public let content: String
        public let lineCount: Int
    }

    public struct PageLink {
        public let text: String
        public let href: String
        public let isInternal: Bool
    }

    private static let navSelectors = [
        "nav", "header", "footer",
        "[role=navigation]", ".nav", ".sidebar", ".menu", ".breadcrumb"
    ]

    private static let contentSelectors = [
        "main", "article", "[role=main]", "#content", "#main-content",
        ".content", ".main-content", ".post-content", ".markdown-body", ".docs-content"
    ]

    /// Extract structured content from HTML.
    public func extract(html: String) throws -> ExtractionResult {
        let doc = try SwiftSoup.parse(html)

        // Remove non-content elements
        try doc.select("script, style, noscript, iframe, svg").remove()
        for selector in Self.navSelectors {
            try doc.select(selector).remove()
        }

        let mainContent = try findMainContent(doc: doc)
        let title = try extractTitle(doc: doc)
        let content = try elementToMarkdown(element: mainContent)
        let headings = try extractHeadings(element: mainContent)
        let codeBlocks = try extractCodeBlocks(element: mainContent)
        let links = try extractLinks(element: mainContent)

        return ExtractionResult(
            title: title,
            content: content.trimmingCharacters(in: .whitespacesAndNewlines),
            headings: headings,
            codeBlocks: codeBlocks,
            links: links
        )
    }

    private func extractTitle(doc: Document) throws -> String {
        if let ogTitle = try doc.select("meta[property=og:title]").first() {
            let content = try ogTitle.attr("content").trimmingCharacters(in: .whitespaces)
            if !content.isEmpty { return content }
        }

        if let titleEl = try doc.select("title").first() {
            let text = try titleEl.text().trimmingCharacters(in: .whitespaces)
            if !text.isEmpty { return text }
        }

        if let h1 = try doc.select("h1").first() {
            return try h1.text().trimmingCharacters(in: .whitespaces)
        }

        return ""
    }

    private func findMainContent(doc: Document) throws -> Element {
        for selector in Self.contentSelectors {
            if let el = try doc.select(selector).first() {
                let text = try el.text().trimmingCharacters(in: .whitespaces)
                if text.count > 100 {
                    return el
                }
            }
        }

        if let body = doc.body() {
            return body
        }

        return doc
    }

    private func elementToMarkdown(element: Element) throws -> String {
        var output = ""

        for child in try element.select("h1, h2, h3, h4, h5, h6, p, pre, li") {
            let tagName = child.tagName().lowercased()
            let text = try child.text().trimmingCharacters(in: .whitespaces)

            switch tagName {
            case "h1": output += "\n\n# \(text)\n\n"
            case "h2": output += "\n\n## \(text)\n\n"
            case "h3": output += "\n\n### \(text)\n\n"
            case "h4": output += "\n\n#### \(text)\n\n"
            case "h5": output += "\n\n##### \(text)\n\n"
            case "h6": output += "\n\n###### \(text)\n\n"
            case "p":
                if !text.isEmpty {
                    output += "\n\n\(text)\n\n"
                }
            case "pre":
                let lang = try getCodeLanguage(preElement: child)
                output += "\n\n```\(lang)\n\(text)\n```\n\n"
            case "li":
                output += "\n- \(text)"
            default:
                break
            }
        }

        return output
    }

    private func extractHeadings(element: Element) throws -> [Heading] {
        var headings: [Heading] = []

        for h in try element.select("h1, h2, h3, h4, h5, h6") {
            let tagName = h.tagName()
            let level = Int(String(tagName.last ?? "0")) ?? 0
            let text = try h.text().trimmingCharacters(in: .whitespaces)
            headings.append(Heading(level: level, text: text))
        }

        return headings
    }

    private func extractCodeBlocks(element: Element) throws -> [CodeBlock] {
        var blocks: [CodeBlock] = []

        for pre in try element.select("pre") {
            let content = try pre.text()
            let language = try getCodeLanguage(preElement: pre)
            let lineCount = content.split(separator: "\n").count

            blocks.append(CodeBlock(
                language: language,
                content: content,
                lineCount: lineCount
            ))
        }

        return blocks
    }

    private func extractLinks(element: Element) throws -> [PageLink] {
        var links: [PageLink] = []

        for a in try element.select("a[href]") {
            let href = try a.attr("href")
            if href.hasPrefix("#") || href.hasPrefix("javascript:") { continue }

            let text = try a.text().trimmingCharacters(in: .whitespaces)
            let isInternal = href.hasPrefix("/") || href.hasPrefix("./") || href.hasPrefix("../")

            links.append(PageLink(text: text, href: href, isInternal: isInternal))
        }

        return links
    }

    private func getCodeLanguage(preElement: Element) throws -> String {
        if let code = try preElement.select("code").first() {
            let classes = try code.className().split(separator: " ")
            for cls in classes {
                let clsStr = String(cls)
                if clsStr.hasPrefix("language-") { return String(clsStr.dropFirst(9)) }
                if clsStr.hasPrefix("lang-") { return String(clsStr.dropFirst(5)) }
                if clsStr.hasPrefix("highlight-") { return String(clsStr.dropFirst(10)) }
            }

            let dataLang = try code.attr("data-lang")
            if !dataLang.isEmpty { return dataLang }

            let dataLanguage = try code.attr("data-language")
            if !dataLanguage.isEmpty { return dataLanguage }
        }

        return ""
    }
}
