package vuln_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/researchers/security-go/pkg/vuln"
)

func TestScanGoMod_DetectsVulnerableModules(t *testing.T) {
	content := `module example.com/myproject

go 1.22

require (
	golang.org/x/crypto v0.14.0
	golang.org/x/net v0.15.0
	github.com/gin-gonic/gin v1.9.0
)
`
	tmpDir := t.TempDir()
	goModPath := filepath.Join(tmpDir, "go.mod")
	if err := os.WriteFile(goModPath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test go.mod: %v", err)
	}

	scanner := vuln.NewVulnScanner()
	vulns, err := scanner.ScanGoMod(goModPath)
	if err != nil {
		t.Fatalf("ScanGoMod failed: %v", err)
	}

	if len(vulns) < 3 {
		t.Errorf("expected at least 3 vulnerabilities, got %d", len(vulns))
	}

	// Check that x/crypto vuln is detected
	found := false
	for _, v := range vulns {
		if v.Package == "golang.org/x/crypto" {
			found = true
			if v.Severity != "critical" {
				t.Errorf("expected critical severity for x/crypto, got %s", v.Severity)
			}
		}
	}
	if !found {
		t.Error("expected to find golang.org/x/crypto vulnerability")
	}
}

func TestScanGoMod_SafeModules(t *testing.T) {
	content := `module example.com/safe

go 1.22

require (
	golang.org/x/crypto v0.18.0
	golang.org/x/net v0.18.0
)
`
	tmpDir := t.TempDir()
	goModPath := filepath.Join(tmpDir, "go.mod")
	if err := os.WriteFile(goModPath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test go.mod: %v", err)
	}

	scanner := vuln.NewVulnScanner()
	vulns, err := scanner.ScanGoMod(goModPath)
	if err != nil {
		t.Fatalf("ScanGoMod failed: %v", err)
	}

	if len(vulns) != 0 {
		t.Errorf("expected 0 vulnerabilities for safe modules, got %d", len(vulns))
		for _, v := range vulns {
			t.Logf("  unexpected vuln: %s %s - %s", v.Package, v.Version, v.Description)
		}
	}
}

func TestScanGoMod_NonexistentFile(t *testing.T) {
	scanner := vuln.NewVulnScanner()
	_, err := scanner.ScanGoMod("/nonexistent/go.mod")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
}

func TestScanDependencies_Go(t *testing.T) {
	content := `module example.com/test

go 1.22

require (
	golang.org/x/crypto v0.14.0
)
`
	tmpDir := t.TempDir()
	goModPath := filepath.Join(tmpDir, "go.mod")
	if err := os.WriteFile(goModPath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test go.mod: %v", err)
	}

	scanner := vuln.NewVulnScanner()
	vulns, err := scanner.ScanDependencies(tmpDir, "go")
	if err != nil {
		t.Fatalf("ScanDependencies failed: %v", err)
	}

	if len(vulns) < 1 {
		t.Error("expected at least 1 vulnerability from go.mod scan")
	}
}

func TestScanDependencies_UnsupportedLanguage(t *testing.T) {
	scanner := vuln.NewVulnScanner()
	_, err := scanner.ScanDependencies("/tmp", "cobol")
	if err == nil {
		t.Error("expected error for unsupported language")
	}
}

func TestScanFile_GoMod(t *testing.T) {
	content := `module example.com/test

go 1.22

require gopkg.in/yaml.v2 v2.2.2
`
	tmpDir := t.TempDir()
	goModPath := filepath.Join(tmpDir, "go.mod")
	if err := os.WriteFile(goModPath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test go.mod: %v", err)
	}

	scanner := vuln.NewVulnScanner()
	vulns, err := scanner.ScanFile(goModPath)
	if err != nil {
		t.Fatalf("ScanFile failed: %v", err)
	}

	if len(vulns) < 1 {
		t.Error("expected to detect yaml.v2 vulnerability")
	}
}

func TestScanGoMod_LocalReplace(t *testing.T) {
	content := `module example.com/test

go 1.22

require golang.org/x/crypto v0.18.0

replace golang.org/x/crypto => ../local-crypto
`
	tmpDir := t.TempDir()
	goModPath := filepath.Join(tmpDir, "go.mod")
	if err := os.WriteFile(goModPath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test go.mod: %v", err)
	}

	scanner := vuln.NewVulnScanner()
	vulns, err := scanner.ScanGoMod(goModPath)
	if err != nil {
		t.Fatalf("ScanGoMod failed: %v", err)
	}

	supplyChain := false
	for _, v := range vulns {
		if v.Category == "supply_chain" {
			supplyChain = true
		}
	}
	if !supplyChain {
		t.Error("expected supply_chain warning for local replace directive")
	}
}
