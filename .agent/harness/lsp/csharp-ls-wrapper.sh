#!/usr/bin/env bash
set -euo pipefail
export DOTNET_ROOT=/usr/lib/dotnet
export DOTNET_HOST_PATH=/usr/lib/dotnet/dotnet
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export PATH="/usr/lib/dotnet:$PATH"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SLN_ARGS=()
if [ -f "$ROOT/backend/Cogain.Lsp.slnf" ]; then
  SLN_ARGS=(--solution "$ROOT/backend/Cogain.Lsp.slnf")
elif [ -f "$ROOT/backend/CogainSolution.sln" ]; then
  SLN_ARGS=(--solution "$ROOT/backend/CogainSolution.sln")
fi

if [ -x "$HOME/.dotnet10/tools/csharp-ls" ]; then
  export DOTNET_ROOT_X64="$HOME/.dotnet10"
  exec "$HOME/.dotnet10/tools/csharp-ls" "${SLN_ARGS[@]}" "$@"
elif [ -x "$HOME/.dotnet/tools/csharp-ls" ]; then
  exec "$HOME/.dotnet/tools/csharp-ls" "${SLN_ARGS[@]}" "$@"
else
  echo "csharp-ls binary not found in ~/.dotnet10/tools or ~/.dotnet/tools" >&2
  exit 1
fi
