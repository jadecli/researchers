#!/usr/bin/env bash
set -euo pipefail

# install_all_lsp.sh — Install all 11 language server binaries.
# Supports Linux (apt/snap) and macOS (brew). Skips already-installed servers.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[LSP-Install]"

log()  { echo "${LOG_PREFIX} $*"; }
warn() { echo "${LOG_PREFIX} WARNING: $*" >&2; }
fail() { echo "${LOG_PREFIX} ERROR: $*" >&2; }

OS="$(uname -s)"
ARCH="$(uname -m)"
INSTALLED=0
SKIPPED=0
FAILED=0

check_cmd() { command -v "$1" >/dev/null 2>&1; }

install_if_missing() {
    local name="$1"
    local check_binary="$2"
    shift 2
    local install_cmd=("$@")

    if check_cmd "${check_binary}"; then
        log "${name}: already installed ($(command -v "${check_binary}"))"
        SKIPPED=$((SKIPPED + 1))
        return 0
    fi

    log "${name}: installing..."
    if "${install_cmd[@]}"; then
        log "${name}: installed successfully"
        INSTALLED=$((INSTALLED + 1))
    else
        fail "${name}: installation failed"
        FAILED=$((FAILED + 1))
    fi
}

# ─── 1. Pyright (Python) ───────────────────────────────────────────────
install_pyright() {
    if check_cmd npm; then
        install_if_missing "pyright" "pyright" npm install -g pyright
    elif check_cmd pip3; then
        install_if_missing "pyright" "pyright" pip3 install pyright
    else
        fail "pyright: neither npm nor pip3 available"
        FAILED=$((FAILED + 1))
    fi
}

# ─── 2. TypeScript Language Server ─────────────────────────────────────
install_typescript_ls() {
    if check_cmd npm; then
        install_if_missing "typescript-language-server" "typescript-language-server" \
            npm install -g typescript typescript-language-server
    else
        fail "typescript-language-server: npm not available"
        FAILED=$((FAILED + 1))
    fi
}

# ─── 3. gopls (Go) ────────────────────────────────────────────────────
install_gopls() {
    if check_cmd go; then
        install_if_missing "gopls" "gopls" go install golang.org/x/tools/gopls@latest
    else
        fail "gopls: go not available"
        FAILED=$((FAILED + 1))
    fi
}

# ─── 4. rust-analyzer (Rust) ──────────────────────────────────────────
install_rust_analyzer() {
    if check_cmd rustup; then
        install_if_missing "rust-analyzer" "rust-analyzer" rustup component add rust-analyzer
    elif [ "${OS}" = "Darwin" ] && check_cmd brew; then
        install_if_missing "rust-analyzer" "rust-analyzer" brew install rust-analyzer
    else
        # Direct binary download
        local platform
        case "${OS}-${ARCH}" in
            Linux-x86_64)   platform="x86_64-unknown-linux-gnu" ;;
            Linux-aarch64)  platform="aarch64-unknown-linux-gnu" ;;
            Darwin-x86_64)  platform="x86_64-apple-darwin" ;;
            Darwin-arm64)   platform="aarch64-apple-darwin" ;;
            *) fail "rust-analyzer: unsupported platform ${OS}-${ARCH}"; FAILED=$((FAILED+1)); return ;;
        esac
        local url="https://github.com/rust-lang/rust-analyzer/releases/latest/download/rust-analyzer-${platform}.gz"
        install_if_missing "rust-analyzer" "rust-analyzer" bash -c "
            curl -sL '${url}' | gunzip > /usr/local/bin/rust-analyzer &&
            chmod +x /usr/local/bin/rust-analyzer
        "
    fi
}

# ─── 5. jdtls (Java) ─────────────────────────────────────────────────
install_jdtls() {
    local jdtls_dir="${HOME}/.local/share/jdtls"
    if [ -d "${jdtls_dir}" ] && [ -f "${jdtls_dir}/bin/jdtls" ]; then
        log "jdtls: already installed"
        SKIPPED=$((SKIPPED + 1))
        return 0
    fi

    log "jdtls: installing..."
    mkdir -p "${jdtls_dir}"
    local version="1.31.0"
    local milestone="202312211634"
    local url="https://www.eclipse.org/downloads/download.php?file=/jdtls/milestones/${version}/jdt-language-server-${version}-${milestone}.tar.gz&r=1"

    if curl -sL "${url}" | tar xz -C "${jdtls_dir}"; then
        log "jdtls: installed to ${jdtls_dir}"
        INSTALLED=$((INSTALLED + 1))
    else
        fail "jdtls: installation failed"
        FAILED=$((FAILED + 1))
    fi
}

# ─── 6. Kotlin Language Server ────────────────────────────────────────
install_kotlin_ls() {
    local kls_dir="${HOME}/.local/share/kotlin-language-server"
    if [ -d "${kls_dir}" ]; then
        log "kotlin-language-server: already installed"
        SKIPPED=$((SKIPPED + 1))
        return 0
    fi

    log "kotlin-language-server: installing..."
    mkdir -p "${kls_dir}"
    local url="https://github.com/fwcd/kotlin-language-server/releases/latest/download/server.zip"

    if curl -sL "${url}" -o /tmp/kotlin-ls.zip && unzip -q -o /tmp/kotlin-ls.zip -d "${kls_dir}"; then
        chmod +x "${kls_dir}/server/bin/kotlin-language-server" 2>/dev/null || true
        log "kotlin-language-server: installed"
        INSTALLED=$((INSTALLED + 1))
    else
        fail "kotlin-language-server: installation failed"
        FAILED=$((FAILED + 1))
    fi
    rm -f /tmp/kotlin-ls.zip
}

# ─── 7. csharp-ls (C#) ───────────────────────────────────────────────
install_csharp_ls() {
    if check_cmd dotnet; then
        install_if_missing "csharp-ls" "csharp-ls" dotnet tool install --global csharp-ls
    else
        fail "csharp-ls: dotnet not available"
        FAILED=$((FAILED + 1))
    fi
}

# ─── 8. clangd (C/C++) ───────────────────────────────────────────────
install_clangd() {
    if [ "${OS}" = "Linux" ]; then
        install_if_missing "clangd" "clangd" bash -c "
            apt-get update -qq && apt-get install -y -qq clangd 2>/dev/null ||
            snap install clangd --classic 2>/dev/null ||
            { echo 'Install clangd manually'; exit 1; }
        "
    elif [ "${OS}" = "Darwin" ]; then
        install_if_missing "clangd" "clangd" brew install llvm
    else
        fail "clangd: unsupported OS ${OS}"
        FAILED=$((FAILED + 1))
    fi
}

# ─── 9. Intelephense (PHP) ───────────────────────────────────────────
install_intelephense() {
    if check_cmd npm; then
        install_if_missing "intelephense" "intelephense" npm install -g intelephense
    else
        fail "intelephense: npm not available"
        FAILED=$((FAILED + 1))
    fi
}

# ─── 10. sourcekit-lsp (Swift) ───────────────────────────────────────
install_sourcekit_lsp() {
    if [ "${OS}" = "Darwin" ]; then
        if check_cmd sourcekit-lsp; then
            log "sourcekit-lsp: already installed (bundled with Xcode)"
            SKIPPED=$((SKIPPED + 1))
        elif check_cmd xcrun; then
            log "sourcekit-lsp: available via xcrun"
            SKIPPED=$((SKIPPED + 1))
        else
            warn "sourcekit-lsp: install Xcode or Swift toolchain"
            FAILED=$((FAILED + 1))
        fi
    elif [ "${OS}" = "Linux" ]; then
        if check_cmd sourcekit-lsp; then
            log "sourcekit-lsp: already installed"
            SKIPPED=$((SKIPPED + 1))
        else
            warn "sourcekit-lsp: install Swift toolchain from swift.org"
            FAILED=$((FAILED + 1))
        fi
    fi
}

# ─── 11. lua-language-server ─────────────────────────────────────────
install_lua_ls() {
    local lua_ls_dir="${HOME}/.local/share/lua-language-server"
    if [ -d "${lua_ls_dir}" ] || check_cmd lua-language-server; then
        log "lua-language-server: already installed"
        SKIPPED=$((SKIPPED + 1))
        return 0
    fi

    log "lua-language-server: installing..."
    mkdir -p "${lua_ls_dir}"
    local platform
    case "${OS}-${ARCH}" in
        Linux-x86_64)  platform="linux-x64" ;;
        Linux-aarch64) platform="linux-arm64" ;;
        Darwin-x86_64) platform="darwin-x64" ;;
        Darwin-arm64)  platform="darwin-arm64" ;;
        *) fail "lua-language-server: unsupported platform"; FAILED=$((FAILED+1)); return ;;
    esac

    local url="https://github.com/LuaLS/lua-language-server/releases/latest/download/lua-language-server-3.7.4-${platform}.tar.gz"

    if curl -sL "${url}" | tar xz -C "${lua_ls_dir}"; then
        log "lua-language-server: installed to ${lua_ls_dir}"
        INSTALLED=$((INSTALLED + 1))
    else
        fail "lua-language-server: installation failed"
        FAILED=$((FAILED + 1))
    fi
}

# ─── Main ────────────────────────────────────────────────────────────

log "Installing 11 LSP servers on ${OS} ${ARCH}..."
echo ""

install_pyright
install_typescript_ls
install_gopls
install_rust_analyzer
install_jdtls
install_kotlin_ls
install_csharp_ls
install_clangd
install_intelephense
install_sourcekit_lsp
install_lua_ls

echo ""
log "Summary: ${INSTALLED} installed, ${SKIPPED} skipped, ${FAILED} failed"

if [ "${FAILED}" -gt 0 ]; then
    warn "${FAILED} server(s) failed to install"
    exit 1
fi

log "All LSP servers ready"
