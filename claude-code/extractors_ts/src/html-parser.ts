/**
 * HTML parser using cheerio for structured content extraction.
 */

import * as cheerio from "cheerio";
import type {
  ExtractedPage,
  CodeBlock,
  PageLink,
  PageMetadata,
} from "./types.js";

/**
 * Parse HTML into a structured ExtractedPage.
 */
export function parseHtml(html: string, url: string = ""): ExtractedPage {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, noscript, iframe, svg, nav, header, footer").remove();
  $('[role="navigation"], .nav, .sidebar, .menu, .breadcrumb').remove();

  const metadata = extractMetadata($, url);
  const mainContent = findMainContent($);
  const content = extractTextContent($, mainContent);
  const codeBlocks = extractCodeBlocksFromElement($, mainContent);
  const links = extractLinks($, mainContent, url);

  return {
    url,
    title: metadata.title,
    content,
    codeBlocks,
    links,
    metadata,
  };
}

function extractMetadata(
  $: cheerio.CheerioAPI,
  url: string
): PageMetadata {
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    "";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('[rel="author"]').text().trim() ||
    "";

  const date =
    $('meta[property="article:published_time"]').attr("content") ||
    $("time").attr("datetime") ||
    $('meta[name="date"]').attr("content") ||
    "";

  const tags: string[] = [];
  const keywords = $('meta[name="keywords"]').attr("content");
  if (keywords) {
    tags.push(
      ...keywords.split(",").map((t) => t.trim()).filter(Boolean)
    );
  }
  $('meta[property="article:tag"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) tags.push(content.trim());
  });

  const ogImage = $('meta[property="og:image"]').attr("content") || "";
  const canonicalUrl =
    $('link[rel="canonical"]').attr("href") || url;

  return { title, description, author, date, tags, ogImage, canonicalUrl };
}

function findMainContent(
  $: cheerio.CheerioAPI
): cheerio.Cheerio<cheerio.AnyNode> {
  const selectors = [
    "main",
    "article",
    '[role="main"]',
    "#content",
    "#main-content",
    ".content",
    ".main-content",
    ".post-content",
    ".markdown-body",
    ".docs-content",
  ];

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0 && el.text().trim().length > 100) {
      return el;
    }
  }

  const body = $("body");
  return body.length > 0 ? body : $.root();
}

function extractTextContent(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<cheerio.AnyNode>
): string {
  const parts: string[] = [];

  container.find("h1, h2, h3, h4, h5, h6, p, li, pre, blockquote").each(
    (_, el) => {
      const tagName = (el as cheerio.Element).tagName?.toLowerCase() || "";
      const text = $(el).text().trim();

      if (!text) return;

      if (tagName.startsWith("h")) {
        const level = parseInt(tagName[1], 10);
        parts.push(`${"#".repeat(level)} ${text}`);
      } else if (tagName === "pre") {
        parts.push(`\`\`\`\n${text}\n\`\`\``);
      } else if (tagName === "li") {
        parts.push(`- ${text}`);
      } else if (tagName === "blockquote") {
        parts.push(
          text
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n")
        );
      } else {
        parts.push(text);
      }
    }
  );

  return parts.join("\n\n");
}

function extractCodeBlocksFromElement(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<cheerio.AnyNode>
): CodeBlock[] {
  const blocks: CodeBlock[] = [];

  container.find("pre code, pre").each((_, el) => {
    const $el = $(el);
    const content = $el.text().trim();
    if (!content) return;

    let language = "";
    const classes = ($el.attr("class") || "").split(/\s+/);
    for (const cls of classes) {
      if (cls.startsWith("language-")) {
        language = cls.substring(9);
        break;
      }
      if (cls.startsWith("lang-")) {
        language = cls.substring(5);
        break;
      }
      if (cls.startsWith("highlight-")) {
        language = cls.substring(10);
        break;
      }
    }

    if (!language) {
      language = $el.attr("data-lang") || $el.attr("data-language") || "";
    }

    blocks.push({
      language,
      content,
      lineCount: content.split("\n").length,
    });
  });

  return blocks;
}

function extractLinks(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<cheerio.AnyNode>,
  baseUrl: string
): PageLink[] {
  const links: PageLink[] = [];
  const seen = new Set<string>();

  let baseDomain = "";
  try {
    baseDomain = new URL(baseUrl).hostname;
  } catch {
    // baseUrl might be empty or invalid
  }

  container.find("a[href]").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    const text = $el.text().trim();

    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (seen.has(href)) return;
    seen.add(href);

    let isInternal = false;
    if (href.startsWith("/") || href.startsWith("./") || href.startsWith("../")) {
      isInternal = true;
    } else {
      try {
        const linkDomain = new URL(href).hostname;
        isInternal = linkDomain === baseDomain;
      } catch {
        isInternal = true;
      }
    }

    links.push({ text, href, isInternal });
  });

  return links;
}
