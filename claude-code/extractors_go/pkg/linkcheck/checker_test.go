package linkcheck

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheckLinksSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ok":
			w.WriteHeader(http.StatusOK)
		case "/not-found":
			w.WriteHeader(http.StatusNotFound)
		case "/redirect":
			http.Redirect(w, r, "/ok", http.StatusMovedPermanently)
		default:
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer server.Close()

	urls := []string{
		server.URL + "/ok",
		server.URL + "/not-found",
		server.URL + "/redirect",
	}

	results := CheckLinks(urls, 2)

	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	// /ok should be OK
	if !results[0].OK {
		t.Errorf("expected /ok to be OK, got error: %s", results[0].Error)
	}
	if results[0].StatusCode != 200 {
		t.Errorf("expected status 200 for /ok, got %d", results[0].StatusCode)
	}

	// /not-found should fail
	if results[1].OK {
		t.Error("expected /not-found to not be OK")
	}
	if results[1].StatusCode != 404 {
		t.Errorf("expected status 404, got %d", results[1].StatusCode)
	}

	// /redirect should follow to /ok
	if !results[2].OK {
		t.Errorf("expected /redirect to be OK after redirect, got error: %s", results[2].Error)
	}
}

func TestCheckLinksInvalidURL(t *testing.T) {
	results := CheckLinks([]string{"not-a-url"}, 1)

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if results[0].OK {
		t.Error("expected invalid URL to fail")
	}
	if results[0].Error == "" {
		t.Error("expected error message for invalid URL")
	}
}

func TestCheckLinksEmpty(t *testing.T) {
	results := CheckLinks([]string{}, 1)
	if len(results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(results))
	}
}

func TestCheckLinksDuration(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	results := CheckLinks([]string{server.URL + "/test"}, 1)

	if len(results) != 1 {
		t.Fatal("expected 1 result")
	}

	if results[0].Duration < 0 {
		t.Error("expected non-negative duration")
	}
}

func TestCheckLinksConcurrencyBounds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Should not panic with extreme concurrency values
	results := CheckLinks([]string{server.URL}, 0)
	if len(results) != 1 {
		t.Fatal("expected 1 result with concurrency 0")
	}

	results = CheckLinks([]string{server.URL}, 100)
	if len(results) != 1 {
		t.Fatal("expected 1 result with concurrency 100")
	}
}
