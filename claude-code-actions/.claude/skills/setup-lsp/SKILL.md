# Skill: Setup LSP

Install and configure Language Server Protocol servers for 11 languages.

## When to Use

- Setting up a new development environment with LSP support
- Verifying existing LSP installations
- Configuring editor LSP settings for a specific language

## Instructions

1. Install all 11 LSP servers:
   ```bash
   bash lsp_setup/install_all_lsp.sh
   ```
   The script auto-detects the platform (Linux/macOS) and installs via
   the appropriate package manager (npm, pip, go install, cargo, etc.).
   Already-installed servers are skipped.

2. Verify installations:
   ```bash
   python lsp_setup/verify_lsp.py
   ```
   Use `--strict` to exit 1 if any server fails.
   Use `--json-output` for machine-readable results.

3. LSP configs are in `lsp_setup/lsp_configs/*.json`. Each contains:
   - `name` -- server name
   - `command` -- command to start the server
   - `filetypes` -- supported file types
   - `root_markers` -- files that indicate a project root
   - `initialization_options` -- LSP init params
   - `settings` -- server-specific settings

## Supported Language Servers

| Language | Server | Config File |
|----------|--------|-------------|
| Python | pyright | pyright.json |
| TypeScript/JS | typescript-language-server | typescript.json |
| Go | gopls | gopls.json |
| Rust | rust-analyzer | rust-analyzer.json |
| Java | jdtls | jdtls.json |
| Kotlin | kotlin-language-server | kotlin-ls.json |
| C# | csharp-ls | csharp-ls.json |
| C/C++ | clangd | clangd.json |
| PHP | intelephense | intelephense.json |
| Swift | sourcekit-lsp | sourcekit-lsp.json |
| Lua | lua-language-server | lua-ls.json |

## Key Files

- `lsp_setup/install_all_lsp.sh` -- installer script
- `lsp_setup/verify_lsp.py` -- verification script
- `lsp_setup/lsp_configs/` -- 11 JSON config files
- `.github/workflows/lsp-integration-test.yml` -- CI validation
