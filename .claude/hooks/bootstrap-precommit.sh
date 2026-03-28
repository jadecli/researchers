#!/usr/bin/env bash
# .claude/hooks/bootstrap-precommit.sh — Layer 2 fallback
# Auto-installs pre-commit if missing (catches ephemeral envs where
# SessionStart was missed). Called by .git/hooks/pre-commit.
#
# Defense-in-depth:
#   Layer 1: SessionStart hook (session-setup.sh) → installs via make setup
#   Layer 2: This script → catches missed SessionStart on ephemeral cloud
#   Layer 3: GitHub Actions CI → deterministic backstop (can't be skipped)

set -euo pipefail

if ! command -v pre-commit >/dev/null 2>&1; then
  echo "pre-commit not found — auto-installing..."
  if command -v uv >/dev/null 2>&1; then
    uv tool install pre-commit 2>/dev/null || true
    uv tool install radon 2>/dev/null || true
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install --user pre-commit 2>/dev/null || true
  fi
fi

if command -v pre-commit >/dev/null 2>&1; then
  pre-commit install --install-hooks 2>/dev/null || true
  exec pre-commit run --hook-stage pre-commit "$@"
else
  echo "WARNING: Could not install pre-commit. Commit proceeding without checks."
  echo "Run 'make setup' to fix."
  exit 0  # Don't block — warn only on install failure
fi
