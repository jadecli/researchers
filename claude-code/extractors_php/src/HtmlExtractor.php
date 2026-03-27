<?php

declare(strict_types=1);

namespace Researchers\Extractors;

use DOMDocument;
use DOMNode;
use DOMXPath;

/**
 * Extracts structured content from HTML using PHP's DOMDocument.
 */
class HtmlExtractor
{
    private const NAV_TAGS = ['nav', 'header', 'footer'];
    private const STRIP_TAGS = ['script', 'style', 'noscript', 'iframe', 'svg'];
    private const CONTENT_SELECTORS = [
        '//main',
        '//article',
        '//*[@role="main"]',
        '//*[@id="content"]',
        '//*[@id="main-content"]',
        '//*[contains(@class, "content")]',
        '//*[contains(@class, "main-content")]',
        '//*[contains(@class, "post-content")]',
        '//*[contains(@class, "markdown-body")]',
        '//*[contains(@class, "docs-content")]',
    ];

    /**
     * Extract structured content from HTML.
     *
     * @param string $html Raw HTML string
     * @return array{title: string, content: string, headings: array, codeBlocks: array, links: array}
     */
    public function extract(string $html): array
    {
        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $doc->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'), LIBXML_NOERROR);
        libxml_clear_errors();

        $xpath = new DOMXPath($doc);

        // Remove non-content elements
        $this->removeElements($xpath, self::STRIP_TAGS);
        $this->removeElements($xpath, self::NAV_TAGS);
        $this->removeByXPath($xpath, '//*[contains(@class, "nav")]');
        $this->removeByXPath($xpath, '//*[contains(@class, "sidebar")]');
        $this->removeByXPath($xpath, '//*[contains(@class, "menu")]');
        $this->removeByXPath($xpath, '//*[contains(@class, "breadcrumb")]');

        $mainContent = $this->findMainContent($xpath, $doc);
        $title = $this->extractTitle($xpath, $doc);
        $content = $this->nodeToMarkdown($mainContent);
        $headings = $this->extractHeadings($mainContent, $xpath);
        $codeBlocks = $this->extractCodeBlocks($mainContent, $xpath);
        $links = $this->extractLinks($mainContent, $xpath);

        return [
            'title' => $title,
            'content' => trim($content),
            'headings' => $headings,
            'codeBlocks' => $codeBlocks,
            'links' => $links,
        ];
    }

    private function removeElements(DOMXPath $xpath, array $tagNames): void
    {
        foreach ($tagNames as $tag) {
            $nodes = $xpath->query("//{$tag}");
            if ($nodes === false) continue;
            foreach ($nodes as $node) {
                $node->parentNode?->removeChild($node);
            }
        }
    }

    private function removeByXPath(DOMXPath $xpath, string $query): void
    {
        $nodes = $xpath->query($query);
        if ($nodes === false) return;
        foreach ($nodes as $node) {
            $node->parentNode?->removeChild($node);
        }
    }

    private function extractTitle(DOMXPath $xpath, DOMDocument $doc): string
    {
        // OG title
        $ogTitle = $xpath->query('//meta[@property="og:title"]/@content');
        if ($ogTitle !== false && $ogTitle->length > 0) {
            $val = trim($ogTitle->item(0)->nodeValue ?? '');
            if ($val !== '') return $val;
        }

        // <title> tag
        $titleNodes = $xpath->query('//title');
        if ($titleNodes !== false && $titleNodes->length > 0) {
            $val = trim($titleNodes->item(0)->textContent ?? '');
            if ($val !== '') return $val;
        }

        // First h1
        $h1Nodes = $xpath->query('//h1');
        if ($h1Nodes !== false && $h1Nodes->length > 0) {
            return trim($h1Nodes->item(0)->textContent ?? '');
        }

        return '';
    }

    private function findMainContent(DOMXPath $xpath, DOMDocument $doc): DOMNode
    {
        foreach (self::CONTENT_SELECTORS as $selector) {
            $nodes = $xpath->query($selector);
            if ($nodes !== false && $nodes->length > 0) {
                $node = $nodes->item(0);
                if ($node !== null && strlen(trim($node->textContent ?? '')) > 100) {
                    return $node;
                }
            }
        }

        $body = $xpath->query('//body');
        if ($body !== false && $body->length > 0) {
            return $body->item(0);
        }

        return $doc;
    }

    private function nodeToMarkdown(DOMNode $node): string
    {
        $output = '';

        foreach ($node->childNodes as $child) {
            if ($child->nodeType === XML_TEXT_NODE) {
                $text = trim($child->textContent ?? '');
                if ($text !== '') {
                    $output .= $text;
                }
                continue;
            }

            if ($child->nodeType !== XML_ELEMENT_NODE) continue;

            $tag = strtolower($child->nodeName);

            switch ($tag) {
                case 'h1': $output .= "\n\n# " . trim($child->textContent ?? '') . "\n\n"; break;
                case 'h2': $output .= "\n\n## " . trim($child->textContent ?? '') . "\n\n"; break;
                case 'h3': $output .= "\n\n### " . trim($child->textContent ?? '') . "\n\n"; break;
                case 'h4': $output .= "\n\n#### " . trim($child->textContent ?? '') . "\n\n"; break;
                case 'h5': $output .= "\n\n##### " . trim($child->textContent ?? '') . "\n\n"; break;
                case 'h6': $output .= "\n\n###### " . trim($child->textContent ?? '') . "\n\n"; break;
                case 'p':
                    $text = trim($child->textContent ?? '');
                    if ($text !== '') {
                        $output .= "\n\n{$text}\n\n";
                    }
                    break;
                case 'pre':
                    $lang = $this->getCodeLanguage($child);
                    $code = $child->textContent ?? '';
                    $output .= "\n\n```{$lang}\n{$code}\n```\n\n";
                    break;
                case 'li':
                    $output .= "\n- " . trim($child->textContent ?? '');
                    break;
                case 'ul':
                case 'ol':
                case 'div':
                case 'section':
                case 'article':
                case 'main':
                    $output .= $this->nodeToMarkdown($child);
                    break;
                default:
                    $output .= $this->nodeToMarkdown($child);
                    break;
            }
        }

        return $output;
    }

    /**
     * @return array<array{level: int, text: string}>
     */
    private function extractHeadings(DOMNode $node, DOMXPath $xpath): array
    {
        $headings = [];
        $nodes = $xpath->query('.//h1|.//h2|.//h3|.//h4|.//h5|.//h6', $node);
        if ($nodes === false) return $headings;

        foreach ($nodes as $h) {
            $level = (int) substr($h->nodeName, 1);
            $headings[] = [
                'level' => $level,
                'text' => trim($h->textContent ?? ''),
            ];
        }

        return $headings;
    }

    /**
     * @return array<array{language: string, content: string, lineCount: int}>
     */
    private function extractCodeBlocks(DOMNode $node, DOMXPath $xpath): array
    {
        $blocks = [];
        $nodes = $xpath->query('.//pre', $node);
        if ($nodes === false) return $blocks;

        foreach ($nodes as $pre) {
            $content = $pre->textContent ?? '';
            $blocks[] = [
                'language' => $this->getCodeLanguage($pre),
                'content' => $content,
                'lineCount' => substr_count($content, "\n") + 1,
            ];
        }

        return $blocks;
    }

    /**
     * @return array<array{text: string, href: string, isInternal: bool}>
     */
    private function extractLinks(DOMNode $node, DOMXPath $xpath): array
    {
        $links = [];
        $nodes = $xpath->query('.//a[@href]', $node);
        if ($nodes === false) return $links;

        foreach ($nodes as $a) {
            $href = $a->getAttribute('href');
            if (str_starts_with($href, '#') || str_starts_with($href, 'javascript:')) continue;

            $links[] = [
                'text' => trim($a->textContent ?? ''),
                'href' => $href,
                'isInternal' => str_starts_with($href, '/') || str_starts_with($href, './') || str_starts_with($href, '../'),
            ];
        }

        return $links;
    }

    private function getCodeLanguage(DOMNode $preNode): string
    {
        foreach ($preNode->childNodes as $child) {
            if ($child->nodeType === XML_ELEMENT_NODE && strtolower($child->nodeName) === 'code') {
                $class = $child->getAttribute('class') ?? '';
                foreach (explode(' ', $class) as $cls) {
                    if (str_starts_with($cls, 'language-')) return substr($cls, 9);
                    if (str_starts_with($cls, 'lang-')) return substr($cls, 5);
                    if (str_starts_with($cls, 'highlight-')) return substr($cls, 10);
                }
                $dataLang = $child->getAttribute('data-lang');
                if ($dataLang !== '') return $dataLang;
                $dataLanguage = $child->getAttribute('data-language');
                if ($dataLanguage !== '') return $dataLanguage;
            }
        }

        return '';
    }
}
