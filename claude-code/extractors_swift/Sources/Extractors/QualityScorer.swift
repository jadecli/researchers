import Foundation

/// Scores extraction quality on a 0.0-1.0 scale.
public struct QualityScorer {

    public init() {}

    /// Score content quality.
    /// - Parameter content: Markdown content to score
    /// - Returns: Quality score from 0.0 to 1.0
    public func score(content: String) -> Double {
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return 0.0
        }

        let lengthScore = scoreLength(content: content)
        let headingScore = scoreHeadings(content: content)
        let codeScore = scoreCodeBlocks(content: content)
        let listScore = scoreLists(content: content)
        let linkScore = scoreLinks(content: content)
        let paragraphScore = scoreParagraphs(content: content)

        let weighted = 0.25 * lengthScore
            + 0.20 * headingScore
            + 0.15 * codeScore
            + 0.15 * listScore
            + 0.10 * linkScore
            + 0.15 * paragraphScore

        return min(max(weighted, 0.0), 1.0)
    }

    private func scoreLength(content: String) -> Double {
        let wordCount = content.split(whereSeparator: { $0.isWhitespace }).count

        switch wordCount {
        case 1000...: return 1.0
        case 500..<1000: return 0.7 + 0.3 * Double(wordCount - 500) / 500.0
        case 100..<500: return 0.3 + 0.4 * Double(wordCount - 100) / 400.0
        case 1..<100: return 0.3 * Double(wordCount) / 100.0
        default: return 0.0
        }
    }

    private func scoreHeadings(content: String) -> Double {
        let lines = content.split(separator: "\n")
        let headingCount = lines.filter { $0.trimmingCharacters(in: .whitespaces).hasPrefix("#") }.count

        guard headingCount > 0 else { return 0.0 }

        var score = 0.4
        if headingCount >= 3 { score += 0.3 }
        if content.contains("\n# ") || content.hasPrefix("# ") { score += 0.3 }

        return min(score, 1.0)
    }

    private func scoreCodeBlocks(content: String) -> Double {
        let delimiterCount = content.components(separatedBy: "```").count - 1
        let blockCount = delimiterCount / 2

        guard blockCount > 0 else { return 0.0 }

        var score = 0.5
        if blockCount >= 2 { score += 0.2 }
        if blockCount >= 4 { score += 0.3 }

        return min(score, 1.0)
    }

    private func scoreLists(content: String) -> Double {
        let lines = content.split(separator: "\n")
        let listCount = lines.filter { line in
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            return trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ")
        }.count

        guard listCount > 0 else { return 0.0 }
        return min(Double(listCount) / 5.0, 1.0)
    }

    private func scoreLinks(content: String) -> Double {
        var count = 0
        var searchRange = content.startIndex..<content.endIndex

        while let range = content.range(of: "](", range: searchRange) {
            count += 1
            searchRange = range.upperBound..<content.endIndex
        }

        guard count > 0 else { return 0.0 }
        return min(Double(count) / 5.0, 1.0)
    }

    private func scoreParagraphs(content: String) -> Double {
        let lines = content.split(separator: "\n", omittingEmptySubsequences: false)
        var paragraphCount = 0
        var inParagraph = false

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty
                && !trimmed.hasPrefix("#")
                && !trimmed.hasPrefix("```")
                && !trimmed.hasPrefix("- ")
                && !trimmed.hasPrefix("* ")
                && !trimmed.hasPrefix("> ") {
                if !inParagraph {
                    paragraphCount += 1
                    inParagraph = true
                }
            } else {
                inParagraph = false
            }
        }

        switch paragraphCount {
        case 5...: return 1.0
        case 3..<5: return 0.7
        case 1..<3: return 0.4
        default: return 0.0
        }
    }
}
