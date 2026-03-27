// Package sitemap provides XML sitemap parsing functionality.
package sitemap

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// SitemapEntry represents a single URL entry in a sitemap.
type SitemapEntry struct {
	Loc        string    `json:"loc" xml:"loc"`
	LastMod    string    `json:"lastmod,omitempty" xml:"lastmod"`
	ChangeFreq string    `json:"changefreq,omitempty" xml:"changefreq"`
	Priority   float64   `json:"priority,omitempty" xml:"priority"`
	ParsedTime time.Time `json:"-"`
}

type sitemapIndex struct {
	XMLName  xml.Name       `xml:"sitemapindex"`
	Sitemaps []sitemapEntry `xml:"sitemap"`
}

type sitemapEntry struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod"`
}

type urlset struct {
	XMLName xml.Name  `xml:"urlset"`
	URLs    []urlNode `xml:"url"`
}

type urlNode struct {
	Loc        string  `xml:"loc"`
	LastMod    string  `xml:"lastmod"`
	ChangeFreq string  `xml:"changefreq"`
	Priority   float64 `xml:"priority"`
}

// ParseSitemap fetches and parses an XML sitemap, including sitemap indexes.
// It follows sitemap index references recursively (one level deep).
func ParseSitemap(url string) ([]SitemapEntry, error) {
	return parseSitemapWithDepth(url, 0)
}

func parseSitemapWithDepth(url string, depth int) ([]SitemapEntry, error) {
	if depth > 3 {
		return nil, fmt.Errorf("sitemap recursion depth exceeded for %s", url)
	}

	body, err := fetchURL(url)
	if err != nil {
		return nil, fmt.Errorf("fetching sitemap %s: %w", url, err)
	}
	defer body.Close()

	data, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("reading sitemap body: %w", err)
	}

	content := string(data)

	// Try parsing as sitemap index first
	if strings.Contains(content, "<sitemapindex") {
		return parseSitemapIndex(data, depth)
	}

	// Parse as urlset
	return parseURLSet(data)
}

func parseSitemapIndex(data []byte, depth int) ([]SitemapEntry, error) {
	var idx sitemapIndex
	if err := xml.Unmarshal(data, &idx); err != nil {
		return nil, fmt.Errorf("parsing sitemap index: %w", err)
	}

	var allEntries []SitemapEntry
	for _, s := range idx.Sitemaps {
		loc := strings.TrimSpace(s.Loc)
		if loc == "" {
			continue
		}

		entries, err := parseSitemapWithDepth(loc, depth+1)
		if err != nil {
			// Log but continue with other sitemaps
			fmt.Printf("Warning: failed to parse sub-sitemap %s: %v\n", loc, err)
			continue
		}
		allEntries = append(allEntries, entries...)
	}

	return allEntries, nil
}

func parseURLSet(data []byte) ([]SitemapEntry, error) {
	var set urlset
	if err := xml.Unmarshal(data, &set); err != nil {
		return nil, fmt.Errorf("parsing urlset: %w", err)
	}

	entries := make([]SitemapEntry, 0, len(set.URLs))
	for _, u := range set.URLs {
		loc := strings.TrimSpace(u.Loc)
		if loc == "" {
			continue
		}

		entry := SitemapEntry{
			Loc:        loc,
			LastMod:    strings.TrimSpace(u.LastMod),
			ChangeFreq: strings.TrimSpace(u.ChangeFreq),
			Priority:   u.Priority,
		}

		if entry.LastMod != "" {
			for _, layout := range []string{
				time.RFC3339,
				"2006-01-02T15:04:05-07:00",
				"2006-01-02",
			} {
				if t, err := time.Parse(layout, entry.LastMod); err == nil {
					entry.ParsedTime = t
					break
				}
			}
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

// ParseSitemapFromReader parses a sitemap from an io.Reader (useful for testing).
func ParseSitemapFromReader(r io.Reader) ([]SitemapEntry, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("reading sitemap: %w", err)
	}

	content := string(data)
	if strings.Contains(content, "<sitemapindex") {
		// For reader-based parsing, we can't follow sub-sitemap URLs
		// Just return the sitemap locations as entries
		var idx sitemapIndex
		if err := xml.Unmarshal(data, &idx); err != nil {
			return nil, fmt.Errorf("parsing sitemap index: %w", err)
		}
		entries := make([]SitemapEntry, 0, len(idx.Sitemaps))
		for _, s := range idx.Sitemaps {
			entries = append(entries, SitemapEntry{
				Loc:     strings.TrimSpace(s.Loc),
				LastMod: strings.TrimSpace(s.LastMod),
			})
		}
		return entries, nil
	}

	return parseURLSet(data)
}

func fetchURL(url string) (io.ReadCloser, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "ScrapyResearchers/0.1 SitemapParser")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("HTTP %d for %s", resp.StatusCode, url)
	}

	return resp.Body, nil
}
