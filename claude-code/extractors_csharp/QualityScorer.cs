using System.Text.RegularExpressions;

namespace Researchers.Extractors;

/// <summary>
/// Scores extraction quality on a 0.0-1.0 scale.
/// </summary>
public partial class QualityScorer
{
    [GeneratedRegex(@"^#{1,6}\s+", RegexOptions.Multiline)]
    private static partial Regex HeadingRegex();

    [GeneratedRegex(@"```")]
    private static partial Regex CodeBlockRegex();

    [GeneratedRegex(@"\[[^\]]+\]\([^)]+\)")]
    private static partial Regex LinkRegex();

    [GeneratedRegex(@"^\s*[-*]\s+", RegexOptions.Multiline)]
    private static partial Regex ListRegex();

    /// <summary>
    /// Score content quality from 0.0 to 1.0.
    /// </summary>
    public static double Score(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return 0.0;

        var lengthScore = ScoreLength(content);
        var headingScore = ScoreHeadings(content);
        var codeScore = ScoreCodeBlocks(content);
        var listScore = ScoreLists(content);
        var linkScore = ScoreLinks(content);
        var paragraphScore = ScoreParagraphs(content);

        var weighted = 0.25 * lengthScore
            + 0.20 * headingScore
            + 0.15 * codeScore
            + 0.15 * listScore
            + 0.10 * linkScore
            + 0.15 * paragraphScore;

        return Math.Clamp(weighted, 0.0, 1.0);
    }

    private static double ScoreLength(string content)
    {
        var wordCount = content.Split(
            Array.Empty<char>(),
            StringSplitOptions.RemoveEmptyEntries
        ).Length;

        return wordCount switch
        {
            >= 1000 => 1.0,
            >= 500 => 0.7 + 0.3 * ((wordCount - 500) / 500.0),
            >= 100 => 0.3 + 0.4 * ((wordCount - 100) / 400.0),
            > 0 => 0.3 * (wordCount / 100.0),
            _ => 0.0
        };
    }

    private static double ScoreHeadings(string content)
    {
        var count = HeadingRegex().Matches(content).Count;
        if (count == 0) return 0.0;

        var score = 0.4;
        if (count >= 3) score += 0.3;
        if (content.Contains("\n# ") || content.StartsWith("# ")) score += 0.3;

        return Math.Min(score, 1.0);
    }

    private static double ScoreCodeBlocks(string content)
    {
        var delimiterCount = CodeBlockRegex().Matches(content).Count;
        var blockCount = delimiterCount / 2;

        if (blockCount == 0) return 0.0;

        var score = 0.5;
        if (blockCount >= 2) score += 0.2;
        if (blockCount >= 4) score += 0.3;

        return Math.Min(score, 1.0);
    }

    private static double ScoreLists(string content)
    {
        var count = ListRegex().Matches(content).Count;
        if (count == 0) return 0.0;
        return Math.Min(count / 5.0, 1.0);
    }

    private static double ScoreLinks(string content)
    {
        var count = LinkRegex().Matches(content).Count;
        if (count == 0) return 0.0;
        return Math.Min(count / 5.0, 1.0);
    }

    private static double ScoreParagraphs(string content)
    {
        var lines = content.Split('\n');
        var paragraphCount = 0;
        var inParagraph = false;

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (!string.IsNullOrEmpty(trimmed)
                && !trimmed.StartsWith('#')
                && !trimmed.StartsWith("```")
                && !trimmed.StartsWith("- ")
                && !trimmed.StartsWith("* ")
                && !trimmed.StartsWith("> "))
            {
                if (!inParagraph)
                {
                    paragraphCount++;
                    inParagraph = true;
                }
            }
            else
            {
                inParagraph = false;
            }
        }

        return paragraphCount switch
        {
            >= 5 => 1.0,
            >= 3 => 0.7,
            >= 1 => 0.4,
            _ => 0.0
        };
    }
}
