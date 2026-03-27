// Command linkcheck reads URLs from stdin and checks them concurrently.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/researchers/extractors-go/pkg/linkcheck"
)

func main() {
	concurrency := flag.Int("concurrency", 5, "Number of concurrent requests")
	flag.Parse()

	var urls []string
	scanner := bufio.NewScanner(os.Stdin)

	for scanner.Scan() {
		url := strings.TrimSpace(scanner.Text())
		if url != "" && (strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")) {
			urls = append(urls, url)
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Error reading stdin: %v\n", err)
		os.Exit(1)
	}

	if len(urls) == 0 {
		fmt.Fprintln(os.Stderr, "No valid URLs provided on stdin")
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "Checking %d URLs with concurrency %d...\n", len(urls), *concurrency)

	results := linkcheck.CheckLinks(urls, *concurrency)

	output, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error encoding results: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))

	// Print summary to stderr
	okCount := 0
	failCount := 0
	for _, r := range results {
		if r.OK {
			okCount++
		} else {
			failCount++
		}
	}

	fmt.Fprintf(os.Stderr, "\nResults: %d OK, %d failed out of %d total\n", okCount, failCount, len(results))
}
