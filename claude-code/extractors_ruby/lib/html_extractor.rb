require "nokogiri"

# Extracts structured content from HTML using Nokogiri.
class HtmlExtractor
  NAV_SELECTORS = %w[nav header footer [role=navigation] .nav .sidebar .menu .breadcrumb].freeze
  STRIP_TAGS = %w[script style noscript iframe svg].freeze
  CONTENT_SELECTORS = [
    "main", "article", '[role="main"]', "#content", "#main-content",
    ".content", ".main-content", ".post-content", ".markdown-body", ".docs-content"
  ].freeze

  # Extract structured content from HTML.
  #
  # @param html [String] Raw HTML string
  # @return [Hash] Extracted content with :title, :content, :headings, :code_blocks, :links
  def extract(html)
    doc = Nokogiri::HTML(html)

    # Remove non-content elements
    STRIP_TAGS.each { |tag| doc.css(tag).remove }
    NAV_SELECTORS.each { |sel| doc.css(sel).remove }

    main_content = find_main_content(doc)
    title = extract_title(doc)
    content = node_to_markdown(main_content)
    headings = extract_headings(main_content)
    code_blocks = extract_code_blocks(main_content)
    links = extract_links(main_content)

    {
      title: title,
      content: content.strip,
      headings: headings,
      code_blocks: code_blocks,
      links: links
    }
  end

  private

  def extract_title(doc)
    # OG title
    og = doc.at_css('meta[property="og:title"]')
    return og["content"].strip if og && og["content"] && !og["content"].strip.empty?

    # <title> tag
    title_el = doc.at_css("title")
    return title_el.text.strip if title_el && !title_el.text.strip.empty?

    # First h1
    h1 = doc.at_css("h1")
    return h1.text.strip if h1

    ""
  end

  def find_main_content(doc)
    CONTENT_SELECTORS.each do |selector|
      el = doc.at_css(selector)
      return el if el && el.text.strip.length > 100
    end

    doc.at_css("body") || doc
  end

  def node_to_markdown(node)
    output = ""

    node.css("h1, h2, h3, h4, h5, h6, p, pre, li, blockquote").each do |child|
      tag = child.name.downcase

      case tag
      when "h1" then output += "\n\n# #{child.text.strip}\n\n"
      when "h2" then output += "\n\n## #{child.text.strip}\n\n"
      when "h3" then output += "\n\n### #{child.text.strip}\n\n"
      when "h4" then output += "\n\n#### #{child.text.strip}\n\n"
      when "h5" then output += "\n\n##### #{child.text.strip}\n\n"
      when "h6" then output += "\n\n###### #{child.text.strip}\n\n"
      when "p"
        text = child.text.strip
        output += "\n\n#{text}\n\n" unless text.empty?
      when "pre"
        lang = get_code_language(child)
        code = child.text
        output += "\n\n```#{lang}\n#{code}\n```\n\n"
      when "li"
        output += "\n- #{child.text.strip}"
      when "blockquote"
        child.text.strip.split("\n").each do |line|
          output += "> #{line}\n"
        end
        output += "\n"
      end
    end

    clean_markdown(output)
  end

  def extract_headings(node)
    node.css("h1, h2, h3, h4, h5, h6").map do |h|
      {
        level: h.name[1].to_i,
        text: h.text.strip,
        id: h["id"] || ""
      }
    end
  end

  def extract_code_blocks(node)
    node.css("pre").map do |pre|
      content = pre.text
      {
        language: get_code_language(pre),
        content: content,
        line_count: content.split("\n").length
      }
    end
  end

  def extract_links(node)
    node.css("a[href]").filter_map do |a|
      href = a["href"]
      next if href.start_with?("#") || href.start_with?("javascript:")

      {
        text: a.text.strip,
        href: href,
        is_internal: href.start_with?("/") || href.start_with?("./") || href.start_with?("../")
      }
    end
  end

  def get_code_language(pre_node)
    code = pre_node.at_css("code")
    return "" unless code

    (code["class"] || "").split.each do |cls|
      return cls[9..] if cls.start_with?("language-")
      return cls[5..] if cls.start_with?("lang-")
      return cls[10..] if cls.start_with?("highlight-")
    end

    data_lang = code["data-lang"]
    return data_lang if data_lang && !data_lang.empty?

    data_language = code["data-language"]
    return data_language if data_language && !data_language.empty?

    ""
  end

  def clean_markdown(md)
    md.gsub(/\n{4,}/, "\n\n\n")
       .split("\n")
       .map(&:rstrip)
       .join("\n")
       .strip
  end
end
