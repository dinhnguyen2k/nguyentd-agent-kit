#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LOCAL_TSGO="$SCRIPT_DIR/tsgo-lib/tsgo"
if [ -x "$LOCAL_TSGO" ]; then
  exec "$LOCAL_TSGO" --lsp --stdio "$@"
fi

CACHED_TSGO="$(find "$HOME/.cache/pnpm/dlx" -path '*@typescript+native-preview-*/lib/tsgo' -type f 2>/dev/null | head -n 1 || true)"
if [ -n "$CACHED_TSGO" ] && [ -x "$CACHED_TSGO" ]; then
  exec "$CACHED_TSGO" --lsp --stdio "$@"
fi

if command -v tsgo >/dev/null 2>&1; then
  exec tsgo --lsp --stdio "$@"
fi

exec "$SCRIPT_DIR/node_modules/.bin/typescript-language-server" --stdio "$@"
