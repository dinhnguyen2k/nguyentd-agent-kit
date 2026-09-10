#!/usr/bin/env bash
# Bật/tắt role cho agent-boundary-guard.
#
# Đây là cổng do NGƯỜI DÙNG mở, không phải bước agent tự làm khi bị chặn.
# Trong Claude Code, gõ trực tiếp ở ô nhập:  ! .agent/scripts/agent-role.sh verifier
#
#   agent-role.sh                 -> hiện role hiện tại
#   agent-role.sh verifier        -> mở cổng chạy test suite (TTL 8h)
#   agent-role.sh test-author     -> mở cổng ghi backend/tests/**
#   agent-role.sh maintainer      -> mở cổng sửa file cấu hình enforcement
#   agent-role.sh clear           -> quay lại implementer (chặt nhất)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="$ROOT/.agent/scratch/.runtime"
STATE_FILE="$STATE_DIR/agent-role"
LOG_FILE="$ROOT/.agent/reports/boundary-guard.log"
VALID="implementer backend-specialist frontend-specialist test-author verifier orchestrator maintainer"

mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"

show() {
  if [[ -f "$STATE_FILE" ]]; then
    local age_s role
    role="$(cat "$STATE_FILE")"
    age_s=$(( $(date +%s) - $(stat -c %Y "$STATE_FILE") ))
    if (( age_s > 28800 )); then
      echo "role: implementer (state '$role' đã hết hạn sau $((age_s / 3600))h)"
    else
      echo "role: $role (còn hiệu lực $(( (28800 - age_s) / 60 )) phút)"
    fi
  else
    echo "role: implementer (mặc định)"
  fi
}

arg="${1:-show}"

case "$arg" in
  show|--show|-s)
    show
    ;;
  clear|reset|off)
    rm -f "$STATE_FILE"
    echo "$(date -Is) ROLE-SET role=implementer by=user(clear)" >> "$LOG_FILE"
    show
    ;;
  *)
    if [[ " $VALID " != *" $arg "* ]]; then
      echo "role không hợp lệ: $arg" >&2
      echo "hợp lệ: $VALID" >&2
      exit 1
    fi
    printf '%s' "$arg" > "$STATE_FILE"
    echo "$(date -Is) ROLE-SET role=$arg by=user ttl=8h" >> "$LOG_FILE"
    show
    ;;
esac
