---
name: fix-precommit
description: >
  Fix pre-commit hook failures. Run after a failed git commit to
  automatically resolve ruff lint errors, TypeScript type errors,
  test failures, and ESLint issues. Chains fixes per hook and
  re-stages corrected files.
triggers:
  - fix the pre-commit
  - make the hooks pass
  - pre-commit failed
  - git commit failed
allowed-tools:
  - Bash
  - Read
  - Edit
  - Grep
  - Glob
---

# /fix-precommit

Fix all pre-commit hook failures and re-stage corrected files.

## Steps

1. **Capture failures**: Run `pre-commit run --all-files 2>&1` and pipe through
   `scripts/parse-output.sh` to get structured JSON of failures.

2. **Fix each hook failure** in order:

   | Hook | Fix Strategy |
   |------|-------------|
   | `ruff` | Run `ruff check --fix . && ruff format .` |
   | `ruff-format` | Run `ruff format .` |
   | `tsc-sdk` | Read error output, fix type errors in `claude-multi-agent-sdk/` |
   | `tsc-dispatch` | Read error output, fix type errors in `claude-multi-agent-dispatch/` |
   | `tsc-agenttasks` | Read error output, fix type errors in `agenttasks/` |
   | `eslint-agenttasks` | Run `cd agenttasks && npx eslint --fix .`, then manual fix remaining |
   | `vitest-sdk` | Read test output, diagnose and fix root cause in SDK |
   | `vitest-dispatch` | Read test output, diagnose and fix root cause in dispatch |
   | `pytest-python` | Read test output, diagnose and fix root cause |

   For `radon-complexity` and `ts-complexity`: these are warn-only (always exit 0).
   Report the warnings but do not attempt to fix them.

3. **Re-stage fixed files**: `git add <fixed-files>`

4. **Verify**: Run `pre-commit run --all-files` again to confirm all hooks pass.

5. **Report**: Summarize what failed, what was fixed, and what needs manual attention.

## Notes

- Never use `--no-verify` to bypass hooks. Fix the root cause.
- If a test failure requires understanding business logic, ask the user before fixing.
- Ruff and ESLint auto-fixes are safe to apply without confirmation.
- TypeScript type errors should be read carefully — don't cast to `any`.
