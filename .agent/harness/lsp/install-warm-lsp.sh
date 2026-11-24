#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGY_LSP_HOME="${AGY_LSP_HOME:-$HOME/.local/share/agy-lsp}"

mkdir -p "$AGY_LSP_HOME" "$HOME/.local/bin"

chmod +x "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR/lsp-cli.mjs"

cp -f "$SCRIPT_DIR"/*.mjs "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR/package.json" "$AGY_LSP_HOME/"
chmod +x "$AGY_LSP_HOME"/*.sh "$AGY_LSP_HOME/lsp-cli.mjs"

if [ ! -d "$AGY_LSP_HOME/node_modules/@modelcontextprotocol/sdk" ]; then
  npm install --no-audit --no-fund --prefix "$AGY_LSP_HOME"
fi

if [ ! -x "$AGY_LSP_HOME/tsgo-lib/tsgo" ] && [ -d "$HOME/.cache/pnpm/dlx" ]; then
  CACHED_LIB_DIR="$(find "$HOME/.cache/pnpm/dlx" -path '*@typescript+native-preview-*/lib/tsgo' -type f 2>/dev/null | head -n 1 | xargs -r dirname || true)"
  if [ -n "$CACHED_LIB_DIR" ] && [ -d "$CACHED_LIB_DIR" ]; then
    rm -rf "$AGY_LSP_HOME/tsgo-lib"
    cp -a "$CACHED_LIB_DIR" "$AGY_LSP_HOME/tsgo-lib"
  fi
fi

ln -sfn "$AGY_LSP_HOME/lsp-cli.mjs" "$HOME/.local/bin/cogain-lsp"
echo "Installed Warm LSP daemon assets to $AGY_LSP_HOME and linked $HOME/.local/bin/cogain-lsp"
