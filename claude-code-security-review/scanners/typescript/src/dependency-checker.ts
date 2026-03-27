/**
 * DependencyChecker - checks package.json for vulnerable/outdated dependencies.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface VulnResult {
  package: string;
  version: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  advisory?: string;
}

export interface AuditReport {
  projectDir: string;
  totalDeps: number;
  vulnerabilities: VulnResult[];
  outdatedDeps: OutdatedDep[];
  passed: boolean;
}

export interface OutdatedDep {
  package: string;
  currentVersion: string;
  latestVersion?: string;
  reason: string;
}

/**
 * Known vulnerable package patterns.
 * In production, this would be backed by an advisory database.
 */
const KNOWN_VULNERABLE_PACKAGES: Record<string, { maxSafe: string; severity: VulnResult["severity"]; description: string }[]> = {
  "lodash": [{ maxSafe: "4.17.21", severity: "high", description: "Prototype pollution via merge/zipObjectDeep" }],
  "minimist": [{ maxSafe: "1.2.6", severity: "critical", description: "Prototype pollution" }],
  "node-fetch": [{ maxSafe: "2.6.7", severity: "high", description: "Exposure of sensitive info to unauthorized actor" }],
  "axios": [{ maxSafe: "1.6.0", severity: "medium", description: "SSRF and credential leakage via follow redirects" }],
  "express": [{ maxSafe: "4.18.2", severity: "medium", description: "Path traversal via open redirect" }],
  "jsonwebtoken": [{ maxSafe: "9.0.0", severity: "critical", description: "Improper JWT signature verification" }],
  "shell-quote": [{ maxSafe: "1.7.3", severity: "critical", description: "Command injection via untrusted input" }],
  "tar": [{ maxSafe: "6.1.12", severity: "high", description: "Arbitrary file creation/overwrite via symlinks" }],
  "semver": [{ maxSafe: "7.5.2", severity: "medium", description: "ReDoS in range parsing" }],
  "xml2js": [{ maxSafe: "0.5.0", severity: "medium", description: "Prototype pollution via parsed XML attributes" }],
};

/**
 * Suspicious dependency name patterns that may indicate typosquatting.
 */
const TYPOSQUAT_PATTERNS = [
  /^[a-z]+-[a-z]+s$/, // common typosquat: adding 's' to known packages
  /^(lodash|express|react|angular|vue|jquery)[_.-]\w+$/i,
];

function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^[^0-9]*/, "").split(".").map(Number);
  const partsB = b.replace(/^[^0-9]*/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

function extractVersion(versionSpec: string): string {
  return versionSpec.replace(/^[\^~>=<]+/, "").trim();
}

export class DependencyChecker {
  /**
   * Check a package.json file for vulnerable or suspicious dependencies.
   */
  checkPackageJson(packageJsonPath: string): VulnResult[] {
    if (!existsSync(packageJsonPath)) {
      return [];
    }

    const content = readFileSync(packageJsonPath, "utf-8");
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(content);
    } catch {
      return [
        {
          package: packageJsonPath,
          version: "N/A",
          severity: "high",
          description: "Invalid package.json - could not parse JSON",
        },
      ];
    }

    const vulns: VulnResult[] = [];
    const allDeps: Record<string, string> = {
      ...(pkg.dependencies as Record<string, string> ?? {}),
      ...(pkg.devDependencies as Record<string, string> ?? {}),
    };

    for (const [name, versionSpec] of Object.entries(allDeps)) {
      const version = extractVersion(versionSpec);
      vulns.push(...this.checkForKnownVulns(name, version));
    }

    return vulns;
  }

  /**
   * Check a specific package/version against the known vulnerability database.
   */
  checkForKnownVulns(packageName: string, version: string): VulnResult[] {
    const vulns: VulnResult[] = [];

    const knownVulns = KNOWN_VULNERABLE_PACKAGES[packageName];
    if (knownVulns) {
      for (const vuln of knownVulns) {
        if (compareVersions(version, vuln.maxSafe) < 0) {
          vulns.push({
            package: packageName,
            version,
            severity: vuln.severity,
            description: `${vuln.description} (fixed in ${vuln.maxSafe})`,
          });
        }
      }
    }

    // Check for suspicious package names (potential typosquatting)
    for (const pattern of TYPOSQUAT_PATTERNS) {
      if (pattern.test(packageName)) {
        vulns.push({
          package: packageName,
          version,
          severity: "info",
          description: "Package name matches typosquatting pattern - verify this is the intended package",
        });
        break;
      }
    }

    return vulns;
  }

  /**
   * Perform a full audit of a project directory.
   */
  auditProject(projectDir: string): AuditReport {
    const packageJsonPath = join(projectDir, "package.json");
    const report: AuditReport = {
      projectDir,
      totalDeps: 0,
      vulnerabilities: [],
      outdatedDeps: [],
      passed: true,
    };

    if (!existsSync(packageJsonPath)) {
      return report;
    }

    const content = readFileSync(packageJsonPath, "utf-8");
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(content);
    } catch {
      report.passed = false;
      return report;
    }

    const allDeps: Record<string, string> = {
      ...(pkg.dependencies as Record<string, string> ?? {}),
      ...(pkg.devDependencies as Record<string, string> ?? {}),
    };

    report.totalDeps = Object.keys(allDeps).length;
    report.vulnerabilities = this.checkPackageJson(packageJsonPath);

    // Check for outdated version specifiers
    for (const [name, versionSpec] of Object.entries(allDeps)) {
      if (versionSpec === "*" || versionSpec === "latest") {
        report.outdatedDeps.push({
          package: name,
          currentVersion: versionSpec,
          reason: "Unpinned dependency - using wildcard or 'latest' is a security risk",
        });
      }
    }

    // Check for lock file
    const lockFiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"];
    const hasLockFile = lockFiles.some((lf) => existsSync(join(projectDir, lf)));
    if (!hasLockFile) {
      report.vulnerabilities.push({
        package: "project",
        version: "N/A",
        severity: "medium",
        description: "No lock file found - dependencies are not pinned to exact versions",
      });
    }

    report.passed = !report.vulnerabilities.some(
      (v) => v.severity === "critical" || v.severity === "high"
    );

    return report;
  }
}
