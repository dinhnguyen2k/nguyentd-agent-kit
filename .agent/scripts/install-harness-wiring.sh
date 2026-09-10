#!/usr/bin/env bash
# Dựng lại toàn bộ symlink wiring cho các harness từ nguồn chung `.agent/`.
# Idempotent: chạy lại bao nhiêu lần cũng ra cùng một trạng thái.
#
#   bash .agent/scripts/install-harness-wiring.sh          # cài
#   bash .agent/scripts/install-harness-wiring.sh --check   # chỉ kiểm tra, không sửa
#
# Nguyên tắc: file thật nằm ở `.agent/`, thư mục của từng harness chỉ chứa symlink.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1
fail=0

# link <đường dẫn link> <target tương đối so với thư mục chứa link>
link() {
  local linkpath="$1" target="$2"
  local dir resolved
  dir="$(dirname "$linkpath")"
  if [[ -L "$linkpath" ]]; then
    if [[ "$(readlink "$linkpath")" == "$target" ]]; then
      echo "  ok      $linkpath -> $target"
      return
    fi
    echo "  DIFF    $linkpath -> $(readlink "$linkpath") (mong đợi $target)"
  elif [[ -e "$linkpath" ]]; then
    echo "  FILE    $linkpath là file thật, không phải symlink"
    fail=1
    return
  else
    echo "  MISSING $linkpath"
  fi
  if (( CHECK_ONLY )); then
    fail=1
    return
  fi
  resolved="$dir/$target"
  if [[ ! -e "$resolved" ]]; then
    echo "  ERROR   target không tồn tại: $resolved"
    fail=1
    return
  fi
  mkdir -p "$dir"
  ln -sfn "$target" "$linkpath"
  echo "  linked  $linkpath -> $target"
}

echo "== claude =="
link ".claude/settings.json"        "../.agent/harness/claude/settings.json"
link ".claude/skills"               "../.agent/skills"
link ".claude/agents/verifier.md"   "../../.agent/agents/verifier.md"
link ".claude/agents/test-author.md" "../../.agent/agents/test-author.md"

echo "== codex =="
link ".codex/agents"    "../.agent/agents"
link ".codex/skills"    "../.agent/skills"
link ".codex/workflows" "../.agent/workflows"

echo "== antigravity / generic (.agents) =="
link ".agents/agents"    "../.agent/agents"
link ".agents/skills"    "../.agent/skills"
link ".agents/workflows" "../.agent/workflows"

echo "== entry files =="
for f in CLAUDE.md GEMINI.md ANTIGRAVITY.md; do
  link "$f" "AGENTS.md"
done

echo
echo "Cưỡng chế ranh giới theo harness:"
echo "  claude      : hook thật (.agent/harness/claude/settings.json -> PreToolUse)"
echo "  codex/AGY   : chưa có hook, dùng CLI mode:"
echo "                node .agent/scripts/agent-boundary-guard.mjs --check-command \"<cmd>\""
echo
if (( fail )); then
  echo "KHÔNG ĐỒNG BỘ. Chạy lại không kèm --check để sửa."
  exit 1
fi
echo "Wiring đồng bộ."
