/**
 * BAML-style typed extraction module.
 *
 * Mirrors BAML's approach: define typed schemas, extract structured data
 * from HTML, and produce validated typed output. This is the DSPy-like
 * "programmatic printing" layer — deterministic structured extraction
 * with typed guarantees, no LLM calls required for the extraction step.
 *
 * Schema definitions follow BAML's class/enum pattern:
 *   class Customer { name string, industry string, ... }
 *   enum IndustryCategory { TECHNOLOGY, FINANCE, ... }
 */

import type { CustomerCard, ExtractedPage } from "../extractors/html-extractor.js";

// ── BAML-style enum definitions ──────────────────────────────────

export enum IndustryCategory {
  TECHNOLOGY = "technology",
  FINANCE = "finance",
  HEALTHCARE = "healthcare",
  EDUCATION = "education",
  LEGAL = "legal",
  DEVTOOLS = "devtools",
  OTHER = "other",
}

export enum CustomerTier {
  ENTERPRISE = "enterprise",
  GROWTH = "growth",
  STARTUP = "startup",
  UNKNOWN = "unknown",
}

export enum ProductCategory {
  RELEASE_MANAGEMENT = "release_management",
  MONITORING = "monitoring",
  SECURITY = "security",
  API_MANAGEMENT = "api_management",
  AUTOMATION = "automation",
  OTHER = "other",
}

// ── BAML-style typed output classes ──────────────────────────────

export interface TypedMetric {
  label: string;
  value: string;
  unit: string;
  numericValue: number | null;
}

export interface TypedCustomer {
  name: string;
  industryCategory: IndustryCategory;
  tier: CustomerTier;
  description: string;
  keyMetrics: TypedMetric[];
  link: string;
}

export interface PriceTier {
  name: string;
  price: string;
  priceNumeric: number | null;
  period: string;
}

export interface TypedProduct {
  name: string;
  category: ProductCategory;
  description: string;
  features: string[];
  priceTiers: PriceTier[];
  url: string;
}

// ── Extraction functions (BAML "functions") ──────────────────────

/** Classify industry from raw text — BAML enum mapping. */
function classifyIndustry(raw: string): IndustryCategory {
  const lower = raw.toLowerCase();
  if (lower.includes("technology") || lower.includes("productivity")) return IndustryCategory.TECHNOLOGY;
  if (lower.includes("finance") || lower.includes("investment")) return IndustryCategory.FINANCE;
  if (lower.includes("health") || lower.includes("ehr") || lower.includes("clinical")) return IndustryCategory.HEALTHCARE;
  if (lower.includes("education") || lower.includes("edtech") || lower.includes("learning")) return IndustryCategory.EDUCATION;
  if (lower.includes("legal") || lower.includes("law")) return IndustryCategory.LEGAL;
  if (lower.includes("developer") || lower.includes("devtools") || lower.includes("code")) return IndustryCategory.DEVTOOLS;
  return IndustryCategory.OTHER;
}

/** Classify customer tier from metrics — BAML enum mapping. */
function classifyTier(metrics: string[]): CustomerTier {
  const joined = metrics.join(" ").toLowerCase();
  if (joined.includes("enterprise") || joined.includes("million") || joined.includes("100m")) return CustomerTier.ENTERPRISE;
  if (/\d{4,}/.test(joined) || joined.includes("thousand")) return CustomerTier.GROWTH;
  return CustomerTier.UNKNOWN;
}

/** Parse a metric string into typed components. */
function parseMetric(raw: string): TypedMetric {
  const numMatch = raw.match(/([\d,.]+)([%xM+]?)/);
  const numericValue = numMatch ? parseFloat(numMatch[1].replace(/,/g, "")) : null;

  let unit = "units";
  if (raw.includes("%")) unit = "percent";
  else if (raw.includes("/5") || raw.includes("/10")) unit = "rating";
  else if (raw.toLowerCase().includes("daily") || raw.toLowerCase().includes("interactions")) unit = "count";
  else if (raw.includes("x")) unit = "multiplier";

  // Extract the descriptive label (everything except the number)
  const label = raw.replace(/[\d,.]+[%xM+]?\s*/g, "").trim() || raw;

  return { label, value: raw, unit, numericValue };
}

/** Classify product category from name/features. */
function classifyProduct(name: string, features: string[]): ProductCategory {
  const text = `${name} ${features.join(" ")}`.toLowerCase();
  if (text.includes("release") || text.includes("changelog") || text.includes("version")) return ProductCategory.RELEASE_MANAGEMENT;
  if (text.includes("monitor") || text.includes("track") || text.includes("drift")) return ProductCategory.MONITORING;
  if (text.includes("security") || text.includes("cve") || text.includes("vulnerability")) return ProductCategory.SECURITY;
  if (text.includes("api") || text.includes("openapi") || text.includes("endpoint")) return ProductCategory.API_MANAGEMENT;
  if (text.includes("automat") || text.includes("ci/cd") || text.includes("pipeline")) return ProductCategory.AUTOMATION;
  return ProductCategory.OTHER;
}

/** Parse a price string into structured form. */
function parsePriceTier(raw: string): PriceTier {
  const priceMatch = raw.match(/\$(\d+)/);
  const priceNumeric = priceMatch ? parseInt(priceMatch[1], 10) : null;
  const period = raw.includes("/mo") ? "monthly" : raw.includes("/yr") ? "yearly" : "one-time";

  // Extract tier name
  const name = raw
    .replace(/\$[\d,]+\/?\w*/g, "")
    .replace(/per\s+\w+/g, "")
    .trim() || "default";

  return { name, price: raw, priceNumeric, period };
}

// ── Public BAML-style extraction functions ───────────────────────

/**
 * Extract typed customer data from a CustomerCard.
 * Equivalent to BAML: function ExtractCustomer(card: CustomerCard) -> TypedCustomer
 */
export function extractCustomerTyped(card: CustomerCard): TypedCustomer {
  return {
    name: card.name,
    industryCategory: classifyIndustry(card.industry),
    tier: classifyTier(card.metrics),
    description: card.description,
    keyMetrics: card.metrics.map(parseMetric),
    link: card.link,
  };
}

/**
 * Extract typed product data from an extracted page.
 * Equivalent to BAML: function ExtractProduct(page: ExtractedPage) -> TypedProduct
 */
export function extractProductTyped(page: ExtractedPage, url: string): TypedProduct {
  // Extract features from headings/content that look like feature lists
  const features = page.headings
    .filter((h) => !h.toLowerCase().includes("pricing") && !h.toLowerCase().includes("integration"))
    .concat(
      page.contentMarkdown
        .split("\n")
        .filter((line) => line.trim().startsWith("- ") || line.trim().startsWith("* "))
        .map((line) => line.replace(/^[-*]\s+/, "").trim())
        .filter((line) => line.length > 10 && line.length < 200)
    );

  // Extract pricing
  const priceLines = page.contentMarkdown
    .split("\n")
    .filter((line) => line.includes("$") || line.toLowerCase().includes("free"))
    .map((line) => line.replace(/^[-*#\s]+/, "").trim())
    .filter(Boolean);

  return {
    name: page.title,
    category: classifyProduct(page.title, features),
    description: page.description,
    features: [...new Set(features)].slice(0, 10),
    priceTiers: priceLines.map(parsePriceTier),
    url,
  };
}

/**
 * Programmatic printing — BAML-style formatted output.
 * This is the "programmatic printing" pattern from DSPy/BAML.
 */
export function printTypedCustomers(customers: TypedCustomer[]): string {
  const lines: string[] = ["# Extracted Customers (BAML Typed Output)", ""];

  for (const c of customers) {
    lines.push(`## ${c.name}`);
    lines.push(`- **Industry:** ${c.industryCategory}`);
    lines.push(`- **Tier:** ${c.tier}`);
    lines.push(`- **Description:** ${c.description}`);
    if (c.keyMetrics.length > 0) {
      lines.push(`- **Key Metrics:**`);
      for (const m of c.keyMetrics) {
        lines.push(`  - ${m.value} (${m.unit}${m.numericValue !== null ? `, numeric: ${m.numericValue}` : ""})`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function printTypedProducts(products: TypedProduct[]): string {
  const lines: string[] = ["# Extracted Products (BAML Typed Output)", ""];

  for (const p of products) {
    lines.push(`## ${p.name}`);
    lines.push(`- **Category:** ${p.category}`);
    lines.push(`- **Description:** ${p.description}`);
    if (p.features.length > 0) {
      lines.push(`- **Features:** ${p.features.length}`);
      for (const f of p.features) {
        lines.push(`  - ${f}`);
      }
    }
    if (p.priceTiers.length > 0) {
      lines.push(`- **Pricing:**`);
      for (const t of p.priceTiers) {
        lines.push(`  - ${t.name}: ${t.price} (${t.period}${t.priceNumeric !== null ? `, $${t.priceNumeric}` : ""})`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
