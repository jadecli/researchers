/**
 * XSSScanner - scans HTML content and extracted data for cross-site scripting vectors.
 */

export interface XSSVector {
  type: "script_tag" | "event_handler" | "data_uri" | "javascript_uri" | "svg_injection" | "style_injection";
  content: string;
  location: number; // character offset
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

export interface SanitizationRecommendation {
  field: string;
  currentValue: string;
  risk: string;
  recommendation: string;
}

const SCRIPT_TAG_PATTERN = /<script[\s>][^]*?<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=\s*["'][^"']*["']/gi;
const DATA_URI_PATTERN = /data:\s*(?:text\/html|application\/x?html|text\/javascript|application\/javascript)[;,][^\s"'>]*/gi;
const JAVASCRIPT_URI_PATTERN = /javascript\s*:[^\s"'>]*/gi;
const SVG_INJECTION_PATTERN = /<svg[\s>][^]*?<\/svg>/gi;
const STYLE_EXPRESSION_PATTERN = /expression\s*\([^)]*\)/gi;
const STYLE_IMPORT_PATTERN = /@import\s+(?:url\s*\()?[^;]+/gi;

/**
 * Additional dangerous HTML patterns.
 */
const DANGEROUS_TAGS = [
  /<iframe[\s>]/gi,
  /<object[\s>]/gi,
  /<embed[\s>]/gi,
  /<applet[\s>]/gi,
  /<form[\s>][^]*?action\s*=\s*["']javascript:/gi,
  /<meta[\s>][^]*?http-equiv\s*=\s*["']refresh/gi,
  /<link[\s>][^]*?rel\s*=\s*["']import/gi,
  /<base[\s>][^]*?href\s*=/gi,
];

export class XSSScanner {
  /**
   * Scan raw HTML content for XSS attack vectors.
   */
  scanHtml(html: string): XSSVector[] {
    const vectors: XSSVector[] = [];

    // Check for script tags
    let match: RegExpExecArray | null;
    const scriptRegex = new RegExp(SCRIPT_TAG_PATTERN.source, "gi");
    while ((match = scriptRegex.exec(html)) !== null) {
      vectors.push({
        type: "script_tag",
        content: match[0].substring(0, 200),
        location: match.index,
        severity: "critical",
        description: "Inline script tag found - potential XSS vector",
      });
    }

    // Check for event handlers
    const eventRegex = new RegExp(EVENT_HANDLER_PATTERN.source, "gi");
    while ((match = eventRegex.exec(html)) !== null) {
      vectors.push({
        type: "event_handler",
        content: match[0].substring(0, 200),
        location: match.index,
        severity: "high",
        description: `Event handler attribute found: ${match[0].split("=")[0]}`,
      });
    }

    // Check for data URIs
    const dataRegex = new RegExp(DATA_URI_PATTERN.source, "gi");
    while ((match = dataRegex.exec(html)) !== null) {
      vectors.push({
        type: "data_uri",
        content: match[0].substring(0, 200),
        location: match.index,
        severity: "critical",
        description: "Data URI with executable content type detected",
      });
    }

    // Check for javascript: URIs
    const jsUriRegex = new RegExp(JAVASCRIPT_URI_PATTERN.source, "gi");
    while ((match = jsUriRegex.exec(html)) !== null) {
      vectors.push({
        type: "javascript_uri",
        content: match[0].substring(0, 200),
        location: match.index,
        severity: "critical",
        description: "javascript: URI protocol detected",
      });
    }

    // Check for SVG injection
    const svgRegex = new RegExp(SVG_INJECTION_PATTERN.source, "gi");
    while ((match = svgRegex.exec(html)) !== null) {
      // Only flag if SVG contains scripting
      if (/on\w+\s*=|<script|javascript:/i.test(match[0])) {
        vectors.push({
          type: "svg_injection",
          content: match[0].substring(0, 200),
          location: match.index,
          severity: "high",
          description: "SVG element with embedded scripting detected",
        });
      }
    }

    // Check for CSS expression injection
    const styleExprRegex = new RegExp(STYLE_EXPRESSION_PATTERN.source, "gi");
    while ((match = styleExprRegex.exec(html)) !== null) {
      vectors.push({
        type: "style_injection",
        content: match[0].substring(0, 200),
        location: match.index,
        severity: "high",
        description: "CSS expression() detected - potential script execution via styles",
      });
    }

    return vectors;
  }

  /**
   * Scan extracted/crawled content and provide sanitization recommendations.
   */
  scanExtractedContent(content: Record<string, string>): SanitizationRecommendation[] {
    const recommendations: SanitizationRecommendation[] = [];

    for (const [field, value] of Object.entries(content)) {
      if (typeof value !== "string") continue;

      // Check for HTML in text fields
      if (/<[a-z][\s\S]*>/i.test(value)) {
        recommendations.push({
          field,
          currentValue: value.substring(0, 100),
          risk: "HTML content in text field",
          recommendation: "Strip HTML tags or use a sanitization library like DOMPurify before storing/displaying",
        });
      }

      // Check for script content
      if (/<script/i.test(value) || /javascript:/i.test(value)) {
        recommendations.push({
          field,
          currentValue: value.substring(0, 100),
          risk: "Script content detected in extracted data",
          recommendation: "Reject this content or apply strict HTML sanitization. Never render as raw HTML.",
        });
      }

      // Check for encoded payloads
      if (/&#x?[0-9a-f]+;/i.test(value) || /%3[Cc]script/i.test(value)) {
        recommendations.push({
          field,
          currentValue: value.substring(0, 100),
          risk: "HTML/URL encoded potential XSS payload",
          recommendation: "Decode and re-scan content, then apply sanitization",
        });
      }

      // Check for template injection patterns
      if (/\{\{.*\}\}|\${.*}/.test(value)) {
        recommendations.push({
          field,
          currentValue: value.substring(0, 100),
          risk: "Template expression in extracted data - potential template injection",
          recommendation: "Escape template delimiters before rendering in any template engine",
        });
      }
    }

    return recommendations;
  }
}
