# Scores extraction quality on a 0.0-1.0 scale.
class QualityScorer
  # Score content quality.
  #
  # @param content [String] Markdown content to score
  # @return [Float] Quality score from 0.0 to 1.0
  def score(content)
    return 0.0 if content.nil? || content.strip.empty?

    length_score = score_length(content)
    heading_score = score_headings(content)
    code_score = score_code_blocks(content)
    list_score = score_lists(content)
    link_score = score_links(content)
    paragraph_score = score_paragraphs(content)

    weighted = 0.25 * length_score +
               0.20 * heading_score +
               0.15 * code_score +
               0.15 * list_score +
               0.10 * link_score +
               0.15 * paragraph_score

    [[weighted, 0.0].max, 1.0].min
  end

  # Get detailed score breakdown.
  #
  # @param content [String] Markdown content to score
  # @return [Hash] Score breakdown with individual metrics
  def score_detailed(content)
    {
      overall: score(content),
      length: score_length(content || ""),
      headings: score_headings(content || ""),
      code_blocks: score_code_blocks(content || ""),
      lists: score_lists(content || ""),
      links: score_links(content || ""),
      paragraphs: score_paragraphs(content || "")
    }
  end

  private

  def score_length(content)
    word_count = content.split(/\s+/).length

    if word_count >= 1000
      1.0
    elsif word_count >= 500
      0.7 + 0.3 * ((word_count - 500) / 500.0)
    elsif word_count >= 100
      0.3 + 0.4 * ((word_count - 100) / 400.0)
    elsif word_count > 0
      0.3 * (word_count / 100.0)
    else
      0.0
    end
  end

  def score_headings(content)
    heading_count = content.scan(/^#{1,6}\s+/m).length
    return 0.0 if heading_count.zero?

    score = 0.4
    score += 0.3 if heading_count >= 3
    score += 0.3 if content.include?("\n# ") || content.start_with?("# ")

    [score, 1.0].min
  end

  def score_code_blocks(content)
    block_count = content.scan("```").length / 2
    return 0.0 if block_count.zero?

    score = 0.5
    score += 0.2 if block_count >= 2
    score += 0.3 if block_count >= 4

    [score, 1.0].min
  end

  def score_lists(content)
    list_count = content.scan(/^\s*[-*]\s+/m).length
    return 0.0 if list_count.zero?

    [list_count / 5.0, 1.0].min
  end

  def score_links(content)
    link_count = content.scan(/\[[^\]]+\]\([^)]+\)/).length
    return 0.0 if link_count.zero?

    [link_count / 5.0, 1.0].min
  end

  def score_paragraphs(content)
    lines = content.split("\n")
    paragraph_count = 0
    in_paragraph = false

    lines.each do |line|
      trimmed = line.strip
      if !trimmed.empty? &&
         !trimmed.start_with?("#") &&
         !trimmed.start_with?("```") &&
         !trimmed.start_with?("- ") &&
         !trimmed.start_with?("* ") &&
         !trimmed.start_with?("> ")
        unless in_paragraph
          paragraph_count += 1
          in_paragraph = true
        end
      else
        in_paragraph = false
      end
    end

    if paragraph_count >= 5
      1.0
    elsif paragraph_count >= 3
      0.7
    elsif paragraph_count >= 1
      0.4
    else
      0.0
    end
  end
end
