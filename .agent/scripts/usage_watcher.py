#!/usr/bin/env python3
"""
Antigravity CLI - Realtime Usage & Context Monitor (Sidecar Watcher)
------------------------------------------------------------------
Theo dõi token usage, context window, turns, tool calls và chi phí ước tính
của Antigravity CLI theo thời gian thực (realtime).

Modes:
  python3 .agent/scripts/usage_watcher.py --daemon       # Chạy ngầm sync file ra Windows/Linux
  python3 .agent/scripts/usage_watcher.py                 # Chế độ Dashboard đầy đủ TUI
  python3 .agent/scripts/usage_watcher.py --compact       # Chế độ 1 dòng loop
  python3 .agent/scripts/usage_watcher.py --compact-once  # In 1 dòng rồi thoát ngay
  python3 .agent/scripts/usage_watcher.py --json          # Xuất JSON 1 lần
  python3 .agent/scripts/usage_watcher.py --reset-quota    # Reset mốc quota về hiện tại
"""

import argparse
import glob
import json
import os
import re
import shutil
import sys
import time
from datetime import datetime, timedelta

# ANSI Color Codes
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"
CYAN = "\033[36m"
WHITE = "\033[37m"

DEFAULT_MAX_TOKENS = 1_000_000  # 1M Context Window
DEFAULT_QUOTA_HOURS = 5.0  # Rolling quota cycle (matches Claude CLI window convention)

QUOTA_STATE_FILE = os.path.expanduser("~/.agy_quota_state.json")

PRICING = {
    "Gemini 3.7 Flash": {"input": 0.075, "output": 0.30},
    "Gemini 3.6 Flash": {"input": 0.075, "output": 0.30},
    "Gemini 2.0 Flash": {"input": 0.10, "output": 0.40},
    "Gemini 2.0 Pro": {"input": 1.25, "output": 5.00},
    "Gemini 1.5 Pro": {"input": 1.25, "output": 5.00},
    "Default": {"input": 0.10, "output": 0.40},
}


def strip_ansi(text):
    return re.sub(r"\033\[[0-9;?]*[a-zA-Z]", "", text)


def load_quota_state():
    """Load persistent quota state (reset timestamp, quota duration)."""
    default_state = {
        "quota_reset_at": datetime.now().isoformat(),
        "duration_hours": DEFAULT_QUOTA_HOURS,
    }
    if os.path.exists(QUOTA_STATE_FILE):
        try:
            with open(QUOTA_STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "quota_reset_at" in data:
                    return data
        except Exception:
            pass
    save_quota_state(default_state)
    return default_state


def save_quota_state(state):
    """Save persistent quota state to file."""
    try:
        tmp_file = QUOTA_STATE_FILE + ".tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
        os.replace(tmp_file, QUOTA_STATE_FILE)
    except Exception:
        pass


def reset_quota(hours=DEFAULT_QUOTA_HOURS):
    """Reset quota start time to current timestamp."""
    state = {
        "quota_reset_at": datetime.now().isoformat(),
        "duration_hours": float(hours),
    }
    save_quota_state(state)
    return state


def roll_quota_window(state):
    """Auto-advance quota window to the current cycle once the previous one fully elapsed."""
    try:
        reset_dt = datetime.fromisoformat(state["quota_reset_at"])
        duration = float(state.get("duration_hours", DEFAULT_QUOTA_HOURS))
    except Exception:
        return state

    if duration <= 0:
        return state

    elapsed_hours = (datetime.now() - reset_dt).total_seconds() / 3600.0
    if elapsed_hours >= duration:
        cycles = int(elapsed_hours // duration)
        new_reset_dt = reset_dt + timedelta(hours=duration * cycles)
        state = {"quota_reset_at": new_reset_dt.isoformat(), "duration_hours": duration}
        save_quota_state(state)
    return state


def parse_quota_usage(quota_reset_iso):
    """Parse usage across all conversation transcripts, counting only messages since quota_reset_iso."""
    try:
        reset_dt = datetime.fromisoformat(quota_reset_iso)
    except Exception:
        reset_dt = datetime.now() - timedelta(hours=DEFAULT_QUOTA_HOURS)

    reset_ts = reset_dt.timestamp()
    brain_dir = os.path.expanduser("~/.gemini/antigravity-cli/brain")
    logs = glob.glob(os.path.join(brain_dir, "*", ".system_generated", "logs", "transcript*.jsonl")) if os.path.exists(brain_dir) else []
    candidate_logs = [l for l in logs if os.path.getmtime(l) >= reset_ts]

    CHAR_PER_TOKEN = 3.2
    quota_stats = {
        "input_tokens": 0,
        "output_tokens": 0,
        "thinking_tokens": 0,
        "total_tokens": 0,
        "est_cost_usd": 0.0,
        "turns": 0,
        "steps": 0,
        "session_count": 0,
    }

    sessions_seen = set()

    for log_path in candidate_logs:
        model = get_latest_model(log_path)
        pricing = PRICING.get(model, PRICING["Default"])
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue

                ts_raw = d.get("created_at")
                if not ts_raw:
                    continue
                try:
                    line_ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00")).timestamp()
                except Exception:
                    continue
                if line_ts < reset_ts:
                    continue

                stype = d.get("type", "")
                source = d.get("source", "")
                content = d.get("content", "") or ""
                thinking = d.get("thinking", "") or ""

                quota_stats["steps"] += 1
                sessions_seen.add(log_path)

                if stype == "USER_INPUT":
                    quota_stats["turns"] += 1
                    in_tok = int(len(content) / CHAR_PER_TOKEN)
                    quota_stats["input_tokens"] += in_tok
                    quota_stats["est_cost_usd"] += (in_tok / 1_000_000) * pricing["input"]
                elif source == "MODEL":
                    out_tok = int(len(content) / CHAR_PER_TOKEN)
                    think_tok = int(len(thinking) / CHAR_PER_TOKEN)
                    quota_stats["output_tokens"] += out_tok
                    quota_stats["thinking_tokens"] += think_tok
                    quota_stats["est_cost_usd"] += ((out_tok + think_tok) / 1_000_000) * pricing["output"]

    quota_stats["session_count"] = len(sessions_seen)
    quota_stats["total_tokens"] = (
        quota_stats["input_tokens"] + quota_stats["output_tokens"] + quota_stats["thinking_tokens"]
    )
    return quota_stats, reset_dt


def format_timedelta(td):
    """Format timedelta as hh:mm:ss."""
    total_sec = int(max(0, td.total_seconds()))
    hours = total_sec // 3600
    minutes = (total_sec % 3600) // 60
    seconds = total_sec % 60
    return f"{hours:02d}h {minutes:02d}m {seconds:02d}s"


def get_windows_user_home():
    """Tìm thư mục Windows User Home nếu đang chạy trong WSL."""
    c_users = "/mnt/c/Users"
    if os.path.exists(c_users):
        for entry in os.listdir(c_users):
            if entry not in ["Public", "Default", "Default User", "All Users", "desktop.ini"]:
                user_path = os.path.join(c_users, entry)
                if os.path.isdir(user_path):
                    return user_path
    return os.path.expanduser("~")


def get_workspace_active_conv():
    """Tìm session ID gắn với workspace thư mục làm việc hiện tại."""
    cache_path = os.path.expanduser("~/.gemini/antigravity-cli/cache/last_conversations.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                d = json.load(f)
                cwd = os.getcwd()
                if cwd in d:
                    return d[cwd]
                for ws, cid in d.items():
                    if cwd.startswith(ws) or ws.startswith(cwd):
                        return cid
                # Fallback to any recent entry
                if d:
                    return list(d.values())[-1]
        except Exception:
            pass
    return None


def find_active_conversation_log(target_id=None):
    brain_dir = os.path.expanduser("~/.gemini/antigravity-cli/brain")

    if target_id:
        p_full = os.path.join(brain_dir, target_id, ".system_generated", "logs", "transcript_full.jsonl")
        if os.path.exists(p_full):
            return target_id, p_full
        p_short = os.path.join(brain_dir, target_id, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(p_short):
            return target_id, p_short
        return target_id, None

    ws_conv = get_workspace_active_conv()
    if ws_conv:
        p_full = os.path.join(brain_dir, ws_conv, ".system_generated", "logs", "transcript_full.jsonl")
        if os.path.exists(p_full):
            return ws_conv, p_full
        p_short = os.path.join(brain_dir, ws_conv, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(p_short):
            return ws_conv, p_short

    logs = glob.glob(os.path.join(brain_dir, "*", ".system_generated", "logs", "transcript*.jsonl"))
    if not logs:
        return None, None

    latest_log = max(logs, key=os.path.getmtime)
    parts = latest_log.split(os.sep)
    try:
        idx = parts.index(".system_generated")
        conv_id = parts[idx - 1]
    except ValueError:
        conv_id = "unknown"

    full_path = os.path.join(brain_dir, conv_id, ".system_generated", "logs", "transcript_full.jsonl")
    if os.path.exists(full_path):
        return conv_id, full_path
    return conv_id, latest_log


def get_latest_model(log_path):
    latest_model = None
    # 1. Check settings.json
    s_path = os.path.expanduser("~/.gemini/antigravity-cli/settings.json")
    if os.path.exists(s_path):
        try:
            with open(s_path, "r", encoding="utf-8") as f:
                d = json.load(f)
                m = d.get("model", "")
                if m:
                    latest_model = re.sub(r"\s*\(.*?\)", "", m).strip()
        except Exception:
            pass

    # 2. Check transcript for latest settings change
    if log_path and os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        d = json.loads(line)
                        if d.get("type") == "USER_INPUT":
                            c = d.get("content", "")
                            m = re.search(r"<USER_SETTINGS_CHANGE>.*?`Model Selection`.*?to\s+([A-Za-z0-9\.\s]+?)(?:\s*\(|\.\s*No|\n|$)", c, re.DOTALL)
                            if m:
                                latest_model = m.group(1).strip()
                            else:
                                for name in ["Gemini 3.7 Flash", "Gemini 3.6 Flash", "Gemini 2.0 Pro", "Gemini 2.0 Flash", "Gemini 1.5 Pro"]:
                                    if name in c:
                                        latest_model = name
                    except Exception:
                        pass
        except Exception:
            pass

    return latest_model or "Gemini 3.7 Flash"


def parse_conversation(log_path):
    if not log_path or not os.path.exists(log_path):
        return None

    stats = {
        "steps": 0,
        "turns": 0,
        "total_chars": 0,
        "input_chars": 0,
        "output_chars": 0,
        "thinking_chars": 0,
        "tools": {},
        "model": get_latest_model(log_path),
        "last_updated": datetime.fromtimestamp(os.path.getmtime(log_path)),
        "first_created": None,
    }

    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            try:
                d = json.loads(line_str)
            except Exception:
                continue

            stats["steps"] += 1
            stype = d.get("type", "")
            source = d.get("source", "")
            content = d.get("content", "") or ""
            thinking = d.get("thinking", "") or ""
            tool_calls = d.get("tool_calls", []) or []
            created_at = d.get("created_at")

            if stats["first_created"] is None and created_at:
                stats["first_created"] = created_at

            raw_chars = len(content) + len(thinking) + len(json.dumps(tool_calls))
            stats["total_chars"] += raw_chars

            if stype == "USER_INPUT":
                stats["turns"] += 1
                stats["input_chars"] += len(content)
            elif source == "MODEL":
                stats["output_chars"] += len(content)
                stats["thinking_chars"] += len(thinking)

            for tc in tool_calls:
                tname = tc.get("name", "unknown")
                stats["tools"][tname] = stats["tools"].get(tname, 0) + 1

    CHAR_PER_TOKEN = 3.2
    stats["est_tokens"] = int(stats["total_chars"] / CHAR_PER_TOKEN)
    stats["input_tokens"] = int(stats["input_chars"] / CHAR_PER_TOKEN)
    stats["output_tokens"] = int(stats["output_chars"] / CHAR_PER_TOKEN)
    stats["thinking_tokens"] = int(stats["thinking_chars"] / CHAR_PER_TOKEN)

    pricing = PRICING.get(stats["model"], PRICING["Default"])
    input_cost = (stats["input_tokens"] / 1_000_000) * pricing["input"]
    output_cost = ((stats["output_tokens"] + stats["thinking_tokens"]) / 1_000_000) * pricing["output"]
    stats["est_cost_usd"] = input_cost + output_cost

    return stats


def format_tokens(num):
    if num >= 1_000_000:
        return f"{num / 1_000_000:.2f}M"
    if num >= 1_000:
        return f"{num / 1_000:.1f}k"
    return str(num)


def render_progress_bar(current, total, width=28):
    pct = min(1.0, current / total)
    filled_len = int(width * pct)
    empty_len = width - filled_len

    if pct < 0.5:
        color = GREEN
    elif pct < 0.8:
        color = YELLOW
    else:
        color = RED

    bar = f"{color}{'█' * filled_len}{'░' * empty_len}{RESET}"
    return f"[{bar}] {color}{pct * 100:.1f}%{RESET}"


def pad_box_line(content, width):
    vis_len = len(strip_ansi(content))
    pad = max(0, width - 4 - vis_len)
    return f"{CYAN}│{RESET} {content}{' ' * pad} {CYAN}│{RESET}"


def render_dashboard(conv_id, stats, quota_info, max_tokens=DEFAULT_MAX_TOKENS):
    term_width = shutil.get_terminal_size((80, 24)).columns
    w = min(max(term_width - 4, 64), 84)

    border_top = f"{CYAN}╭{'─' * (w - 2)}╮{RESET}"
    border_mid = f"{CYAN}├{'─' * (w - 2)}┤{RESET}"
    border_bot = f"{CYAN}╰{'─' * (w - 2)}╯{RESET}"

    now_str = datetime.now().strftime("%H:%M:%S")
    header_text = f"{BOLD}{WHITE}🚀 ANTIGRAVITY CLI — USAGE WATCHER{RESET}   {GREEN}● LIVE{RESET} {DIM}({now_str}){RESET}"

    lines = []
    lines.append(border_top)
    lines.append(pad_box_line(header_text, w))
    lines.append(border_mid)

    short_id = conv_id[:8] + "..." + conv_id[-4:] if len(conv_id) > 16 else conv_id
    sess_line = f"{BOLD}Session ID:{RESET} {YELLOW}{short_id}{RESET}   │   {BOLD}Model:{RESET} {MAGENTA}{stats['model']}{RESET}"
    lines.append(pad_box_line(sess_line, w))

    bar_str = render_progress_bar(stats["est_tokens"], max_tokens, width=max(14, w - 48))
    token_ratio = f"{format_tokens(stats['est_tokens'])} / {format_tokens(max_tokens)} toks"
    ctx_line = f"{BOLD}Context Window:{RESET} {bar_str}  {DIM}({token_ratio}){RESET}"
    lines.append(pad_box_line(ctx_line, w))

    lines.append(border_mid)

    t_count = sum(stats["tools"].values())
    avg_per_turn = (
        format_tokens(int(stats["est_tokens"] / stats["turns"]))
        if stats["turns"] > 0
        else "0"
    )
    col1 = f"{BOLD}Turns:{RESET} {CYAN}{stats['turns']}{RESET}"
    col2 = f"{BOLD}Steps:{RESET} {CYAN}{stats['steps']}{RESET}"
    col3 = f"{BOLD}Tools:{RESET} {CYAN}{t_count}{RESET}"
    col4 = f"{BOLD}Avg/Turn:{RESET} {CYAN}{avg_per_turn}{RESET}"
    metrics_line = f"{col1}   │   {col2}   │   {col3}   │   {col4}"
    lines.append(pad_box_line(metrics_line, w))

    in_t = format_tokens(stats["input_tokens"])
    out_t = format_tokens(stats["output_tokens"])
    think_t = format_tokens(stats["thinking_tokens"])
    cost_str = f"${stats['est_cost_usd']:.4f}"
    breakdown_line = (
        f"{BOLD}Input:{RESET} {GREEN}{in_t}{RESET}  │  "
        f"{BOLD}Output:{RESET} {BLUE}{out_t}{RESET}  │  "
        f"{BOLD}Thinking:{RESET} {MAGENTA}{think_t}{RESET}  │  "
        f"{BOLD}Cost:{RESET} {YELLOW}{cost_str}{RESET}"
    )
    lines.append(pad_box_line(breakdown_line, w))

    if stats["tools"]:
        lines.append(border_mid)
        lines.append(pad_box_line(f"{BOLD}🛠️  Top Tool Calls:{RESET}", w))
        sorted_tools = sorted(stats["tools"].items(), key=lambda x: x[1], reverse=True)
        tool_strs = [f"{DIM}{k}:{RESET} {BOLD}{v}{RESET}" for k, v in sorted_tools[:6]]
        tool_line = "  " + "   ".join(tool_strs)
        lines.append(pad_box_line(tool_line, w))

    # Quota Section
    lines.append(border_mid)
    q_stats, reset_dt = quota_info
    duration = timedelta(hours=DEFAULT_QUOTA_HOURS)
    elapsed = datetime.now() - reset_dt
    remaining = duration - elapsed
    remaining_str = format_timedelta(remaining) if remaining.total_seconds() > 0 else f"{RED}OVERDUE (Reset needed){RESET}"
    reset_time_str = reset_dt.strftime("%H:%M:%S")

    quota_header = f"{BOLD}⏱️  QUOTA WINDOW ({int(DEFAULT_QUOTA_HOURS)}h Cycle):{RESET}"
    lines.append(pad_box_line(quota_header, w))

    q_line1 = (
        f"  {BOLD}Reset Cycle Start:{RESET} {YELLOW}{reset_time_str}{RESET}  │  "
        f"{BOLD}Time Left:{RESET} {GREEN}{remaining_str}{RESET}"
    )
    lines.append(pad_box_line(q_line1, w))

    q_tok_str = format_tokens(q_stats["total_tokens"])
    q_cost_str = f"${q_stats['est_cost_usd']:.4f}"
    q_line2 = (
        f"  {BOLD}Period Tokens:{RESET} {CYAN}{q_tok_str}{RESET}  │  "
        f"{BOLD}Period Cost:{RESET} {MAGENTA}{q_cost_str}{RESET}  │  "
        f"{BOLD}Sessions:{RESET} {WHITE}{q_stats['session_count']}{RESET}"
    )
    lines.append(pad_box_line(q_line2, w))

    lines.append(border_bot)
    lines.append(f"{DIM}  [Ctrl+C to quit]  [--daemon for background file sync]  [--reset-quota to reset window]{RESET}")

    return "\n".join(lines)


def render_compact(conv_id, stats, quota_info, max_tokens=DEFAULT_MAX_TOKENS, color=True):
    now_str = datetime.now().strftime("%H:%M:%S")
    pct = (stats["est_tokens"] / max_tokens) * 100
    t_count = sum(stats["tools"].values())
    q_stats, reset_dt = quota_info
    duration = timedelta(hours=DEFAULT_QUOTA_HOURS)
    remaining = duration - (datetime.now() - reset_dt)
    rem_str = format_timedelta(remaining) if remaining.total_seconds() > 0 else "Reset overdue"

    if color:
        pct_color = GREEN if pct < 50 else (YELLOW if pct < 80 else RED)
        return (
            f"🤖 {BOLD}{stats['model']}{RESET} | "
            f"📊 {pct_color}{format_tokens(stats['est_tokens'])}/1M ({pct:.1f}%){RESET} | "
            f"💬 Turn {stats['turns']} ({stats['steps']} stp) | "
            f"🛠️ {t_count} tools | "
            f"💰 {YELLOW}${stats['est_cost_usd']:.3f}{RESET} | "
            f"⏱️ Quota reset in {rem_str} | "
            f"{DIM}{now_str}{RESET}"
        )
    return (
        f"🤖 {stats['model']} | "
        f"📊 {format_tokens(stats['est_tokens'])}/1M ({pct:.1f}%) | "
        f"💬 Turn {stats['turns']} | "
        f"🛠️ {t_count} tools | "
        f"💰 ${stats['est_cost_usd']:.3f} | "
        f"⏱️ Quota reset in {rem_str}"
    )


def sync_to_status_file(stats, conv_id, quota_info, max_tokens=DEFAULT_MAX_TOKENS):
    """Ghi dữ liệu JSON tĩnh ra các đường dẫn file để WezTerm đọc cực nhanh."""
    pct = round((stats["est_tokens"] / max_tokens) * 100, 1)
    q_stats, reset_dt = quota_info
    duration = timedelta(hours=DEFAULT_QUOTA_HOURS)
    elapsed = (datetime.now() - reset_dt).total_seconds()
    remaining = max(0, (duration - (datetime.now() - reset_dt)).total_seconds())

    payload = {
        "conversation_id": conv_id,
        "model": stats["model"],
        "est_tokens": stats["est_tokens"],
        "max_tokens": max_tokens,
        "pct": pct,
        "turns": stats["turns"],
        "steps": stats["steps"],
        "cost": round(stats["est_cost_usd"], 4),
        "quota": {
            "reset_at": reset_dt.isoformat(),
            "duration_hours": DEFAULT_QUOTA_HOURS,
            "elapsed_seconds": int(elapsed),
            "remaining_seconds": int(remaining),
            "quota_tokens": q_stats["total_tokens"],
            "quota_cost": round(q_stats["est_cost_usd"], 4),
            "quota_turns": q_stats["turns"],
        },
        "updated_at": datetime.now().strftime("%H:%M:%S"),
    }

    # Ghi ra 2 nơi: Windows user home & Linux user home
    paths = [os.path.expanduser("~/.agy_usage.json")]
    win_home = get_windows_user_home()
    if win_home:
        paths.append(os.path.join(win_home, ".agy_usage.json"))

    for p in set(paths):
        try:
            tmp_p = p + ".tmp"
            with open(tmp_p, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            os.replace(tmp_p, p)
        except Exception:
            pass


def daemonize():
    """Tách hoàn toàn tiến trình vào nền (double fork) để chạy độc lập vĩnh viễn."""
    try:
        pid = os.fork()
        if pid > 0:
            sys.exit(0)
    except OSError:
        sys.exit(1)

    os.setsid()
    try:
        pid = os.fork()
        if pid > 0:
            sys.exit(0)
    except OSError:
        sys.exit(1)

    sys.stdout.flush()
    sys.stderr.flush()
    try:
        with open("/dev/null", "r") as f:
            os.dup2(f.fileno(), sys.stdin.fileno())
        with open("/tmp/agy_daemon.log", "a+") as f:
            os.dup2(f.fileno(), sys.stdout.fileno())
            os.dup2(f.fileno(), sys.stderr.fileno())
    except Exception:
        pass


def main():
    parser = argparse.ArgumentParser(
        description="Antigravity CLI - Realtime Usage & Context Monitor"
    )
    parser.add_argument("--id", help="Conversation ID cụ thể cần theo dõi")
    parser.add_argument("-d", "--daemon", action="store_true", help="Chạy ngầm sync file JSON tĩnh cho WezTerm")
    parser.add_argument("-c", "--compact", action="store_true", help="Chế độ 1 dòng loop")
    parser.add_argument("--compact-once", action="store_true", help="In 1 dòng compact rồi thoát ngay")
    parser.add_argument("-i", "--interval", type=float, default=0.5, help="Chu kỳ refresh (giây, mặc định 0.5s)")
    parser.add_argument("--json", action="store_true", help="Xuất JSON 1 lần")
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS, help="Giới hạn Context Window")
    parser.add_argument("--reset-quota", "--reset", action="store_true", help="Reset mốc quota về hiện tại")
    parser.add_argument("--quota-hours", type=float, default=DEFAULT_QUOTA_HOURS, help="Độ dài chu kỳ quota (giờ)")
    args = parser.parse_args()

    # Reset quota thủ công qua CLI
    if args.reset_quota:
        state = reset_quota(args.quota_hours)
        print(f"✅ Quota reset successfully! New period start: {state['quota_reset_at']}")
        sys.exit(0)

    quota_state = roll_quota_window(load_quota_state())

    # Chế độ 1-shot compact
    if args.compact_once:
        conv_id, log_path = find_active_conversation_log(args.id)
        if not log_path or not os.path.exists(log_path):
            print("AGY Idle")
            sys.exit(0)
        stats = parse_conversation(log_path)
        quota_info = parse_quota_usage(quota_state["quota_reset_at"])
        if stats:
            print(render_compact(conv_id, stats, quota_info, args.max_tokens, color=False))
        sys.exit(0)

    # Chế độ JSON xuất 1 lần
    if args.json:
        conv_id, log_path = find_active_conversation_log(args.id)
        if not log_path:
            print(json.dumps({"error": "No active conversation found"}))
            sys.exit(1)
        stats = parse_conversation(log_path)
        quota_info = parse_quota_usage(quota_state["quota_reset_at"])
        sync_to_status_file(stats, conv_id, quota_info, args.max_tokens)
        q_stats, reset_dt = quota_info
        stats["conversation_id"] = conv_id
        stats["last_updated"] = str(stats["last_updated"])
        stats["quota_stats"] = q_stats
        stats["quota_reset_at"] = reset_dt.isoformat()
        print(json.dumps(stats, indent=2))
        sys.exit(0)

    # Chế độ Daemon chạy ngầm sync ra file tĩnh
    if args.daemon:
        daemonize()
        while True:
            try:
                state = roll_quota_window(load_quota_state())
                conv_id, log_path = find_active_conversation_log(args.id)
                if log_path and os.path.exists(log_path):
                    stats = parse_conversation(log_path)
                    quota_info = parse_quota_usage(state["quota_reset_at"])
                    if stats:
                        sync_to_status_file(stats, conv_id, quota_info, args.max_tokens)
            except Exception:
                pass
            time.sleep(args.interval)

    # Chế độ Realtime Dashboard TUI
    try:
        sys.stdout.write("\033[?25l")
        sys.stdout.flush()

        while True:
            conv_id, log_path = find_active_conversation_log(args.id)

            if not log_path or not os.path.exists(log_path):
                sys.stdout.write("\033[H\033[2J")
                print(f"{YELLOW}⏳ Đang chờ Antigravity CLI bắt đầu session...{RESET}")
                time.sleep(args.interval)
                continue

            stats = parse_conversation(log_path)
            if not stats:
                time.sleep(args.interval)
                continue

            quota_state = roll_quota_window(quota_state)
            quota_info = parse_quota_usage(quota_state["quota_reset_at"])

            # Tự động sync ra file tĩnh luôn
            sync_to_status_file(stats, conv_id, quota_info, args.max_tokens)

            if args.compact:
                sys.stdout.write("\r\033[K" + render_compact(conv_id, stats, quota_info, args.max_tokens))
                sys.stdout.flush()
            else:
                sys.stdout.write("\033[H\033[2J")
                sys.stdout.write(render_dashboard(conv_id, stats, quota_info, args.max_tokens) + "\n")
                sys.stdout.flush()

            time.sleep(args.interval)

    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write("\033[?25h\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
