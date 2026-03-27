package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/researchers/security-go/pkg/vuln"
)

type Report struct {
	Files           []string             `json:"files"`
	Vulnerabilities []vuln.Vulnerability `json:"vulnerabilities"`
	TotalFiles      int                  `json:"total_files"`
	TotalVulns      int                  `json:"total_vulns"`
	Passed          bool                 `json:"passed"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: secaudit <file1> [file2] ...\n")
		os.Exit(1)
	}

	files := os.Args[1:]
	scanner := vuln.NewVulnScanner()

	report := Report{
		Files:  files,
		Passed: true,
	}

	for _, file := range files {
		var vulns []vuln.Vulnerability
		var err error

		// Determine scan type based on file
		switch {
		case isGoMod(file):
			vulns, err = scanner.ScanGoMod(file)
		default:
			// Try generic dependency scan
			vulns, err = scanner.ScanFile(file)
		}

		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: error scanning %s: %v\n", file, err)
			continue
		}

		report.Vulnerabilities = append(report.Vulnerabilities, vulns...)
	}

	report.TotalFiles = len(files)
	report.TotalVulns = len(report.Vulnerabilities)

	for _, v := range report.Vulnerabilities {
		if v.Severity == "critical" || v.Severity == "high" {
			report.Passed = false
			break
		}
	}

	output, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling report: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))

	if !report.Passed {
		os.Exit(1)
	}
}

func isGoMod(path string) bool {
	return len(path) >= 6 && path[len(path)-6:] == "go.mod" ||
		len(path) >= 6 && path[len(path)-6:] == "go.sum"
}
