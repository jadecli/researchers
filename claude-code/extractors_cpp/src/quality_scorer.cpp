#include "extractor.h"

#include <cstring>
#include <string>
#include <vector>
#include <sstream>
#include <algorithm>

namespace {

int count_words(const std::string& text) {
    std::istringstream iss(text);
    std::string word;
    int count = 0;
    while (iss >> word) count++;
    return count;
}

std::vector<std::string> split_lines(const std::string& text) {
    std::vector<std::string> lines;
    std::istringstream iss(text);
    std::string line;
    while (std::getline(iss, line)) lines.push_back(line);
    return lines;
}

std::string trim(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

bool starts_with(const std::string& s, const std::string& prefix) {
    return s.size() >= prefix.size() && s.compare(0, prefix.size(), prefix) == 0;
}

double score_length(int wc) {
    if (wc >= 1000) return 1.0;
    if (wc >= 500) return 0.7 + 0.3 * (wc - 500) / 500.0;
    if (wc >= 100) return 0.3 + 0.4 * (wc - 100) / 400.0;
    if (wc > 0) return 0.3 * wc / 100.0;
    return 0.0;
}

double score_headings(const std::vector<std::string>& lines) {
    int count = 0;
    bool has_h1 = false;
    for (const auto& line : lines) {
        std::string t = trim(line);
        if (starts_with(t, "#")) {
            count++;
            if (starts_with(t, "# ") && !starts_with(t, "## ")) has_h1 = true;
        }
    }
    if (count == 0) return 0.0;
    double score = 0.4;
    if (count >= 3) score += 0.3;
    if (has_h1) score += 0.3;
    return std::min(score, 1.0);
}

double score_code_blocks(const std::string& content) {
    int count = 0;
    size_t pos = 0;
    while ((pos = content.find("```", pos)) != std::string::npos) { count++; pos += 3; }
    int blocks = count / 2;
    if (blocks == 0) return 0.0;
    double score = 0.5;
    if (blocks >= 2) score += 0.2;
    if (blocks >= 4) score += 0.3;
    return std::min(score, 1.0);
}

double score_lists(const std::vector<std::string>& lines) {
    int count = 0;
    for (const auto& line : lines) {
        std::string t = trim(line);
        if (starts_with(t, "- ") || starts_with(t, "* ")) count++;
    }
    if (count == 0) return 0.0;
    return std::min(count / 5.0, 1.0);
}

double score_links(const std::string& content) {
    int count = 0;
    size_t pos = 0;
    while ((pos = content.find("](", pos)) != std::string::npos) { count++; pos += 2; }
    if (count == 0) return 0.0;
    return std::min(count / 5.0, 1.0);
}

double score_paragraphs(const std::vector<std::string>& lines) {
    int pc = 0;
    bool in_p = false;
    for (const auto& line : lines) {
        std::string t = trim(line);
        if (!t.empty() && !starts_with(t, "#") && !starts_with(t, "```")
            && !starts_with(t, "- ") && !starts_with(t, "* ") && !starts_with(t, "> ")) {
            if (!in_p) { pc++; in_p = true; }
        } else { in_p = false; }
    }
    if (pc >= 5) return 1.0;
    if (pc >= 3) return 0.7;
    if (pc >= 1) return 0.4;
    return 0.0;
}

} // namespace

extern "C" {

double score_quality(const char* content) {
    if (!content || content[0] == '\0') return 0.0;
    std::string text(content);
    auto lines = split_lines(text);
    double w = 0.25 * score_length(count_words(text))
             + 0.20 * score_headings(lines)
             + 0.15 * score_code_blocks(text)
             + 0.15 * score_lists(lines)
             + 0.10 * score_links(text)
             + 0.15 * score_paragraphs(lines);
    return std::min(std::max(w, 0.0), 1.0);
}

}
