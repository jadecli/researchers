#include <gtest/gtest.h>
#include "extractor.h"
#include <cstring>

class ExtractorTest : public ::testing::Test {
protected:
    char output[8192];
    void SetUp() override { memset(output, 0, sizeof(output)); }
};

TEST_F(ExtractorTest, ExtractTextBasic) {
    const char* html =
        "<html><body><h1>Title</h1><p>Hello world.</p></body></html>";
    int len = extract_text(html, output, sizeof(output));
    ASSERT_GT(len, 0);
    std::string r(output);
    EXPECT_NE(r.find("Title"), std::string::npos);
    EXPECT_NE(r.find("Hello world"), std::string::npos);
}

TEST_F(ExtractorTest, ExtractTextStripsScripts) {
    const char* html =
        "<html><body><script>var x=1;</script><p>Visible</p></body></html>";
    int len = extract_text(html, output, sizeof(output));
    ASSERT_GT(len, 0);
    std::string r(output);
    EXPECT_NE(r.find("Visible"), std::string::npos);
    EXPECT_EQ(r.find("var x"), std::string::npos);
}

TEST_F(ExtractorTest, ExtractTextStripsNav) {
    const char* html =
        "<html><body><nav>Home</nav><main><p>Content</p></main><footer>Foot</footer></body></html>";
    int len = extract_text(html, output, sizeof(output));
    ASSERT_GT(len, 0);
    std::string r(output);
    EXPECT_NE(r.find("Content"), std::string::npos);
    EXPECT_EQ(r.find("Home"), std::string::npos);
    EXPECT_EQ(r.find("Foot"), std::string::npos);
}

TEST_F(ExtractorTest, ExtractMarkdownHeadings) {
    const char* html = "<html><body><h1>Title</h1><p>Text.</p></body></html>";
    int len = extract_markdown(html, output, sizeof(output));
    ASSERT_GT(len, 0);
    std::string r(output);
    EXPECT_NE(r.find("# Title"), std::string::npos);
}

TEST_F(ExtractorTest, ExtractTitle) {
    const char* html = "<html><head><title>Page</title></head><body></body></html>";
    int len = extract_title(html, output, sizeof(output));
    ASSERT_GT(len, 0);
    EXPECT_STREQ(output, "Page");
}

TEST_F(ExtractorTest, ExtractTitleFromH1) {
    const char* html = "<html><body><h1>Heading</h1></body></html>";
    int len = extract_title(html, output, sizeof(output));
    ASSERT_GT(len, 0);
    EXPECT_STREQ(output, "Heading");
}

TEST_F(ExtractorTest, ScoreQualityEmpty) {
    EXPECT_DOUBLE_EQ(score_quality(""), 0.0);
    EXPECT_DOUBLE_EQ(score_quality(nullptr), 0.0);
}

TEST_F(ExtractorTest, ScoreQualityGood) {
    const char* content =
        "# Title\n\nParagraph text here.\n\n## Section\n\n"
        "More text.\n\n```python\ndef f(): pass\n```\n\n"
        "- Item 1\n- Item 2\n- Item 3\n\n[Link](https://example.com)\n";
    double score = score_quality(content);
    EXPECT_GT(score, 0.3);
    EXPECT_LE(score, 1.0);
}

TEST_F(ExtractorTest, ScoreQualityMinimal) {
    EXPECT_LT(score_quality("Hello"), 0.3);
}

TEST_F(ExtractorTest, ExtractTextEmpty) {
    int len = extract_text("", output, sizeof(output));
    EXPECT_TRUE(len == 0 || output[0] == '\0');
}

TEST_F(ExtractorTest, SmallBuffer) {
    const char* html = "<html><body><p>Test</p></body></html>";
    char small[5];
    int len = extract_text(html, small, sizeof(small));
    ASSERT_GE(len, 0);
    EXPECT_LT((size_t)len, sizeof(small));
}
