--- HTML to text extractor module.
--- Provides basic tag stripping and text extraction from HTML content.

local M = {}

--- Block-level HTML tags that should add newlines.
local BLOCK_TAGS = {
    ["p"] = true, ["div"] = true, ["section"] = true, ["article"] = true,
    ["main"] = true, ["h1"] = true, ["h2"] = true, ["h3"] = true,
    ["h4"] = true, ["h5"] = true, ["h6"] = true, ["li"] = true,
    ["br"] = true, ["hr"] = true, ["blockquote"] = true,
    ["pre"] = true, ["table"] = true, ["tr"] = true,
}

--- Tags to completely remove (including content).
local REMOVE_TAGS = {
    ["script"] = true, ["style"] = true, ["noscript"] = true,
    ["iframe"] = true, ["svg"] = true, ["nav"] = true,
    ["header"] = true, ["footer"] = true,
}

--- Heading tags for markdown conversion.
local HEADING_PREFIXES = {
    ["h1"] = "# ", ["h2"] = "## ", ["h3"] = "### ",
    ["h4"] = "#### ", ["h5"] = "##### ", ["h6"] = "###### ",
}

--- Remove content within specified tags.
--- @param html string The HTML content
--- @param tag string The tag name to remove
--- @return string The HTML with tag content removed
local function remove_tag_content(html, tag)
    local pattern = "<" .. tag .. "[^>]*>.-</" .. tag .. ">"
    local result = html:gsub(pattern, "")
    result = result:gsub("<" .. tag .. "[^>]*/?>", "")
    return result
end

--- Decode common HTML entities.
--- @param text string Text with HTML entities
--- @return string Decoded text
local function decode_entities(text)
    local entities = {
        ["&amp;"] = "&",
        ["&lt;"] = "<",
        ["&gt;"] = ">",
        ["&quot;"] = '"',
        ["&apos;"] = "'",
        ["&#39;"] = "'",
        ["&nbsp;"] = " ",
        ["&ndash;"] = "-",
        ["&mdash;"] = "--",
        ["&laquo;"] = "<<",
        ["&raquo;"] = ">>",
        ["&copy;"] = "(c)",
        ["&reg;"] = "(R)",
    }

    for entity, replacement in pairs(entities) do
        text = text:gsub(entity, replacement)
    end

    -- Numeric entities
    text = text:gsub("&#(%d+);", function(n)
        local num = tonumber(n)
        if num and num >= 32 and num <= 126 then
            return string.char(num)
        end
        return ""
    end)

    return text
end

--- Convert HTML to plain text with basic markdown formatting.
--- @param html string The HTML content to convert
--- @return string Extracted text content
function M.html_to_text(html)
    if not html or html == "" then
        return ""
    end

    local text = html

    -- Remove tags that should be stripped entirely (with content)
    for tag, _ in pairs(REMOVE_TAGS) do
        text = remove_tag_content(text, tag)
    end

    -- Convert headings to markdown
    for tag, prefix in pairs(HEADING_PREFIXES) do
        text = text:gsub(
            "<" .. tag .. "[^>]*>(.-)</" .. tag .. ">",
            "\n\n" .. prefix .. "%1\n\n"
        )
    end

    -- Convert <pre><code> blocks
    text = text:gsub(
        '<pre[^>]*>%s*<code[^>]*>(.-)</code>%s*</pre>',
        "\n\n```\n%1\n```\n\n"
    )
    text = text:gsub(
        '<pre[^>]*>(.-)</pre>',
        "\n\n```\n%1\n```\n\n"
    )

    -- Convert links: <a href="url">text</a> -> [text](url)
    text = text:gsub(
        '<a[^>]*href="([^"]*)"[^>]*>(.-)</a>',
        "[%2](%1)"
    )
    text = text:gsub(
        "<a[^>]*href='([^']*)'[^>]*>(.-)</a>",
        "[%2](%1)"
    )

    -- Convert list items
    text = text:gsub("<li[^>]*>(.-)</li>", "\n- %1")

    -- Convert bold and italic
    text = text:gsub("<strong[^>]*>(.-)</strong>", "**%1**")
    text = text:gsub("<b[^>]*>(.-)</b>", "**%1**")
    text = text:gsub("<em[^>]*>(.-)</em>", "*%1*")
    text = text:gsub("<i[^>]*>(.-)</i>", "*%1*")

    -- Convert inline code
    text = text:gsub("<code[^>]*>(.-)</code>", "`%1`")

    -- Add newlines for block elements
    for tag, _ in pairs(BLOCK_TAGS) do
        text = text:gsub("<" .. tag .. "[^>]*>", "\n")
        text = text:gsub("</" .. tag .. ">", "\n")
    end

    -- Convert <br> tags
    text = text:gsub("<br%s*/?>", "\n")

    -- Convert <hr> tags
    text = text:gsub("<hr%s*/?>", "\n\n---\n\n")

    -- Strip all remaining HTML tags
    text = text:gsub("<[^>]+>", "")

    -- Decode HTML entities
    text = decode_entities(text)

    -- Clean up whitespace
    text = text:gsub("[ \t]+\n", "\n")
    text = text:gsub("\n[ \t]+", "\n")
    text = text:gsub("\n\n\n+", "\n\n")
    text = text:match("^%s*(.-)%s*$")

    return text or ""
end

--- Extract just the text content (no markdown formatting).
--- @param html string The HTML content
--- @return string Plain text content
function M.extract_text(html)
    if not html or html == "" then
        return ""
    end

    local text = html

    for tag, _ in pairs(REMOVE_TAGS) do
        text = remove_tag_content(text, tag)
    end

    for tag, _ in pairs(BLOCK_TAGS) do
        text = text:gsub("<" .. tag .. "[^>]*>", " ")
        text = text:gsub("</" .. tag .. ">", " ")
    end

    text = text:gsub("<[^>]+>", "")
    text = decode_entities(text)
    text = text:gsub("%s+", " ")
    text = text:match("^%s*(.-)%s*$")

    return text or ""
end

--- Extract the page title from HTML.
--- @param html string The HTML content
--- @return string The page title
function M.extract_title(html)
    local title = html:match("<title[^>]*>(.-)</title>")
    if title then
        title = title:gsub("<[^>]+>", "")
        title = decode_entities(title)
        title = title:match("^%s*(.-)%s*$")
        if title and title ~= "" then
            return title
        end
    end

    local h1 = html:match("<h1[^>]*>(.-)</h1>")
    if h1 then
        h1 = h1:gsub("<[^>]+>", "")
        h1 = decode_entities(h1)
        h1 = h1:match("^%s*(.-)%s*$")
        if h1 and h1 ~= "" then
            return h1
        end
    end

    return ""
end

return M
