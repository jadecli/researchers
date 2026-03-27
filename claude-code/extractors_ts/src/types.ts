/**
 * Core types for the TypeScript extractor modules.
 */

export interface ExtractedPage {
  url: string;
  title: string;
  content: string;
  codeBlocks: CodeBlock[];
  links: PageLink[];
  metadata: PageMetadata;
}

export interface CodeBlock {
  language: string;
  content: string;
  lineCount: number;
}

export interface PageLink {
  text: string;
  href: string;
  isInternal: boolean;
}

export interface PageMetadata {
  title: string;
  description: string;
  author: string;
  date: string;
  tags: string[];
  ogImage: string;
  canonicalUrl: string;
}

export interface APISpec {
  method: string;
  path: string;
  description: string;
  params: APIParam[];
  response: ResponseSpec;
}

export interface APIParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  location: "path" | "query" | "header" | "body";
}

export interface ResponseSpec {
  statusCode: number;
  contentType: string;
  schema: Record<string, unknown>;
  example: string;
}

export interface AgentSDKOptions {
  outputFormat?: "json" | "text" | "stream-json";
  maxTurns?: number;
  systemPrompt?: string;
  allowedTools?: string[];
  model?: string;
}
