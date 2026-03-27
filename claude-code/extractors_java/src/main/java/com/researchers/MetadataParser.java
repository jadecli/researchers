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
 * Parses metadata from HTML pages using meta tags, Open Graph, and JSON-LD.
 */
public class MetadataParser {

    /**
     * Parse all metadata from an HTML document.
     *
     * @param html Raw HTML string
     * @return Map of metadata fields
     */
    public Map<String, Object> parseMetadata(String html) {
        Document doc = Jsoup.parse(html);
        Map<String, Object> metadata = new LinkedHashMap<>();

        metadata.put("title", extractTitle(doc));
        metadata.put("description", extractDescription(doc));
        metadata.put("author", extractAuthor(doc));
        metadata.put("date", extractDate(doc));
        metadata.put("tags", extractTags(doc));
        metadata.put("ogImage", extractOgImage(doc));
        metadata.put("canonicalUrl", extractCanonical(doc));
        metadata.put("openGraph", extractOpenGraph(doc));

        String jsonLd = extractJsonLd(doc);
        if (!jsonLd.isEmpty()) {
            metadata.put("jsonLd", jsonLd);
        }

        return metadata;
    }

    private String extractTitle(Document doc) {
        Element ogTitle = doc.selectFirst("meta[property=og:title]");
        if (ogTitle != null) {
            String content = ogTitle.attr("content");
            if (!content.isEmpty()) return content.trim();
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

    private String extractDescription(Document doc) {
        Element metaDesc = doc.selectFirst("meta[name=description]");
        if (metaDesc != null) {
            String content = metaDesc.attr("content");
            if (!content.isEmpty()) return content.trim();
        }

        Element ogDesc = doc.selectFirst("meta[property=og:description]");
        if (ogDesc != null) {
            String content = ogDesc.attr("content");
            if (!content.isEmpty()) return content.trim();
        }

        return "";
    }

    private String extractAuthor(Document doc) {
        Element metaAuthor = doc.selectFirst("meta[name=author]");
        if (metaAuthor != null) {
            String content = metaAuthor.attr("content");
            if (!content.isEmpty()) return content.trim();
        }

        Element articleAuthor = doc.selectFirst("meta[property=article:author]");
        if (articleAuthor != null) {
            String content = articleAuthor.attr("content");
            if (!content.isEmpty()) return content.trim();
        }

        Element authorEl = doc.selectFirst("[itemprop=author]");
        if (authorEl != null) return authorEl.text().trim();

        Element authorLink = doc.selectFirst("a[rel=author]");
        if (authorLink != null) return authorLink.text().trim();

        return "";
    }

    private String extractDate(Document doc) {
        Element pubTime = doc.selectFirst("meta[property=article:published_time]");
        if (pubTime != null) {
            String content = pubTime.attr("content");
            if (!content.isEmpty()) return content.trim();
        }

        Element modTime = doc.selectFirst("meta[property=article:modified_time]");
        if (modTime != null) {
            String content = modTime.attr("content");
            if (!content.isEmpty()) return content.trim();
        }

        Element timeEl = doc.selectFirst("time[datetime]");
        if (timeEl != null) {
            String datetime = timeEl.attr("datetime");
            if (!datetime.isEmpty()) return datetime.trim();
        }

        Element metaDate = doc.selectFirst("meta[name=date]");
        if (metaDate != null) {
            String content = metaDate.attr("content");
            if (!content.isEmpty()) return content.trim();
        }

        return "";
    }

    private List<String> extractTags(Document doc) {
        List<String> tags = new ArrayList<>();

        Element metaKw = doc.selectFirst("meta[name=keywords]");
        if (metaKw != null) {
            String content = metaKw.attr("content");
            if (!content.isEmpty()) {
                for (String tag : content.split(",")) {
                    String trimmed = tag.trim();
                    if (!trimmed.isEmpty()) tags.add(trimmed);
                }
            }
        }

        for (Element tagMeta : doc.select("meta[property=article:tag]")) {
            String content = tagMeta.attr("content");
            if (!content.isEmpty()) tags.add(content.trim());
        }

        // Deduplicate
        return new ArrayList<>(new java.util.LinkedHashSet<>(tags));
    }

    private String extractOgImage(Document doc) {
        Element ogImage = doc.selectFirst("meta[property=og:image]");
        if (ogImage != null) {
            String content = ogImage.attr("content");
            if (!content.isEmpty()) return content.trim();
        }
        return "";
    }

    private String extractCanonical(Document doc) {
        Element canonical = doc.selectFirst("link[rel=canonical]");
        if (canonical != null) {
            String href = canonical.attr("href");
            if (!href.isEmpty()) return href.trim();
        }
        return "";
    }

    private Map<String, String> extractOpenGraph(Document doc) {
        Map<String, String> og = new LinkedHashMap<>();

        for (Element meta : doc.select("meta[property^=og:]")) {
            String property = meta.attr("property");
            String content = meta.attr("content");
            if (!property.isEmpty() && !content.isEmpty()) {
                String key = property.substring(3); // Remove "og:" prefix
                og.put(key, content.trim());
            }
        }

        return og;
    }

    private String extractJsonLd(Document doc) {
        Element script = doc.selectFirst("script[type=application/ld+json]");
        if (script != null) {
            return script.data().trim();
        }
        return "";
    }
}
