import { describe, it, expect, beforeAll } from "vitest";
import { DependencyChecker, VulnResult, AuditReport } from "../../scanners/typescript/src/dependency-checker";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "dep-checker-test-" + Date.now());

beforeAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
});

describe("DependencyChecker", () => {
  const checker = new DependencyChecker();

  describe("checkForKnownVulns", () => {
    it("should detect vulnerable lodash versions", () => {
      const vulns = checker.checkForKnownVulns("lodash", "4.17.15");
      expect(vulns.length).toBeGreaterThanOrEqual(1);
      expect(vulns[0].severity).toBe("high");
      expect(vulns[0].description).toContain("Prototype pollution");
    });

    it("should pass safe lodash versions", () => {
      const vulns = checker.checkForKnownVulns("lodash", "4.17.21");
      const realVulns = vulns.filter((v) => v.severity !== "info");
      expect(realVulns.length).toBe(0);
    });

    it("should detect vulnerable jsonwebtoken versions", () => {
      const vulns = checker.checkForKnownVulns("jsonwebtoken", "8.5.1");
      expect(vulns.length).toBeGreaterThanOrEqual(1);
      expect(vulns[0].severity).toBe("critical");
    });

    it("should flag potential typosquatting", () => {
      const vulns = checker.checkForKnownVulns("lodash-utils", "1.0.0");
      const typosquat = vulns.filter((v) => v.description.includes("typosquatting"));
      expect(typosquat.length).toBeGreaterThanOrEqual(1);
    });

    it("should return empty for unknown safe packages", () => {
      const vulns = checker.checkForKnownVulns("safe-unknown-package", "1.0.0");
      expect(vulns.length).toBe(0);
    });
  });

  describe("checkPackageJson", () => {
    it("should detect vulns in package.json", () => {
      const pkgPath = join(TEST_DIR, "pkg-vuln.json");
      writeFileSync(
        pkgPath,
        JSON.stringify({
          dependencies: {
            lodash: "^4.17.15",
            minimist: "^1.2.0",
          },
        })
      );
      const vulns = checker.checkPackageJson(pkgPath);
      expect(vulns.length).toBeGreaterThanOrEqual(2);
    });

    it("should return empty for nonexistent file", () => {
      const vulns = checker.checkPackageJson("/nonexistent/package.json");
      expect(vulns.length).toBe(0);
    });

    it("should handle invalid JSON", () => {
      const pkgPath = join(TEST_DIR, "pkg-bad.json");
      writeFileSync(pkgPath, "not json at all{{{");
      const vulns = checker.checkPackageJson(pkgPath);
      expect(vulns.length).toBe(1);
      expect(vulns[0].severity).toBe("high");
    });
  });

  describe("auditProject", () => {
    it("should produce a full audit report", () => {
      const projDir = join(TEST_DIR, "project1");
      mkdirSync(projDir, { recursive: true });
      writeFileSync(
        join(projDir, "package.json"),
        JSON.stringify({
          dependencies: {
            express: "^4.17.0",
            lodash: "^4.17.21",
          },
          devDependencies: {
            vitest: "^1.0.0",
          },
        })
      );
      const report = checker.auditProject(projDir);
      expect(report.totalDeps).toBe(3);
      expect(report.projectDir).toBe(projDir);
      // Missing lock file should be flagged
      const lockIssue = report.vulnerabilities.find((v) =>
        v.description.includes("lock file")
      );
      expect(lockIssue).toBeDefined();
    });

    it("should flag unpinned dependencies", () => {
      const projDir = join(TEST_DIR, "project2");
      mkdirSync(projDir, { recursive: true });
      writeFileSync(
        join(projDir, "package.json"),
        JSON.stringify({
          dependencies: {
            "some-pkg": "*",
            "another-pkg": "latest",
          },
        })
      );
      const report = checker.auditProject(projDir);
      expect(report.outdatedDeps.length).toBeGreaterThanOrEqual(2);
    });

    it("should return empty report for nonexistent project", () => {
      const report = checker.auditProject("/nonexistent/project");
      expect(report.totalDeps).toBe(0);
    });
  });
});
