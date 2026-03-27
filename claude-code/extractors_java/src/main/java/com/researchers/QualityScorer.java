package com.researchers;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scores extraction quality on a 0.0-1.0 scale.
 */
public class QualityScorer {

    private static final Pattern HEADING_PATTERN = Pattern.compile("^#{1,6}\\s+", Pattern.MULTILINE);
    private static final Pattern CODE_BLOCK_PATTERN = Pattern.compile("```");
    private static final Pattern LINK_PATTERN = Pattern.compile("\\[[^\\]]+\\]\\([^)]+\\)");
    private static final Pattern LIST_PATTERN = Pattern.compile("^\\s*[-*]\\s+", Pattern.MULTILINE);

    /**
     * Score the quality of extracted content.
     *
     * @param content Markdown content to score
     * @return Quality score from 0.0 to 1.0
     */
    public double score(String content) {
        if (content == null || content.trim().isEmpty()) {
            return 0.0;
        }

        double lengthScore = scoreLenth(content);
        double headingScore = scoreHeadings(content);
        double codeScore = scoreCodeBlocks(content);
        double listScore = scoreLists(content);
        double linkScore = scoreLinks(content);
        double paragraphScore = scoreParagraphs(content);

        double weighted = 0.25 * lengthScore
                + 0.20 * headingScore
                + 0.15 * codeScore
                + 0.15 * listScore
                + 0.10 * linkScore
                + 0.15 * paragraphScore;

        return Math.min(Math.max(weighted, 0.0), 1.0);
    }

    /**
     * Get a detailed breakdown of quality metrics.
     *
     * @param content Markdown content to score
     * @return Array of [overall, length, headings, code, lists, links, paragraphs]
     */
    public double[] scoreDetailed(String content) {
        if (content == null || content.trim().isEmpty()) {
            return new double[]{0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0};
        }

        double length = scoreLenth(content);
        double headings = scoreHeadings(content);
        double code = scoreCodeBlocks(content);
        double lists = scoreLists(content);
        double links = scoreLinks(content);
        double paragraphs = scoreParagraphs(content);
        double overall = score(content);

        return new double[]{overall, length, headings, code, lists, links, paragraphs};
    }

    private double scoreLenth(String content) {
        int wordCount = content.split("\\s+").length;

        if (wordCount >= 1000) return 1.0;
        if (wordCount >= 500) return 0.7 + 0.3 * ((wordCount - 500) / 500.0);
        if (wordCount >= 100) return 0.3 + 0.4 * ((wordCount - 100) / 400.0);
        if (wordCount > 0) return 0.3 * (wordCount / 100.0);
        return 0.0;
    }

    private double scoreHeadings(String content) {
        Matcher matcher = HEADING_PATTERN.matcher(content);
        int count = 0;
        while (matcher.find()) count++;

        if (count == 0) return 0.0;

        double score = 0.4;
        if (count >= 3) score += 0.3;
        if (content.contains("\n# ") || content.startsWith("# ")) score += 0.3;

        return Math.min(score, 1.0);
    }

    private double scoreCodeBlocks(String content) {
        Matcher matcher = CODE_BLOCK_PATTERN.matcher(content);
        int count = 0;
        while (matcher.find()) count++;
        int blockCount = count / 2;

        if (blockCount == 0) return 0.0;

        double score = 0.5;
        if (blockCount >= 2) score += 0.2;
        if (blockCount >= 4) score += 0.3;

        return Math.min(score, 1.0);
    }

    private double scoreLists(String content) {
        Matcher matcher = LIST_PATTERN.matcher(content);
        int count = 0;
        while (matcher.find()) count++;

        if (count == 0) return 0.0;
        return Math.min(count / 5.0, 1.0);
    }

    private double scoreLinks(String content) {
        Matcher matcher = LINK_PATTERN.matcher(content);
        int count = 0;
        while (matcher.find()) count++;

        if (count == 0) return 0.0;
        return Math.min(count / 5.0, 1.0);
    }

    private double scoreParagraphs(String content) {
        String[] lines = content.split("\n");
        int paragraphCount = 0;
        boolean inParagraph = false;

        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()
                    && !trimmed.startsWith("#")
                    && !trimmed.startsWith("```")
                    && !trimmed.startsWith("- ")
                    && !trimmed.startsWith("* ")
                    && !trimmed.startsWith("> ")) {
                if (!inParagraph) {
                    paragraphCount++;
                    inParagraph = true;
                }
            } else {
                inParagraph = false;
            }
        }

        if (paragraphCount >= 5) return 1.0;
        if (paragraphCount >= 3) return 0.7;
        if (paragraphCount >= 1) return 0.4;
        return 0.0;
    }
}
