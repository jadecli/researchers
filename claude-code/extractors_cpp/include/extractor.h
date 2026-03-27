#ifndef EXTRACTOR_H
#define EXTRACTOR_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Extract plain text from HTML content.
 *
 * @param html     Input HTML string (null-terminated)
 * @param output   Buffer to receive extracted text
 * @param max_len  Maximum size of the output buffer
 * @return         Number of bytes written, or -1 on error
 */
int extract_text(const char* html, char* output, size_t max_len);

/**
 * Extract text and convert to basic markdown format.
 *
 * @param html     Input HTML string (null-terminated)
 * @param output   Buffer to receive markdown text
 * @param max_len  Maximum size of the output buffer
 * @return         Number of bytes written, or -1 on error
 */
int extract_markdown(const char* html, char* output, size_t max_len);

/**
 * Extract the page title from HTML.
 *
 * @param html     Input HTML string (null-terminated)
 * @param output   Buffer to receive the title
 * @param max_len  Maximum size of the output buffer
 * @return         Number of bytes written, or -1 on error
 */
int extract_title(const char* html, char* output, size_t max_len);

/**
 * Score the quality of extracted content.
 *
 * @param content  Extracted text/markdown content (null-terminated)
 * @return         Quality score from 0.0 to 1.0
 */
double score_quality(const char* content);

#ifdef __cplusplus
}
#endif

#endif /* EXTRACTOR_H */
