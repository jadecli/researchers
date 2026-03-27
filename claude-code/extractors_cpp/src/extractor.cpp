#include "extractor.h"

#include <cstring>
#include <string>
#include <vector>
#include <algorithm>

#include <libxml/HTMLparser.h>
#include <libxml/tree.h>
#include <libxml/xpath.h>

namespace {

const std::vector<std::string> SKIP_TAGS = {
    "script", "style", "noscript", "iframe", "svg", "nav", "header", "footer"
};

const std::vector<std::string> BLOCK_TAGS = {
    "p", "div", "section", "article", "main",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "blockquote", "pre", "table", "tr", "br", "hr"
};

bool is_skip_tag(const char* name) {
    if (!name) return false;
    std::string tag(name);
    std::transform(tag.begin(), tag.end(), tag.begin(), ::tolower);
    return std::find(SKIP_TAGS.begin(), SKIP_TAGS.end(), tag) != SKIP_TAGS.end();
}

bool is_block_tag(const char* name) {
    if (!name) return false;
    std::string tag(name);
    std::transform(tag.begin(), tag.end(), tag.begin(), ::tolower);
    return std::find(BLOCK_TAGS.begin(), BLOCK_TAGS.end(), tag) != BLOCK_TAGS.end();
}

bool is_heading(const char* name) {
    if (!name) return false;
    return name[0] == 'h' && name[1] >= '1' && name[1] <= '6' && name[2] == '\0';
}

void extract_text_recursive(xmlNode* node, std::string& output, bool markdown) {
    for (xmlNode* cur = node; cur; cur = cur->next) {
        if (cur->type == XML_ELEMENT_NODE) {
            const char* name = (const char*)cur->name;

            if (is_skip_tag(name)) continue;

            if (is_block_tag(name)) output += "\n";

            if (markdown && is_heading(name)) {
                int level = name[1] - '0';
                output += "\n";
                for (int i = 0; i < level; i++) output += "#";
                output += " ";
            }

            std::string tag_lower(name);
            std::transform(tag_lower.begin(), tag_lower.end(), tag_lower.begin(), ::tolower);

            if (markdown && tag_lower == "pre") {
                output += "\n```\n";
                extract_text_recursive(cur->children, output, false);
                output += "\n```\n";
                continue;
            }

            if (markdown && tag_lower == "li") output += "- ";

            extract_text_recursive(cur->children, output, markdown);

            if (is_block_tag(name)) output += "\n";
        } else if (cur->type == XML_TEXT_NODE) {
            const char* content = (const char*)cur->content;
            if (content) {
                std::string text(content);
                std::string cleaned;
                bool last_space = false;
                for (char c : text) {
                    if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
                        if (!last_space) { cleaned += ' '; last_space = true; }
                    } else {
                        cleaned += c;
                        last_space = false;
                    }
                }
                output += cleaned;
            }
        }
    }
}

std::string extract_from_html(const char* html, bool markdown) {
    if (!html || html[0] == '\0') return "";

    htmlDocPtr doc = htmlReadMemory(
        html, (int)strlen(html), NULL, "UTF-8",
        HTML_PARSE_NOERROR | HTML_PARSE_NOWARNING | HTML_PARSE_RECOVER
    );
    if (!doc) return "";

    xmlNode* root = xmlDocGetRootElement(doc);
    std::string output;
    output.reserve(strlen(html) / 2);

    if (root) {
        xmlNode* body = nullptr;
        for (xmlNode* cur = root->children; cur; cur = cur->next) {
            if (cur->type == XML_ELEMENT_NODE && cur->name &&
                strcasecmp((const char*)cur->name, "body") == 0) {
                body = cur; break;
            }
        }

        if (body) {
            xmlNode* main_content = nullptr;
            for (xmlNode* cur = body->children; cur; cur = cur->next) {
                if (cur->type == XML_ELEMENT_NODE && cur->name) {
                    const char* n = (const char*)cur->name;
                    if (strcasecmp(n, "main") == 0 || strcasecmp(n, "article") == 0) {
                        main_content = cur; break;
                    }
                }
            }
            extract_text_recursive(
                main_content ? main_content->children : body->children,
                output, markdown);
        } else {
            extract_text_recursive(root->children, output, markdown);
        }
    }

    xmlFreeDoc(doc);

    // Clean excessive newlines
    std::string cleaned;
    int nl_count = 0;
    for (char c : output) {
        if (c == '\n') { nl_count++; if (nl_count <= 2) cleaned += c; }
        else { nl_count = 0; cleaned += c; }
    }

    size_t start = cleaned.find_first_not_of(" \n\r\t");
    size_t end = cleaned.find_last_not_of(" \n\r\t");
    if (start == std::string::npos) return "";
    return cleaned.substr(start, end - start + 1);
}

std::string find_title(const char* html) {
    if (!html || html[0] == '\0') return "";

    htmlDocPtr doc = htmlReadMemory(
        html, (int)strlen(html), NULL, "UTF-8",
        HTML_PARSE_NOERROR | HTML_PARSE_NOWARNING | HTML_PARSE_RECOVER
    );
    if (!doc) return "";

    std::string title;
    xmlXPathContextPtr ctx = xmlXPathNewContext(doc);
    if (ctx) {
        xmlXPathObjectPtr result = xmlXPathEvalExpression((const xmlChar*)"//title", ctx);
        if (result && result->nodesetval && result->nodesetval->nodeNr > 0) {
            xmlChar* content = xmlNodeGetContent(result->nodesetval->nodeTab[0]);
            if (content) { title = (const char*)content; xmlFree(content); }
        }
        if (result) xmlXPathFreeObject(result);

        if (title.empty()) {
            result = xmlXPathEvalExpression((const xmlChar*)"//h1", ctx);
            if (result && result->nodesetval && result->nodesetval->nodeNr > 0) {
                xmlChar* content = xmlNodeGetContent(result->nodesetval->nodeTab[0]);
                if (content) { title = (const char*)content; xmlFree(content); }
            }
            if (result) xmlXPathFreeObject(result);
        }
        xmlXPathFreeContext(ctx);
    }

    xmlFreeDoc(doc);

    size_t start = title.find_first_not_of(" \n\r\t");
    size_t end = title.find_last_not_of(" \n\r\t");
    if (start == std::string::npos) return "";
    return title.substr(start, end - start + 1);
}

int copy_to_buffer(const std::string& src, char* output, size_t max_len) {
    if (!output || max_len == 0) return -1;
    size_t len = std::min(src.size(), max_len - 1);
    memcpy(output, src.c_str(), len);
    output[len] = '\0';
    return (int)len;
}

} // namespace

extern "C" {

int extract_text(const char* html, char* output, size_t max_len) {
    return copy_to_buffer(extract_from_html(html, false), output, max_len);
}

int extract_markdown(const char* html, char* output, size_t max_len) {
    return copy_to_buffer(extract_from_html(html, true), output, max_len);
}

int extract_title(const char* html, char* output, size_t max_len) {
    return copy_to_buffer(find_title(html), output, max_len);
}

}
