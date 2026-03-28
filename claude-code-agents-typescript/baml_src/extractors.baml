// BAML schema definitions for typed extraction.
// These define the structured output types used by the crawler.
// In production, `npx baml generate` produces TypeScript clients from these.

enum IndustryCategory {
  TECHNOLOGY @description("Software, SaaS, productivity tools")
  FINANCE @description("Banking, investment, fintech")
  HEALTHCARE @description("Medical, EHR, clinical systems")
  EDUCATION @description("EdTech, learning platforms, universities")
  LEGAL @description("Law firms, legal tech, compliance")
  DEVTOOLS @description("Developer tools, IDEs, code platforms")
  OTHER @description("Any other industry")
}

enum CustomerTier {
  ENTERPRISE @description("Large organization, 1000+ employees")
  GROWTH @description("Mid-size, scaling rapidly")
  STARTUP @description("Early stage, small team")
  UNKNOWN @description("Cannot determine tier")
}

enum ProductCategory {
  RELEASE_MANAGEMENT @description("Release notes, changelogs, versioning")
  MONITORING @description("Tracking, observability, drift detection")
  SECURITY @description("CVE scanning, SBOM, vulnerability management")
  API_MANAGEMENT @description("API versioning, deprecation, migration")
  AUTOMATION @description("CI/CD, workflow automation")
  OTHER @description("Other product types")
}

class TypedMetric {
  label string @description("Human-readable metric label")
  value string @description("Raw metric string")
  unit string @description("Measurement unit: percent, count, multiplier, rating")
  numericValue float? @description("Parsed numeric value, null if unparseable")
}

class TypedCustomer {
  name string @description("Company name")
  industryCategory IndustryCategory
  tier CustomerTier
  description string @description("Use case summary")
  keyMetrics TypedMetric[] @description("Quantitative results")
  link string @description("Case study URL")
}

class PriceTier {
  name string @description("Tier name: starter, professional, enterprise")
  price string @description("Raw price string")
  priceNumeric float? @description("Numeric price value in USD")
  period string @description("Billing period: monthly, yearly, one-time")
}

class TypedProduct {
  name string @description("Product name")
  category ProductCategory
  description string @description("Product description")
  features string[] @description("Feature list")
  priceTiers PriceTier[] @description("Available pricing tiers")
  url string @description("Product page URL")
}

// Extraction functions — these map to the TypeScript implementations
// in src/crawlers/baml-extractor.ts

function ExtractCustomer(card: CustomerCard) -> TypedCustomer {
  client Deterministic
  prompt #"
    Extract structured customer data from the HTML card.
    Classify industry and tier from the content.
    Parse all metrics into typed components.

    Input: {{ card }}
    Output format: {{ ctx.output_format }}
  "#
}

function ExtractProduct(page: ExtractedPage, url: string) -> TypedProduct {
  client Deterministic
  prompt #"
    Extract structured product data from the page.
    Classify product category from name and features.
    Parse pricing into structured tiers.

    Input: {{ page }}
    URL: {{ url }}
    Output format: {{ ctx.output_format }}
  "#
}
