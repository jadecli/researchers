// Package linkcheck provides concurrent link checking with rate limiting.
package linkcheck

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/researchers/extractors-go/internal/ratelimit"
)

// LinkResult holds the result of checking a single URL.
type LinkResult struct {
	URL        string `json:"url"`
	StatusCode int    `json:"status_code"`
	OK         bool   `json:"ok"`
	Error      string `json:"error,omitempty"`
	Duration   int64  `json:"duration_ms"`
}

// CheckLinks checks multiple URLs concurrently with rate limiting.
// concurrency controls the maximum number of simultaneous requests.
func CheckLinks(urls []string, concurrency int) []LinkResult {
	return CheckLinksWithContext(context.Background(), urls, concurrency)
}

// CheckLinksWithContext checks multiple URLs with a context for cancellation.
func CheckLinksWithContext(ctx context.Context, urls []string, concurrency int) []LinkResult {
	if concurrency < 1 {
		concurrency = 1
	}
	if concurrency > 50 {
		concurrency = 50
	}

	limiter := ratelimit.NewTokenBucket(float64(concurrency), concurrency)

	results := make([]LinkResult, len(urls))
	var wg sync.WaitGroup
	sem := make(chan struct{}, concurrency)

	client := &http.Client{
		Timeout: 15 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects (5)")
			}
			return nil
		},
	}

	for i, url := range urls {
		wg.Add(1)
		go func(idx int, u string) {
			defer wg.Done()

			// Rate limit
			limiter.Wait(ctx)

			sem <- struct{}{}
			defer func() { <-sem }()

			results[idx] = checkSingleURL(ctx, client, u)
		}(i, url)
	}

	wg.Wait()
	return results
}

func checkSingleURL(ctx context.Context, client *http.Client, url string) LinkResult {
	start := time.Now()

	req, err := http.NewRequestWithContext(ctx, "HEAD", url, nil)
	if err != nil {
		return LinkResult{
			URL:      url,
			OK:       false,
			Error:    fmt.Sprintf("creating request: %v", err),
			Duration: time.Since(start).Milliseconds(),
		}
	}
	req.Header.Set("User-Agent", "ScrapyResearchers/0.1 LinkChecker")

	resp, err := client.Do(req)
	if err != nil {
		return LinkResult{
			URL:      url,
			OK:       false,
			Error:    fmt.Sprintf("request failed: %v", err),
			Duration: time.Since(start).Milliseconds(),
		}
	}
	defer resp.Body.Close()

	ok := resp.StatusCode >= 200 && resp.StatusCode < 400

	result := LinkResult{
		URL:        url,
		StatusCode: resp.StatusCode,
		OK:         ok,
		Duration:   time.Since(start).Milliseconds(),
	}

	if !ok {
		result.Error = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}

	return result
}
