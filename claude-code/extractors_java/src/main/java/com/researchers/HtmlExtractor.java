package com.researchers;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Extracts structured content from HTML using Jsoup.
 */
public class HtmlExtractor {

    private static final String[] NAV_SELECTORS = {
            "nav", "header", "footer",
            "[role=navigation]", ".nav", ".sidebar", ".menu", ".breadcrumb"
    };

    private static final String[] CONTENT_SELECTORS = {
            "main", "article", "[role=main]", "#content", "#main-content",
            ".content", ".main-content", ".post-content", ".markdown-body", ".docs-content"
    };

    /**
     * Extract structured content from HTML.
     *
     * @param html Raw HTML string
     * @return Map containing title, content (as markdown), headings, code blocks, and links
     */
    public Map<String, Object> extract(String html) {
        Document doc = Jsoup.parse(html);

        // Remove non-content elements
        doc.select("script, style, noscript, iframe, svg").remove();
        for (String selector : NAV_SELECTORS) {
            doc.select(selector).remove();
        }

        Element mainContent = findMainContent(doc);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("title", extractTitle(doc));
        result.put("content", elementToMarkdown(mainContent));
        result.put("headings", extractHeadings(mainContent));
        result.put("codeBlocks", extractCodeBlocks(mainContent));
        result.put("links", extractLinks(mainContent));

        return result;
    }

    private String extractTitle(Document doc) {
        Element ogTitle = doc.selectFirst("meta[property=og:title]");
        if (ogTitle != null) {
            String content = ogTitle.attr("content");
            if (!content.isEmpty()) return content;
        }

        Element title = doc.selectFirst("title");
        if (title != null) {
            String text = title.text().trim();
            if (!text.isEmpty()) return text;
        }

        Element h1 = doc.selectFirst("h1");
        if (h1 != null) return h1.text().trim();

        return "";
    }

    private Element findMainContent(Document doc) {
        for (String selector : CONTENT_SELECTORS) {
            Element el = doc.selectFirst(selector);
            if (el != null && el.text().trim().length() > 100) {
                return el;
            }
        }

        Element body = doc.body();
        return body != null ? body : doc;
    }

    private String elementToMarkdown(Element element) {
        StringBuilder sb = new StringBuilder();

        for (Element child : element.getAllElements()) {
            String tagName = child.tagName().toLowerCase();

            switch (tagName) {
                case "h1":
                    sb.append("\n\n# ").append(child.ownText()).append("\n\n");
                    break;
                case "h2":
                    sb.append("\n\n## ").append(child.ownText()).append("\n\n");
                    break;
                case "h3":
                    sb.append("\n\n### ").append(child.ownText()).append("\n\n");
                    break;
                case "h4":
                    sb.append("\n\n#### ").append(child.ownText()).append("\n\n");
                    break;
                case "h5":
                    sb.append("\n\n##### ").append(child.ownText()).append("\n\n");
                    break;
                case "h6":
                    sb.append("\n\n###### ").append(child.ownText()).append("\n\n");
                    break;
                case "p":
                    String text = child.text().trim();
                    if (!text.isEmpty()) {
                        sb.append("\n\n").append(text).append("\n\n");
                    }
                    break;
                case "pre":
                    String lang = getCodeLanguage(child);
                    String code = child.text();
                    sb.append("\n\n```").append(lang).append("\n").append(code).append("\n```\n\n");
                    break;
                case "li":
                    sb.append("\n- ").append(child.ownText());
                    break;
                default:
                    break;
            }
        }

        return cleanMarkdown(sb.toString());
    }

    private List<Map<String, String>> extractHeadings(Element element) {
        List<Map<String, String>> headings = new ArrayList<>();

        for (Element heading : element.select("h1, h2, h3, h4, h5, h6")) {
            Map<String, String> h = new LinkedHashMap<>();
            h.put("level", heading.tagName().substring(1));
            h.put("text", heading.text().trim());
            h.put("id", heading.id());
            headings.add(h);
        }

        return headings;
    }

    private List<Map<String, String>> extractCodeBlocks(Element element) {
        List<Map<String, String>> blocks = new ArrayList<>();

        for (Element pre : element.select("pre")) {
            Map<String, String> block = new LinkedHashMap<>();
            block.put("language", getCodeLanguage(pre));
            block.put("content", pre.text());
            block.put("lineCount", String.valueOf(pre.text().split("\n").length));
            blocks.add(block);
        }

        return blocks;
    }

    private List<Map<String, String>> extractLinks(Element element) {
        List<Map<String, String>> links = new ArrayList<>();

        for (Element a : element.select("a[href]")) {
            String href = a.attr("href");
            if (href.startsWith("#") || href.startsWith("javascript:")) continue;

            Map<String, String> link = new LinkedHashMap<>();
            link.put("text", a.text().trim());
            link.put("href", href);
            link.put("isInternal", String.valueOf(
                    href.startsWith("/") || href.startsWith("./") || href.startsWith("../")
            ));
            links.add(link);
        }

        return links;
    }

    private String getCodeLanguage(Element preElement) {
        Element code = preElement.selectFirst("code");
        if (code != null) {
            for (String cls : code.classNames()) {
                if (cls.startsWith("language-")) return cls.substring(9);
                if (cls.startsWith("lang-")) return cls.substring(5);
                if (cls.startsWith("highlight-")) return cls.substring(10);
            }
            String dataLang = code.attr("data-lang");
            if (!dataLang.isEmpty()) return dataLang;
            String dataLanguage = code.attr("data-language");
            if (!dataLanguage.isEmpty()) return dataLanguage;
        }
        return "";
    }

    private String cleanMarkdown(String md) {
        // Remove excessive blank lines
        md = md.replaceAll("\n{4,}", "\n\n\n");

        // Trim trailing whitespace from lines
        StringBuilder sb = new StringBuilder();
        for (String line : md.split("\n")) {
            sb.append(line.stripTrailing()).append("\n");
        }

        return sb.toString().trim();
    }
}
