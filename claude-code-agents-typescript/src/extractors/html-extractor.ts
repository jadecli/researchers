/** Cheerio-based HTML extractor for structured data extraction. */

import * as cheerio from "cheerio";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export interface ExtractedPage {
  title: string;
  description: string;
  contentMarkdown: string;
  metadata: Record<string, string>;
  links: string[];
  headings: string[];
}

export function extractPage(html: string, baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  // Extract metadata
  const title =
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  const metadata: Record<string, string> = {};
  $("meta").each((_, el) => {
    const name =
      $(el).attr("name") || $(el).attr("property") || "";
    const content = $(el).attr("content") || "";
    if (name && content) {
      metadata[name] = content;
    }
  });

  // Extract links
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      try {
        const resolved = new URL(href, baseUrl).href;
        links.push(resolved);
      } catch {
        links.push(href);
      }
    }
  });

  // Extract headings
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  // Convert main content to markdown
  const mainContent = $("main").html() || $("body").html() || html;
  const contentMarkdown = turndown.turndown(mainContent);

  return {
    title,
    description,
    contentMarkdown,
    metadata,
    links: [...new Set(links)],
    headings,
  };
}

export interface CustomerCard {
  name: string;
  industry: string;
  description: string;
  metrics: string[];
  link: string;
}

export function extractCustomers(html: string, baseUrl: string): CustomerCard[] {
  const $ = cheerio.load(html);
  const customers: CustomerCard[] = [];

  $(".customer-card, article[class*=customer]").each((_, el) => {
    const $card = $(el);
    const name = $card.find("h2").first().text().trim();
    const industry = $card.find(".industry").text().trim();
    const description = $card.find(".description").text().trim();
    const metrics: string[] = [];
    $card.find(".metrics li, ul li").each((_, li) => {
      const text = $(li).text().trim();
      if (text) metrics.push(text);
    });
    const link = $card.find("a").first().attr("href") || "";
    const resolvedLink = link
      ? (() => {
          try {
            return new URL(link, baseUrl).href;
          } catch {
            return link;
          }
        })()
      : "";

    if (name) {
      customers.push({ name, industry, description, metrics, link: resolvedLink });
    }
  });

  return customers;
}
