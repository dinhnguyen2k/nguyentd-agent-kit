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
  # Thư mục harness có thể chưa tồn tại (lần cài đầu): `dir/../x` chỉ resolve được khi `dir` đã có.
  mkdir -p "$dir"
  resolved="$dir/$target"
  if [[ ! -e "$resolved" ]]; then
    echo "  ERROR   target không tồn tại: $resolved"
    fail=1
    return
  fi
  ln -sfn "$target" "$linkpath"
  echo "  linked  $linkpath -> $target"
}

# render <file đích> <nội dung mong đợi>
# Dùng cho file sinh ra (không symlink được vì frontmatter khác chuẩn giữa các harness).
render() {
  local out="$1" expected="$2"
  if [[ -L "$out" ]]; then
    echo "  LINK    $out là symlink, mong đợi file sinh"
    fail=1
    return
  fi
  if [[ -f "$out" ]] && [[ "$(cat "$out")" == "$expected" ]]; then
    echo "  ok      $out"
    return
  fi
  [[ -f "$out" ]] && echo "  DIFF    $out" || echo "  MISSING $out"
  if (( CHECK_ONLY )); then
    fail=1
    return
  fi
  mkdir -p "$(dirname "$out")"
  printf '%s\n' "$expected" > "$out"
  echo "  wrote   $out"
}

# render_agents_dir <thư mục header> <thư mục đích>
# Ghép header harness + thân profile chung (.agent/agents/, bỏ frontmatter Claude).
render_agents_dir() {
  local header_dir="$1" out_dir="$2"
  local header name body out
  for header in "$header_dir"/*.md; do
    [[ -f "$header" ]] || continue
    name="$(basename "$header")"
    body=""
    [[ -f ".agent/agents/$name" ]] && body="$(printf '\n'; awk 'seen >= 2 { print; next } /^---$/ { seen++ }' ".agent/agents/$name")"
    render "$out_dir/$name" "$(cat "$header")$body"
  done
  for out in "$out_dir"/*.md; do
    [[ -e "$out" || -L "$out" ]] || continue
    name="$(basename "$out")"
    if [[ ! -f "$header_dir/$name" ]]; then
      if (( CHECK_ONLY )); then
        echo "  STALE   $out"
        fail=1
      else
        rm -f "$out"
        echo "  removed $out"
      fi
    fi
  done
}

echo "== claude =="
link ".claude/settings.json"        "../.agent/harness/claude/settings.json"
link ".claude/skills"               "../.agent/skills"
link ".claude/rules"                "../.agent/rules"
if [[ -d ".claude/commands" && ! -L ".claude/commands" ]] && (( ! CHECK_ONLY )); then
  rm -rf ".claude/commands"
  echo "  removed directory .claude/commands -> thay bằng symlink"
fi
link ".claude/commands"             "../.agent/workflows"
for agent in verifier test-author researcher reviewer backend-specialist frontend-specialist; do
  link ".claude/agents/$agent.md" "../../.agent/agents/$agent.md"
done

for stale in tech-lead orchestrator command-agent-creator; do
  if [[ -e ".claude/agents/$stale.md" || -L ".claude/agents/$stale.md" ]]; then
    if (( CHECK_ONLY )); then
      echo "  STALE   .claude/agents/$stale.md"
      fail=1
    else
      rm -f ".claude/agents/$stale.md"
      echo "  removed .claude/agents/$stale.md"
    fi
  fi
done
echo "== codex =="
link ".codex/agents"    "../.agent/agents"
link ".codex/skills"    "../.agent/skills"
link ".codex/workflows" "../.agent/workflows"

echo "== antigravity / generic (.agents) =="
link ".agents/hooks.json" "../.agent/harness/agy/hooks.json"
link ".agents/skills"     "../.agent/skills"
link ".agents/workflows"  "../.agent/workflows"
if [[ -L ".agents/agents" ]]; then
  if (( CHECK_ONLY )); then
    echo "  LINK    .agents/agents là symlink, mong đợi thư mục chứa file sinh"
    fail=1
  else
    rm -f ".agents/agents"
    mkdir -p ".agents/agents"
    echo "  replaced symlink .agents/agents -> thư mục chứa file sinh"
  fi
fi
if [[ ! -L ".agents/agents" ]]; then
  render_agents_dir ".agent/harness/agy/agents" ".agents/agents"
fi

echo "== omp =="
if [[ -e ".agent/harness/omp/RULES.md" && ! -L ".agent/harness/omp/RULES.md" ]] && (( ! CHECK_ONLY )); then
  rm -f ".agent/harness/omp/RULES.md"
fi
link ".agent/harness/omp/RULES.md" "../../../AI_RULES.md"
link ".omp/RULES.md"               "../AI_RULES.md"
link ".omp/WATCHDOG.md"            "../.agent/harness/omp/WATCHDOG.md"
link ".omp/WATCHDOG.yml"           "../.agent/harness/omp/WATCHDOG.yml"
link ".omp/config.yml"             "../.agent/harness/omp/config.yml"
link ".omp/lsp.json"               "../.agent/harness/omp/lsp.json"
link ".omp/rules"                  "../.agent/harness/omp/rules"
link ".omp/hooks"                  "../.agent/harness/omp/hooks"
render_agents_dir ".agent/harness/omp/agents" ".omp/agents"

echo "== entry files =="
for f in CLAUDE.md GEMINI.md ANTIGRAVITY.md; do
  link "$f" "AGENTS.md"
done
if [[ -e ".agent/GEMINI.md" && ! -L ".agent/GEMINI.md" ]] && (( ! CHECK_ONLY )); then
  rm -f ".agent/GEMINI.md"
fi
link ".agent/GEMINI.md" "../AGENTS.md"

echo
echo "Cưỡng chế ranh giới theo harness:"
echo "  claude      : hook thật (.agent/harness/claude/settings.json -> PreToolUse)"
echo "  omp         : hook thật (.agent/harness/omp/hooks/pre/boundary-guard.ts -> tool_call)"
echo "  agy         : hook thật (.agent/harness/agy/hooks.json -> PreToolUse)"
echo "  codex       : chưa có hook, dùng CLI mode:"
echo "                node .agent/scripts/agent-boundary-guard.mjs --check-command \"<cmd>\""
echo
if (( fail )); then
  echo "KHÔNG ĐỒNG BỘ. Chạy lại không kèm --check để sửa."
  exit 1
fi
echo "Wiring đồng bộ."
