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

# has_paths_frontmatter <file.md>
# Trả về 0 nếu YAML frontmatter đầu tệp có khai báo trường `paths:`.
has_paths_frontmatter() {
  awk '
    BEGIN { in_fm=0; closed=0; found=0 }
    NR==1 && $0 ~ /^---[[:space:]]*$/ { in_fm=1; next }
    in_fm && !closed && $0 ~ /^---[[:space:]]*$/ { closed=1; exit }
    in_fm && !closed && $0 ~ /^paths:/ { found=1 }
    END { exit (closed && found) ? 0 : 1 }
  ' "$1"
}

echo "== claude =="
link ".claude/settings.json"        "../.agent/harness/claude/settings.json"
link ".claude/skills"               "../.agent/skills"
if [[ -L ".claude/rules" ]]; then
  if (( CHECK_ONLY )); then
    echo "  LINK    .claude/rules là symlink cả thư mục (gây bơm tràn rules), mong đợi thư mục chứa symlink theo từng file có paths:"
    fail=1
  else
    rm -f ".claude/rules"
    mkdir -p ".claude/rules"
    echo "  replaced symlink .claude/rules -> thư mục chứa symlink có paths:"
  fi
elif [[ -e ".claude/rules" && ! -d ".claude/rules" ]]; then
  echo "  FILE    .claude/rules tồn tại nhưng không phải thư mục"
  fail=1
elif [[ ! -e ".claude/rules" ]]; then
  if (( CHECK_ONLY )); then
    echo "  MISSING .claude/rules"
    fail=1
  else
    mkdir -p ".claude/rules"
  fi
fi
if [[ -d ".claude/rules" && ! -L ".claude/rules" ]]; then
  for rule_file in .agent/rules/*.md; do
    [[ -f "$rule_file" ]] || continue
    if has_paths_frontmatter "$rule_file"; then
      name="$(basename "$rule_file")"
      link ".claude/rules/$name" "../../.agent/rules/$name"
    fi
  done
  for existing_rule in .claude/rules/*; do
    [[ -e "$existing_rule" || -L "$existing_rule" ]] || continue
    name="$(basename "$existing_rule")"
    if [[ ! -f ".agent/rules/$name" ]] || ! has_paths_frontmatter ".agent/rules/$name"; then
      if (( CHECK_ONLY )); then
        echo "  STALE   $existing_rule (không có paths: hoặc không còn trong .agent/rules)"
        fail=1
      else
        rm -f "$existing_rule"
        echo "  removed $existing_rule"
      fi
    fi
  done
fi
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
link ".codex/config.toml" "../.agent/harness/codex/config.toml"
link ".codex/hooks.json"  "../.agent/harness/codex/hooks.json"
link ".codex/agents"      "../.agent/agents"
link ".codex/skills"      "../.agent/skills"
link ".codex/workflows"   "../.agent/workflows"

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
echo "  claude      : hook thật (.agent/harness/claude/settings.json -> hook-entry.mjs: PreToolUse/PostToolUse/PreCompact/SubagentStop)"
echo "  codex       : hook thật (.agent/harness/codex/hooks.json -> hook-entry.mjs: PreToolUse) + config.toml"
echo "  omp         : hook thật (.agent/harness/omp/hooks/pre/boundary-guard.ts -> tool_call)"
echo "  agy         : hook thật (.agent/harness/agy/hooks.json -> PreToolUse/PostToolUse/PreInvocation/Stop)"
echo "  git/cli     : node .agent/scripts/agent-lifecycle-core.mjs --check-staged [--sandbox]"
echo
if (( fail )); then
  echo "KHÔNG ĐỒNG BỘ. Chạy lại không kèm --check để sửa."
  exit 1
fi
echo "Wiring đồng bộ."
