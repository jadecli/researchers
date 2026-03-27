/**
 * API specification extractor for documentation pages.
 */

import * as cheerio from "cheerio";
import type { APISpec, APIParam, ResponseSpec } from "./types.js";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/**
 * Extract API endpoint specifications from HTML documentation.
 */
export function extractAPISpecs(html: string): APISpec[] {
  const $ = cheerio.load(html);
  const specs: APISpec[] = [];

  // Strategy 1: Look for API endpoint tables
  const tableSpecs = extractFromTables($);
  specs.push(...tableSpecs);

  // Strategy 2: Look for API sections with method + path patterns
  const sectionSpecs = extractFromSections($);
  specs.push(...sectionSpecs);

  // Strategy 3: Look for code blocks with HTTP request patterns
  const codeSpecs = extractFromCodeBlocks($);
  specs.push(...codeSpecs);

  // Deduplicate by method + path
  const seen = new Set<string>();
  const unique: APISpec[] = [];
  for (const spec of specs) {
    const key = `${spec.method}:${spec.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(spec);
    }
  }

  return unique;
}

function extractFromTables($: cheerio.CheerioAPI): APISpec[] {
  const specs: APISpec[] = [];

  $("table").each((_, table) => {
    const $table = $(table);
    const headers = $table
      .find("thead th, thead td, tr:first-child th, tr:first-child td")
      .map((_, el) => $(el).text().trim().toLowerCase())
      .get();

    const hasMethodCol = headers.some((h) =>
      ["method", "http method", "verb"].includes(h)
    );
    const hasPathCol = headers.some((h) =>
      ["path", "endpoint", "url", "route", "uri"].includes(h)
    );

    if (!hasMethodCol && !hasPathCol) return;

    const methodIdx = headers.findIndex((h) =>
      ["method", "http method", "verb"].includes(h)
    );
    const pathIdx = headers.findIndex((h) =>
      ["path", "endpoint", "url", "route", "uri"].includes(h)
    );
    const descIdx = headers.findIndex((h) =>
      ["description", "desc", "summary", "details"].includes(h)
    );

    $table.find("tbody tr, tr").slice(1).each((_, row) => {
      const cells = $(row).find("td, th").map((_, el) => $(el).text().trim()).get();
      if (cells.length === 0) return;

      const method = methodIdx >= 0 ? cells[methodIdx]?.toUpperCase() || "GET" : "GET";
      const path = pathIdx >= 0 ? cells[pathIdx] || "" : "";
      const description = descIdx >= 0 ? cells[descIdx] || "" : "";

      if (path && HTTP_METHODS.includes(method)) {
        specs.push({
          method,
          path,
          description,
          params: [],
          response: emptyResponse(),
        });
      }
    });
  });

  return specs;
}

function extractFromSections($: cheerio.CheerioAPI): APISpec[] {
  const specs: APISpec[] = [];

  // Pattern: heading containing HTTP method + path
  const methodPathRegex = new RegExp(
    `\\b(${HTTP_METHODS.join("|")})\\s+(/[\\w/{}:.-]+)`,
    "i"
  );

  $("h1, h2, h3, h4, h5, h6").each((_, heading) => {
    const $heading = $(heading);
    const headingText = $heading.text().trim();
    const match = headingText.match(methodPathRegex);

    if (!match) return;

    const method = match[1].toUpperCase();
    const path = match[2];

    // Get description from the next sibling paragraph
    let description = "";
    const nextP = $heading.next("p");
    if (nextP.length > 0) {
      description = nextP.text().trim();
    }

    // Try to extract parameters from following content
    const params = extractParamsFromSection($, $heading);

    // Try to extract response from following code blocks
    const response = extractResponseFromSection($, $heading);

    specs.push({ method, path, description, params, response });
  });

  // Also look for bold/code patterns like `POST /v1/messages`
  $("p, div").each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(methodPathRegex);
    if (!match) return;

    const method = match[1].toUpperCase();
    const path = match[2];

    // Only add if this looks like an endpoint definition (short text)
    if (text.length > 200) return;

    specs.push({
      method,
      path,
      description: text.replace(match[0], "").trim(),
      params: [],
      response: emptyResponse(),
    });
  });

  return specs;
}

function extractFromCodeBlocks($: cheerio.CheerioAPI): APISpec[] {
  const specs: APISpec[] = [];

  const curlRegex = new RegExp(
    `curl\\s+(?:-X\\s+)?(${HTTP_METHODS.join("|")})\\s+['"]*([^\\s'"]+)`,
    "i"
  );

  const httpRegex = new RegExp(
    `^(${HTTP_METHODS.join("|")})\\s+(/[^\\s]+)\\s+HTTP/`,
    "im"
  );

  $("pre, code").each((_, el) => {
    const content = $(el).text().trim();

    const curlMatch = content.match(curlRegex);
    if (curlMatch) {
      const method = curlMatch[1].toUpperCase();
      let path = curlMatch[2];

      // Extract path from full URL
      try {
        const url = new URL(path);
        path = url.pathname;
      } catch {
        // Already a path
      }

      specs.push({
        method,
        path,
        description: "",
        params: [],
        response: emptyResponse(),
      });
      return;
    }

    const httpMatch = content.match(httpRegex);
    if (httpMatch) {
      specs.push({
        method: httpMatch[1].toUpperCase(),
        path: httpMatch[2],
        description: "",
        params: [],
        response: emptyResponse(),
      });
    }
  });

  return specs;
}

function extractParamsFromSection(
  $: cheerio.CheerioAPI,
  $heading: cheerio.Cheerio<cheerio.AnyNode>
): APIParam[] {
  const params: APIParam[] = [];

  // Look for parameter tables or lists after the heading
  let $next = $heading.next();
  let depth = 0;

  while ($next.length > 0 && depth < 10) {
    const tagName = ($next[0] as cheerio.Element).tagName?.toLowerCase() || "";

    // Stop at next heading of same or higher level
    if (tagName.match(/^h[1-6]$/)) break;

    if (tagName === "table") {
      $next.find("tbody tr, tr").slice(1).each((_, row) => {
        const cells = $(row).find("td").map((_, el) => $(el).text().trim()).get();
        if (cells.length >= 2) {
          params.push({
            name: cells[0],
            type: cells.length >= 3 ? cells[1] : "string",
            required: cells.some((c) =>
              c.toLowerCase().includes("required")
            ),
            description: cells[cells.length - 1],
            location: "body",
          });
        }
      });
      break;
    }

    if (tagName === "ul" || tagName === "dl") {
      $next.find("li, dt").each((_, el) => {
        const text = $(el).text().trim();
        const nameMatch = text.match(/^[`*]?(\w+)[`*]?\s*[(-:]/);
        if (nameMatch) {
          params.push({
            name: nameMatch[1],
            type: "string",
            required: text.toLowerCase().includes("required"),
            description: text.replace(nameMatch[0], "").trim(),
            location: "body",
          });
        }
      });
      break;
    }

    $next = $next.next();
    depth++;
  }

  return params;
}

function extractResponseFromSection(
  $: cheerio.CheerioAPI,
  $heading: cheerio.Cheerio<cheerio.AnyNode>
): ResponseSpec {
  let $next = $heading.next();
  let depth = 0;

  while ($next.length > 0 && depth < 15) {
    const tagName = ($next[0] as cheerio.Element).tagName?.toLowerCase() || "";

    if (tagName.match(/^h[1-6]$/)) break;

    if (tagName === "pre") {
      const content = $next.text().trim();
      if (content.startsWith("{") || content.startsWith("[")) {
        try {
          const parsed = JSON.parse(content);
          return {
            statusCode: 200,
            contentType: "application/json",
            schema: typeof parsed === "object" ? parsed : {},
            example: content,
          };
        } catch {
          return {
            statusCode: 200,
            contentType: "application/json",
            schema: {},
            example: content,
          };
        }
      }
    }

    $next = $next.next();
    depth++;
  }

  return emptyResponse();
}

function emptyResponse(): ResponseSpec {
  return {
    statusCode: 200,
    contentType: "application/json",
    schema: {},
    example: "",
  };
}
