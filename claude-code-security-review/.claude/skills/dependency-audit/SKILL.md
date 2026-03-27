---
name: dependency-audit
description: Audit dependencies across all languages for known vulnerabilities
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob
argument-hint: [project-directory]
---

# Dependency Audit

Audit dependencies across all languages in the project for known vulnerabilities.

Supported package managers and checks:

- **Python**: `pip audit`, `safety check`, or scan requirements.txt / pyproject.toml against known vulnerability database
- **TypeScript/JavaScript**: `npm audit`, or scan package.json against known vulnerable packages, typosquatting detection, lock file verification
- **Go**: `govulncheck`, or scan go.mod/go.sum against known vulnerable modules, local replacement detection
- **Rust**: `cargo audit`, or scan Cargo.toml against known vulnerable crates
- **Java**: `mvn dependency-check:check`, or scan pom.xml against known CVEs

For each vulnerability found, report:
- Package name and version
- Severity (critical/high/medium/low)
- Description and fix version
- Advisory link if available
