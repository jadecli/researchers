package sitemap

import (
	"strings"
	"testing"
)

func TestParseURLSet(t *testing.T) {
	xmlData := `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
    <lastmod>2024-02-20T10:30:00+00:00</lastmod>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://example.com/page3</loc>
  </url>
</urlset>`

	entries, err := ParseSitemapFromReader(strings.NewReader(xmlData))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}

	if entries[0].Loc != "https://example.com/page1" {
		t.Errorf("expected page1 URL, got %s", entries[0].Loc)
	}
	if entries[0].LastMod != "2024-01-15" {
		t.Errorf("expected lastmod 2024-01-15, got %s", entries[0].LastMod)
	}
	if entries[0].ChangeFreq != "weekly" {
		t.Errorf("expected changefreq weekly, got %s", entries[0].ChangeFreq)
	}
	if entries[0].Priority != 0.8 {
		t.Errorf("expected priority 0.8, got %f", entries[0].Priority)
	}
	if entries[0].ParsedTime.IsZero() {
		t.Error("expected parsed time for entry 0")
	}

	if entries[1].Loc != "https://example.com/page2" {
		t.Errorf("expected page2 URL, got %s", entries[1].Loc)
	}
	if entries[1].ParsedTime.IsZero() {
		t.Error("expected parsed time for entry 1")
	}

	if entries[2].Loc != "https://example.com/page3" {
		t.Errorf("expected page3 URL, got %s", entries[2].Loc)
	}
}

func TestParseSitemapIndex(t *testing.T) {
	xmlData := `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-pages.xml</loc>
    <lastmod>2024-03-01</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-blog.xml</loc>
    <lastmod>2024-03-15</lastmod>
  </sitemap>
</sitemapindex>`

	entries, err := ParseSitemapFromReader(strings.NewReader(xmlData))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(entries) != 2 {
		t.Fatalf("expected 2 sitemap entries, got %d", len(entries))
	}

	if entries[0].Loc != "https://example.com/sitemap-pages.xml" {
		t.Errorf("expected sitemap-pages.xml, got %s", entries[0].Loc)
	}
	if entries[1].Loc != "https://example.com/sitemap-blog.xml" {
		t.Errorf("expected sitemap-blog.xml, got %s", entries[1].Loc)
	}
}

func TestParseEmptyURLSet(t *testing.T) {
	xmlData := `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`

	entries, err := ParseSitemapFromReader(strings.NewReader(xmlData))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(entries) != 0 {
		t.Fatalf("expected 0 entries, got %d", len(entries))
	}
}

func TestParseInvalidXML(t *testing.T) {
	_, err := ParseSitemapFromReader(strings.NewReader("not xml at all"))
	if err == nil {
		t.Error("expected error for invalid XML")
	}
}

func TestParseURLSetWithEmptyLoc(t *testing.T) {
	xmlData := `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/valid</loc>
  </url>
  <url>
    <loc>   </loc>
  </url>
  <url>
    <loc></loc>
  </url>
</urlset>`

	entries, err := ParseSitemapFromReader(strings.NewReader(xmlData))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(entries) != 1 {
		t.Fatalf("expected 1 entry (skipping empty locs), got %d", len(entries))
	}
}
