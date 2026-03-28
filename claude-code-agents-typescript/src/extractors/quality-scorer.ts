/** Quality scorer for extracted pages. */

import type { ExtractedPage } from "./html-extractor.js";

export interface QualityBreakdown {
  titlePresent: number;
  descriptionPresent: number;
  contentLength: number;
  linkDensity: number;
  headingStructure: number;
  overall: number;
}

export function scoreQuality(page: ExtractedPage): QualityBreakdown {
  const titlePresent = page.title.length > 0 ? 1.0 : 0.0;
  const descriptionPresent = page.description.length > 0 ? 1.0 : 0.0;

  // Content length score: 0-100 chars = 0.2, 100-500 = 0.6, 500+ = 1.0
  const mdLen = page.contentMarkdown.length;
  const contentLength =
    mdLen > 500 ? 1.0 : mdLen > 100 ? 0.6 : mdLen > 0 ? 0.2 : 0.0;

  // Link density: having some links is good, too many is noise
  const linkCount = page.links.length;
  const linkDensity =
    linkCount >= 2 && linkCount <= 50
      ? 1.0
      : linkCount > 50
        ? 0.5
        : linkCount > 0
          ? 0.7
          : 0.3;

  // Heading structure: having h1 + h2s indicates good structure
  const headingStructure =
    page.headings.length >= 3
      ? 1.0
      : page.headings.length >= 1
        ? 0.7
        : 0.3;

  const overall =
    titlePresent * 0.2 +
    descriptionPresent * 0.15 +
    contentLength * 0.3 +
    linkDensity * 0.15 +
    headingStructure * 0.2;

  return {
    titlePresent,
    descriptionPresent,
    contentLength,
    linkDensity,
    headingStructure,
    overall: Math.round(overall * 10000) / 10000,
  };
}
