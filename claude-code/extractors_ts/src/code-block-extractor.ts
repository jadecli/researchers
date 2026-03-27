/**
 * Code block extractor with language detection heuristics.
 */

import * as cheerio from "cheerio";
import type { CodeBlock } from "./types.js";

const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  python: ["def ", "import ", "class ", "print(", "self.", "elif ", "__init__", "lambda "],
  javascript: ["const ", "let ", "var ", "function ", "=>", "console.log", "require(", "module.exports"],
  typescript: ["interface ", "type ", ": string", ": number", ": boolean", "as ", "readonly "],
  rust: ["fn ", "let mut ", "impl ", "pub fn", "use ", "struct ", "enum ", "match "],
  go: ["func ", "package ", "import (", "fmt.", "err != nil", ":= ", "go func"],
  java: ["public class", "private ", "System.out", "import java.", "void ", "@Override"],
  kotlin: ["fun ", "val ", "var ", "class ", "suspend ", "companion object", "data class"],
  csharp: ["using ", "namespace ", "public class", "static void", "var ", "async Task"],
  cpp: ["#include", "std::", "int main(", "cout <<", "nullptr", "auto "],
  php: ["<?php", "function ", "$this->", "echo ", "->", "namespace "],
  ruby: ["def ", "end", "puts ", "require ", "class ", "attr_accessor", "do |"],
  swift: ["func ", "let ", "var ", "struct ", "import ", "guard ", "class "],
  shell: ["#!/bin/", "echo ", "export ", "if [", "fi", "done", "apt-get", "npm "],
  sql: ["SELECT ", "FROM ", "WHERE ", "INSERT ", "CREATE TABLE", "ALTER ", "JOIN "],
  html: ["<!DOCTYPE", "<html", "<div", "<span", "<head>", "<body>"],
  css: ["{", "}", "color:", "margin:", "padding:", "display:", "@media"],
  json: ['{"', '"}', '": ', '":', "[{"],
  yaml: ["---", "- name:", "description:", "apiVersion:"],
};

/**
 * Extract all code blocks from HTML, detecting language from classes, data attributes, or content.
 */
export function extractCodeBlocks(html: string): CodeBlock[] {
  const $ = cheerio.load(html);
  const blocks: CodeBlock[] = [];
  const seen = new Set<string>();

  $("pre").each((_, preEl) => {
    const $pre = $(preEl);
    const $code = $pre.find("code");
    const target = $code.length > 0 ? $code : $pre;

    const content = target.text().trim();
    if (!content || seen.has(content)) return;
    seen.add(content);

    const language = detectLanguage(target, $, content);

    blocks.push({
      language,
      content,
      lineCount: content.split("\n").length,
    });
  });

  // Also check inline code blocks that might be significant
  $("code").each((_, el) => {
    const $el = $(el);
    // Skip if parent is pre (already captured)
    if ($el.parent("pre").length > 0) return;

    const content = $el.text().trim();
    if (!content || content.length < 20 || seen.has(content)) return;

    // Only capture multi-line inline code
    if (content.split("\n").length < 2) return;

    seen.add(content);
    const language = detectLanguage($el, $, content);

    blocks.push({
      language,
      content,
      lineCount: content.split("\n").length,
    });
  });

  return blocks;
}

function detectLanguage(
  el: cheerio.Cheerio<cheerio.AnyNode>,
  $: cheerio.CheerioAPI,
  content: string
): string {
  // Strategy 1: class attribute
  const classes = (el.attr("class") || "").split(/\s+/);
  for (const cls of classes) {
    for (const prefix of ["language-", "lang-", "highlight-", "brush-"]) {
      if (cls.startsWith(prefix)) {
        return normalizeLanguage(cls.substring(prefix.length));
      }
    }
  }

  // Also check parent classes
  const parentClasses = (el.parent().attr("class") || "").split(/\s+/);
  for (const cls of parentClasses) {
    for (const prefix of ["language-", "lang-", "highlight-"]) {
      if (cls.startsWith(prefix)) {
        return normalizeLanguage(cls.substring(prefix.length));
      }
    }
  }

  // Strategy 2: data attributes
  const dataLang =
    el.attr("data-lang") ||
    el.attr("data-language") ||
    el.parent().attr("data-lang") ||
    el.parent().attr("data-language") ||
    "";
  if (dataLang) {
    return normalizeLanguage(dataLang);
  }

  // Strategy 3: content heuristics
  return detectLanguageFromContent(content);
}

function detectLanguageFromContent(content: string): string {
  const scores: Record<string, number> = {};

  for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        score++;
      }
    }
    if (score > 0) {
      scores[lang] = score;
    }
  }

  if (Object.keys(scores).length === 0) return "";

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestLang, bestScore] = sorted[0];

  // Require at least 2 keyword matches for confidence
  if (bestScore < 2) return "";

  return bestLang;
}

function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();

  const aliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    yml: "yaml",
    "c++": "cpp",
    "c#": "csharp",
    cs: "csharp",
    kt: "kotlin",
    rs: "rust",
    md: "markdown",
    jsx: "javascript",
    tsx: "typescript",
  };

  return aliases[normalized] || normalized;
}
