package vuln

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Vulnerability represents a detected security vulnerability.
type Vulnerability struct {
	File        string `json:"file"`
	Line        int    `json:"line,omitempty"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	Package     string `json:"package,omitempty"`
	Version     string `json:"version,omitempty"`
	Category    string `json:"category"`
}

// knownVulnGo is a known vulnerable Go module.
type knownVulnGo struct {
	Module      string
	MaxSafe     string
	Severity    string
	Description string
}

var knownGoVulns = []knownVulnGo{
	{"golang.org/x/crypto", "v0.17.0", "critical", "SSH prefix truncation attack (Terrapin)"},
	{"golang.org/x/net", "v0.17.0", "high", "HTTP/2 rapid reset DoS vulnerability"},
	{"golang.org/x/text", "v0.3.8", "medium", "Denial of service via crafted Accept-Language header"},
	{"github.com/gin-gonic/gin", "v1.9.1", "medium", "Open redirect vulnerability"},
	{"github.com/golang-jwt/jwt", "v3.2.2", "critical", "JWT signature bypass"},
	{"github.com/go-yaml/yaml", "v2.2.8", "high", "Arbitrary code execution via deserialization"},
	{"google.golang.org/grpc", "v1.56.3", "high", "Denial of service via HTTP/2 stream cancellation"},
	{"github.com/hashicorp/consul", "v1.15.3", "high", "ACL bypass vulnerability"},
	{"github.com/miekg/dns", "v1.1.50", "medium", "Denial of service via crafted DNS response"},
	{"gopkg.in/yaml.v2", "v2.2.8", "high", "Arbitrary code execution via deserialization"},
}

// VulnScanner scans files for known vulnerabilities.
type VulnScanner struct{}

// NewVulnScanner creates a new VulnScanner instance.
func NewVulnScanner() *VulnScanner {
	return &VulnScanner{}
}

// ScanGoMod scans a go.mod or go.sum file for known vulnerable dependencies.
func (s *VulnScanner) ScanGoMod(path string) ([]Vulnerability, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("opening %s: %w", path, err)
	}
	defer file.Close()

	var vulns []Vulnerability
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines, comments, and directives
		if line == "" || strings.HasPrefix(line, "//") || strings.HasPrefix(line, "module ") ||
			strings.HasPrefix(line, "go ") || line == "require (" || line == ")" {
			continue
		}

		// Parse module line: "module/path vX.Y.Z" or "module/path vX.Y.Z // indirect"
		line = strings.TrimPrefix(line, "require ")
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		moduleName := parts[0]
		moduleVersion := parts[1]

		// Check against known vulnerable modules
		for _, kv := range knownGoVulns {
			if moduleName == kv.Module {
				if compareGoVersions(moduleVersion, kv.MaxSafe) < 0 {
					vulns = append(vulns, Vulnerability{
						File:        path,
						Line:        lineNum,
						Severity:    kv.Severity,
						Description: fmt.Sprintf("%s (fixed in %s)", kv.Description, kv.MaxSafe),
						Package:     moduleName,
						Version:     moduleVersion,
						Category:    "known_vulnerability",
					})
				}
			}
		}

		// Check for replace directives pointing to local paths (potential supply chain risk)
		if strings.HasPrefix(line, "replace ") && strings.Contains(line, "=>") {
			afterArrow := strings.SplitN(line, "=>", 2)
			if len(afterArrow) == 2 {
				replacement := strings.TrimSpace(afterArrow[1])
				if strings.HasPrefix(replacement, ".") || strings.HasPrefix(replacement, "/") {
					vulns = append(vulns, Vulnerability{
						File:        path,
						Line:        lineNum,
						Severity:    "medium",
						Description: fmt.Sprintf("Local path replacement: %s - verify this is intentional", replacement),
						Package:     moduleName,
						Version:     moduleVersion,
						Category:    "supply_chain",
					})
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return vulns, fmt.Errorf("reading %s: %w", path, err)
	}

	return vulns, nil
}

// ScanDependencies scans a project directory for dependency vulnerabilities across languages.
func (s *VulnScanner) ScanDependencies(projectDir string, language string) ([]Vulnerability, error) {
	var vulns []Vulnerability

	switch language {
	case "go":
		goModPath := filepath.Join(projectDir, "go.mod")
		if _, err := os.Stat(goModPath); err == nil {
			goVulns, err := s.ScanGoMod(goModPath)
			if err != nil {
				return nil, err
			}
			vulns = append(vulns, goVulns...)
		}

		goSumPath := filepath.Join(projectDir, "go.sum")
		if _, err := os.Stat(goSumPath); err == nil {
			sumVulns, err := s.ScanGoMod(goSumPath)
			if err != nil {
				return nil, err
			}
			vulns = append(vulns, sumVulns...)
		}

	case "python":
		reqPath := filepath.Join(projectDir, "requirements.txt")
		if _, err := os.Stat(reqPath); err == nil {
			pyVulns, err := s.scanRequirementsTxt(reqPath)
			if err != nil {
				return nil, err
			}
			vulns = append(vulns, pyVulns...)
		}

	default:
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	return vulns, nil
}

// ScanFile scans a single file for vulnerabilities based on its type.
func (s *VulnScanner) ScanFile(path string) ([]Vulnerability, error) {
	base := filepath.Base(path)
	switch base {
	case "go.mod", "go.sum":
		return s.ScanGoMod(path)
	case "requirements.txt":
		return s.scanRequirementsTxt(path)
	default:
		return nil, nil
	}
}

// scanRequirementsTxt checks a Python requirements.txt for known vulnerable packages.
func (s *VulnScanner) scanRequirementsTxt(path string) ([]Vulnerability, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("opening %s: %w", path, err)
	}
	defer file.Close()

	knownPyVulns := map[string]struct {
		MaxSafe     string
		Severity    string
		Description string
	}{
		"requests":      {"2.31.0", "medium", "Information disclosure via proxy headers"},
		"urllib3":       {"2.0.7", "medium", "Cookie header leakage on redirect to different host"},
		"cryptography":  {"41.0.6", "high", "NULL pointer dereference in PKCS12 parsing"},
		"pillow":        {"10.2.0", "high", "Arbitrary code execution via crafted image"},
		"django":        {"4.2.8", "high", "Denial of service via large file uploads"},
		"flask":         {"2.3.2", "medium", "Information disclosure via debug mode"},
		"jinja2":        {"3.1.3", "medium", "XSS via template sandbox bypass"},
		"pyyaml":        {"6.0.1", "critical", "Arbitrary code execution via deserialization"},
		"paramiko":      {"3.4.0", "critical", "Authentication bypass via prefix truncation"},
		"scrapy":        {"2.11.0", "medium", "SSRF via DNS rebinding"},
	}

	var vulns []Vulnerability
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Parse: package==version, package>=version, package~=version
		var pkgName, pkgVersion string
		for _, sep := range []string{"==", ">=", "<=", "~=", "!="} {
			if idx := strings.Index(line, sep); idx > 0 {
				pkgName = strings.TrimSpace(line[:idx])
				pkgVersion = strings.TrimSpace(line[idx+len(sep):])
				break
			}
		}
		if pkgName == "" {
			pkgName = strings.Split(line, ";")[0]
			pkgName = strings.TrimSpace(pkgName)
		}

		pkgName = strings.ToLower(pkgName)
		if kv, ok := knownPyVulns[pkgName]; ok && pkgVersion != "" {
			if comparePyVersions(pkgVersion, kv.MaxSafe) < 0 {
				vulns = append(vulns, Vulnerability{
					File:        path,
					Line:        lineNum,
					Severity:    kv.Severity,
					Description: fmt.Sprintf("%s (fixed in %s)", kv.Description, kv.MaxSafe),
					Package:     pkgName,
					Version:     pkgVersion,
					Category:    "known_vulnerability",
				})
			}
		}
	}

	return vulns, scanner.Err()
}

// compareGoVersions compares two Go semver strings.
// Returns -1 if a < b, 0 if equal, 1 if a > b.
func compareGoVersions(a, b string) int {
	a = strings.TrimPrefix(a, "v")
	b = strings.TrimPrefix(b, "v")
	return compareVersionParts(a, b)
}

func comparePyVersions(a, b string) int {
	return compareVersionParts(a, b)
}

func compareVersionParts(a, b string) int {
	partsA := strings.Split(a, ".")
	partsB := strings.Split(b, ".")

	maxLen := len(partsA)
	if len(partsB) > maxLen {
		maxLen = len(partsB)
	}

	for i := 0; i < maxLen; i++ {
		var numA, numB int
		if i < len(partsA) {
			fmt.Sscanf(partsA[i], "%d", &numA)
		}
		if i < len(partsB) {
			fmt.Sscanf(partsB[i], "%d", &numB)
		}
		if numA < numB {
			return -1
		}
		if numA > numB {
			return 1
		}
	}
	return 0
}
