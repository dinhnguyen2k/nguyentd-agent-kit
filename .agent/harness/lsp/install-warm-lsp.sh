#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGY_LSP_HOME="${AGY_LSP_HOME:-$HOME/.local/share/agy-lsp}"
RESTART_DAEMON=0
for arg in "$@"; do
  if [ "$arg" = "--restart-daemon" ]; then
    RESTART_DAEMON=1
  fi
done

mkdir -p "$AGY_LSP_HOME" "$AGY_LSP_HOME/bin" "$HOME/.local/bin"

chmod +x "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR/lsp-cli.mjs"

cp -f "$SCRIPT_DIR"/*.mjs "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR/package.json" "$AGY_LSP_HOME/"
if ls "$SCRIPT_DIR"/*.c >/dev/null 2>&1; then
  cp -f "$SCRIPT_DIR"/*.c "$AGY_LSP_HOME/"
fi
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

CC_BIN=""
if command -v gcc >/dev/null 2>&1; then
  CC_BIN="gcc"
elif command -v cc >/dev/null 2>&1; then
  CC_BIN="cc"
fi

if [ -n "$CC_BIN" ] && [ -f "$AGY_LSP_HOME/cogain-hook.c" ]; then
  "$CC_BIN" -O3 -Wall -Wextra -Werror -s "$AGY_LSP_HOME/cogain-hook.c" -o "$AGY_LSP_HOME/bin/cogain-hook"
  chmod +x "$AGY_LSP_HOME/bin/cogain-hook"
  ln -sfn "$AGY_LSP_HOME/bin/cogain-hook" "$HOME/.local/bin/cogain-hook"
fi

ln -sfn "$AGY_LSP_HOME/lsp-cli.mjs" "$HOME/.local/bin/cogain-lsp"

if (( RESTART_DAEMON )); then
  if [ -f "$AGY_LSP_HOME/daemon.json" ]; then
    OLD_PID="$(node -e 'try{const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(d?.pid) console.log(d.pid)}catch{}' "$AGY_LSP_HOME/daemon.json" || true)"
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
      kill "$OLD_PID" 2>/dev/null || true
      for _ in $(seq 1 20); do
        kill -0 "$OLD_PID" 2>/dev/null || break
        sleep 0.1
      done
    fi
  fi
  node "$AGY_LSP_HOME/lsp-cli.mjs" status >/dev/null
fi

echo "Installed Warm LSP & Hook daemon assets to $AGY_LSP_HOME and linked $HOME/.local/bin/{cogain-lsp,cogain-hook}"
