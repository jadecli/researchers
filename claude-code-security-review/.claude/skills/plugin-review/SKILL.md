---
name: plugin-review
description: Security review of a generated knowledge-work plugin
disable-model-invocation: true
allowed-tools: Bash(python *), Read, Grep, Glob
argument-hint: <plugin-directory>
---

# Plugin Security Review

Perform a comprehensive security review of a generated knowledge-work plugin.

Checks performed:
- **plugin.json**: Schema validation, required fields, credential patterns
- **SKILL.md**: Content length, prompt injection patterns (ignore instructions, persona hijack, jailbreak)
- **hooks.json**: Unsafe command patterns (shell=True, rm -rf, sudo, privilege escalation)
- **.mcp.json**: Server type validation, disallowed URL patterns (.onion, .i2p, localhost)
- **Scripts**: Disallowed functions (eval, exec, os.system), credential literals, excessive file size

Usage:
```bash
python -m scanners.plugin_scanner <plugin-directory>
```
