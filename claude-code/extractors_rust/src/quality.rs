//! Fast quality scoring for extracted content.

/// Score the quality of extracted content on a 0.0-1.0 scale.
///
/// Evaluates:
/// - Content length
/// - Heading presence and hierarchy
/// - Code block presence
/// - List presence
/// - Link presence
/// - Paragraph structure
pub fn score_extraction(content: &str) -> f64 {
    if content.is_empty() {
        return 0.0;
    }

    let lines: Vec<&str> = content.lines().collect();
    let word_count = content.split_whitespace().count();

    let length_score = score_length(word_count);
    let heading_score = score_headings(&lines);
    let code_score = score_code_blocks(content);
    let list_score = score_lists(&lines);
    let link_score = score_links(content);
    let paragraph_score = score_paragraphs(&lines);

    let weighted = 0.25 * length_score
        + 0.20 * heading_score
        + 0.15 * code_score
        + 0.15 * list_score
        + 0.10 * link_score
        + 0.15 * paragraph_score;

    weighted.clamp(0.0, 1.0)
}

fn score_length(word_count: usize) -> f64 {
    if word_count >= 1000 {
        1.0
    } else if word_count >= 500 {
        0.7 + 0.3 * ((word_count - 500) as f64 / 500.0)
    } else if word_count >= 100 {
        0.3 + 0.4 * ((word_count - 100) as f64 / 400.0)
    } else if word_count > 0 {
        0.3 * (word_count as f64 / 100.0)
    } else {
        0.0
    }
}

fn score_headings(lines: &[&str]) -> f64 {
    let headings: Vec<usize> = lines
        .iter()
        .filter(|l| l.trim_start().starts_with('#'))
        .map(|l| {
            let trimmed = l.trim_start();
            trimmed.chars().take_while(|c| *c == '#').count()
        })
        .collect();

    if headings.is_empty() {
        return 0.0;
    }

    let mut score = 0.3; // Base score for having headings

    // Bonus for multiple headings
    if headings.len() >= 3 {
        score += 0.2;
    }

    // Check hierarchy (no jumps > 1 level)
    let mut hierarchy_ok = true;
    for i in 1..headings.len() {
        if headings[i] > headings[i - 1] + 1 {
            hierarchy_ok = false;
            break;
        }
    }

    if hierarchy_ok {
        score += 0.3;
    }

    // Bonus for having h1
    if headings.contains(&1) {
        score += 0.2;
    }

    score.min(1.0)
}

fn score_code_blocks(content: &str) -> f64 {
    let block_count = content.matches("```").count() / 2;

    if block_count == 0 {
        return 0.0;
    }

    let mut score = 0.4; // Base score for having code

    // Bonus for multiple blocks
    if block_count >= 2 {
        score += 0.2;
    }

    // Bonus for language-tagged blocks
    let lang_blocks = content
        .split("```")
        .enumerate()
        .filter(|(i, s)| i % 2 == 1 && !s.starts_with('\n'))
        .count();

    if lang_blocks > 0 {
        score += 0.4;
    }

    score.min(1.0)
}

fn score_lists(lines: &[&str]) -> f64 {
    let list_items: usize = lines
        .iter()
        .filter(|l| {
            let trimmed = l.trim();
            trimmed.starts_with("- ")
                || trimmed.starts_with("* ")
                || trimmed.starts_with("1. ")
                || trimmed.starts_with("2. ")
                || trimmed.starts_with("3. ")
        })
        .count();

    if list_items == 0 {
        return 0.0;
    }

    let score = (list_items as f64 / 5.0).min(1.0);
    score
}

fn score_links(content: &str) -> f64 {
    // Count markdown links [text](url)
    let link_count = content.matches("](").count();

    if link_count == 0 {
        return 0.0;
    }

    (link_count as f64 / 5.0).min(1.0)
}

fn score_paragraphs(lines: &[&str]) -> f64 {
    let mut paragraph_count = 0;
    let mut in_paragraph = false;

    for line in lines {
        let trimmed = line.trim();
        if !trimmed.is_empty()
            && !trimmed.starts_with('#')
            && !trimmed.starts_with("```")
            && !trimmed.starts_with("- ")
            && !trimmed.starts_with("* ")
            && !trimmed.starts_with("> ")
        {
            if !in_paragraph {
                paragraph_count += 1;
                in_paragraph = true;
            }
        } else {
            in_paragraph = false;
        }
    }

    if paragraph_count >= 5 {
        1.0
    } else if paragraph_count >= 3 {
        0.7
    } else if paragraph_count >= 1 {
        0.4
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_content() {
        assert_eq!(score_extraction(""), 0.0);
    }

    #[test]
    fn test_high_quality_content() {
        let content = r#"# Main Title

This is a well-structured document with multiple sections and rich content.

## Introduction

This section introduces the main concepts. Here is a [link](https://example.com) to more information.

## Code Example

```python
def hello():
    print("Hello, world!")
```

## Features

- Feature one with description
- Feature two with more details
- Feature three for completeness
- Feature four is also important
- Feature five rounds out the list

## Conclusion

This document demonstrates proper structure with headings, paragraphs, code blocks, and lists.
More text to add word count and make this a comprehensive document that covers all the important
topics and provides sufficient detail for readers to understand the material thoroughly.
"#;
        let score = score_extraction(content);
        assert!(score > 0.5, "Expected high score, got {}", score);
    }

    #[test]
    fn test_minimal_content() {
        let score = score_extraction("Hello world");
        assert!(score < 0.3, "Expected low score for minimal content, got {}", score);
    }

    #[test]
    fn test_score_range() {
        let score = score_extraction("# Title\n\nSome paragraph text here.\n\n- Item 1\n- Item 2");
        assert!(score >= 0.0 && score <= 1.0, "Score out of range: {}", score);
    }
}
