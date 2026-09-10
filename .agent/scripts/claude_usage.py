#!/usr/bin/env python3
"""
Claude CLI - Realtime Usage & Quota Monitor (Sidecar Watcher)
------------------------------------------------------------
Realtime tracking of Claude CLI token usage, context window, turns, tool calls,
estimated API cost, and 5-hour rolling quota window with reset support.

Modes:
  python3 .agent/scripts/claude_usage.py --daemon       # Background daemon syncing state file
  python3 .agent/scripts/claude_usage.py                 # Full TUI Dashboard mode
  python3 .agent/scripts/claude_usage.py --compact       # 1-line loop mode
  python3 .agent/scripts/claude_usage.py --compact-once  # Print 1 line and exit
  python3 .agent/scripts/claude_usage.py --json          # Export JSON snapshot
  python3 .agent/scripts/claude_usage.py --reset-quota    # Reset quota period start timestamp
"""

import argparse
import glob
import json
import os
import re
import select
import shutil
import sys
import termios
import tty
import time
from datetime import datetime, timedelta, timezone

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

DEFAULT_MAX_TOKENS = 200_000  # Claude Context Window Limit (200k)
DEFAULT_QUOTA_HOURS = 5.0    # Rolling quota cycle limit (5 hours)

# Anthropic Pricing per 1M tokens (Input, Cache Write, Cache Read, Output)
PRICING = {
    "claude-3-7-sonnet": {"input": 3.00, "cache_write": 3.75, "cache_read": 0.30, "output": 15.00},
    "claude-3-5-sonnet": {"input": 3.00, "cache_write": 3.75, "cache_read": 0.30, "output": 15.00},
    "claude-sonnet-5":   {"input": 3.00, "cache_write": 3.75, "cache_read": 0.30, "output": 15.00},
    "claude-3-5-haiku":  {"input": 0.80, "cache_write": 1.00, "cache_read": 0.08, "output": 4.00},
    "claude-3-opus":     {"input": 15.00, "cache_write": 18.75, "cache_read": 1.50, "output": 75.00},
    "claude-opus-5":     {"input": 15.00, "cache_write": 18.75, "cache_read": 1.50, "output": 75.00},
    "Default":           {"input": 3.00, "cache_write": 3.75, "cache_read": 0.30, "output": 15.00},
}

QUOTA_STATE_FILE = os.path.expanduser("~/.claude_quota_state.json")
STATUS_JSON_FILE = os.path.expanduser("~/.claude_usage.json")


def strip_ansi(text):
    """Remove ANSI escape sequences from string."""
    return re.sub(r"\033\[[0-9;?]*[a-zA-Z]", "", text)


def get_windows_user_home():
    """Find Windows User Home directory if running under WSL."""
    c_users = "/mnt/c/Users"
    if os.path.exists(c_users):
        for entry in os.listdir(c_users):
            if entry not in ["Public", "Default", "Default User", "All Users", "desktop.ini"]:
                user_path = os.path.join(c_users, entry)
                if os.path.isdir(user_path):
                    return user_path
    return os.path.expanduser("~")


def parse_iso_ts(ts_str):
    """Parse ISO timestamp string or numeric timestamp to epoch seconds in UTC."""
    if not ts_str:
        return None
    try:
        if isinstance(ts_str, (int, float)):
            return float(ts_str) if ts_str < 2e9 else float(ts_str) / 1000.0
        s = str(ts_str).strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    except Exception:
        return None


def load_quota_state():
    """Load persistent quota state (reset timestamp, quota duration)."""
    default_state = {
        "quota_reset_at": datetime.now(timezone.utc).isoformat(),
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
    """Reset quota start time to current UTC timestamp."""
    state = {
        "quota_reset_at": datetime.now(timezone.utc).isoformat(),
        "duration_hours": float(hours),
    }
    save_quota_state(state)
    return state


def find_active_session_log(target_id=None):
    """Locate active Claude CLI project session log file."""
    projects_dir = os.path.expanduser("~/.claude/projects")
    if not os.path.exists(projects_dir):
        return None, None

    if target_id:
        matches = glob.glob(os.path.join(projects_dir, "*", f"{target_id}.jsonl"))
        if matches:
            return target_id, matches[0]
        return target_id, None

    logs = glob.glob(os.path.join(projects_dir, "*", "*.jsonl"))
    if not logs:
        return None, None

    latest_log = max(logs, key=os.path.getmtime)
    session_id = os.path.basename(latest_log).replace(".jsonl", "")
    return session_id, latest_log


def parse_session(log_path):
    """Parse a single Claude CLI session log file."""
    if not log_path or not os.path.exists(log_path):
        return None

    stats = {
        "steps": 0,
        "turns": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_create_tokens": 0,
        "cache_read_tokens": 0,
        "latest_context_tokens": 0,
        "tools": {},
        "model": "claude-3-7-sonnet",
        "last_updated": datetime.fromtimestamp(os.path.getmtime(log_path)),
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

            stype = d.get("type")
            if stype == "user":
                stats["turns"] += 1
            elif stype == "assistant":
                stats["steps"] += 1
                msg = d.get("message", {})
                if isinstance(msg, dict):
                    if "model" in msg:
                        stats["model"] = msg["model"]

                    usage = msg.get("usage", {})
                    inp = usage.get("input_tokens", 0)
                    out = usage.get("output_tokens", 0)
                    cw = usage.get("cache_creation_input_tokens", 0)
                    cr = usage.get("cache_read_input_tokens", 0)

                    stats["input_tokens"] += inp
                    stats["output_tokens"] += out
                    stats["cache_create_tokens"] += cw
                    stats["cache_read_tokens"] += cr

                    # Latest context window size (prompt + response)
                    stats["latest_context_tokens"] = inp + cw + cr + out

                    content = msg.get("content", [])
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get("type") == "tool_use":
                                tname = block.get("name", "unknown")
                                stats["tools"][tname] = stats["tools"].get(tname, 0) + 1

    stats["est_cost_usd"] = calculate_cost(
        stats["model"],
        stats["input_tokens"],
        stats["cache_create_tokens"],
        stats["cache_read_tokens"],
        stats["output_tokens"],
    )
    return stats


def calculate_cost(model, inp, cw, cr, out):
    """Calculate cost based on token counts and Anthropic model pricing."""
    p = PRICING.get(model, PRICING["Default"])
    cost = (
        (inp / 1_000_000) * p["input"]
        + (cw / 1_000_000) * p["cache_write"]
        + (cr / 1_000_000) * p["cache_read"]
        + (out / 1_000_000) * p["output"]
    )
    return cost


def parse_quota_usage(quota_reset_iso, duration_hours=DEFAULT_QUOTA_HOURS):
    """Parse accumulated usage across all session log lines timestamped after quota_reset_iso."""
    reset_ts = parse_iso_ts(quota_reset_iso)
    now_ts = datetime.now(timezone.utc).timestamp()
    max_duration_sec = duration_hours * 3600

    # Auto-reset if quota period expired (> 5 hours)
    if reset_ts is None or (now_ts - reset_ts) >= max_duration_sec:
        reset_ts = now_ts
        save_quota_state({
            "quota_reset_at": datetime.now(timezone.utc).isoformat(),
            "duration_hours": float(duration_hours),
        })

    projects_dir = os.path.expanduser("~/.claude/projects")
    logs = glob.glob(os.path.join(projects_dir, "*", "*.jsonl")) if os.path.exists(projects_dir) else []
    recent_logs = [l for l in logs if os.path.getmtime(l) >= reset_ts - 60]

    quota_stats = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_create_tokens": 0,
        "cache_read_tokens": 0,
        "total_tokens": 0,
        "est_cost_usd": 0.0,
        "turns": 0,
        "steps": 0,
        "session_count": 0,
    }

    active_sessions = set()

    for log_path in recent_logs:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue

                # Strict per-line timestamp check
                line_ts = parse_iso_ts(d.get("timestamp")) or os.path.getmtime(log_path)
                if line_ts < reset_ts:
                    continue

                active_sessions.add(log_path)
                stype = d.get("type")
                if stype == "user":
                    quota_stats["turns"] += 1
                elif stype == "assistant":
                    quota_stats["steps"] += 1
                    msg = d.get("message", {})
                    if isinstance(msg, dict):
                        m = msg.get("model", "claude-3-7-sonnet")
                        usage = msg.get("usage", {})
                        inp = usage.get("input_tokens", 0)
                        out = usage.get("output_tokens", 0)
                        cw = usage.get("cache_creation_input_tokens", 0)
                        cr = usage.get("cache_read_input_tokens", 0)

                        quota_stats["input_tokens"] += inp
                        quota_stats["output_tokens"] += out
                        quota_stats["cache_create_tokens"] += cw
                        quota_stats["cache_read_tokens"] += cr
                        quota_stats["est_cost_usd"] += calculate_cost(m, inp, cw, cr, out)

    quota_stats["session_count"] = len(active_sessions)
    quota_stats["total_tokens"] = (
        quota_stats["input_tokens"]
        + quota_stats["output_tokens"]
        + quota_stats["cache_create_tokens"]
        + quota_stats["cache_read_tokens"]
    )
    reset_dt = datetime.fromtimestamp(reset_ts, tz=timezone.utc)
    return quota_stats, reset_dt


def format_tokens(num):
    """Format token count for display."""
    if num >= 1_000_000:
        return f"{num / 1_000_000:.2f}M"
    if num >= 1_000:
        return f"{num / 1_000:.1f}k"
    return str(num)


def format_timedelta(td):
    """Format timedelta as hh:mm:ss."""
    total_sec = int(max(0, td.total_seconds()))
    hours = total_sec // 3600
    minutes = (total_sec % 3600) // 60
    seconds = total_sec % 60
    return f"{hours:02d}h {minutes:02d}m {seconds:02d}s"


def render_progress_bar(current, total, width=28):
    """Render colored ASCII progress bar."""
    pct = min(1.0, current / total) if total > 0 else 0.0
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
    """Pad line for box border alignment."""
    vis_len = len(strip_ansi(content))
    pad = max(0, width - 4 - vis_len)
    return f"{CYAN}│{RESET} {content}{' ' * pad} {CYAN}│{RESET}"


def render_dashboard(conv_id, stats, quota_info, max_tokens=DEFAULT_MAX_TOKENS, message_banner=None):
    """Render full Unicode TUI Dashboard."""
    term_width = shutil.get_terminal_size((80, 24)).columns
    w = min(max(term_width - 4, 68), 86)

    border_top = f"{CYAN}╭{'─' * (w - 2)}╮{RESET}"
    border_mid = f"{CYAN}├{'─' * (w - 2)}┤{RESET}"
    border_bot = f"{CYAN}╰{'─' * (w - 2)}╯{RESET}"

    now_str = datetime.now().strftime("%H:%M:%S")
    header_text = f"{BOLD}{WHITE}🧠 CLAUDE CLI — USAGE & QUOTA WATCHER{RESET}   {GREEN}● LIVE{RESET} {DIM}({now_str}){RESET}"

    lines = []
    lines.append(border_top)
    lines.append(pad_box_line(header_text, w))
    lines.append(border_mid)

    short_id = conv_id[:8] + "..." + conv_id[-4:] if len(conv_id) > 16 else conv_id
    sess_line = f"{BOLD}Session ID:{RESET} {YELLOW}{short_id}{RESET}   │   {BOLD}Model:{RESET} {MAGENTA}{stats['model']}{RESET}"
    lines.append(pad_box_line(sess_line, w))

    ctx_tokens = stats["latest_context_tokens"] if stats["latest_context_tokens"] > 0 else (stats["input_tokens"] + stats["output_tokens"])
    bar_str = render_progress_bar(ctx_tokens, max_tokens, width=max(12, w - 48))
    token_ratio = f"{format_tokens(ctx_tokens)} / {format_tokens(max_tokens)}"
    ctx_line = f"{BOLD}Context Window:{RESET} {bar_str}  {DIM}({token_ratio}){RESET}"
    lines.append(pad_box_line(ctx_line, w))

    lines.append(border_mid)

    t_count = sum(stats["tools"].values())
    avg_per_turn = format_tokens(int(ctx_tokens / stats["turns"])) if stats["turns"] > 0 else "0"
    col1 = f"{BOLD}Turns:{RESET} {CYAN}{stats['turns']}{RESET}"
    col2 = f"{BOLD}Steps:{RESET} {CYAN}{stats['steps']}{RESET}"
    col3 = f"{BOLD}Tools:{RESET} {CYAN}{t_count}{RESET}"
    col4 = f"{BOLD}Avg/Turn:{RESET} {CYAN}{avg_per_turn}{RESET}"
    metrics_line = f"{col1}   │   {col2}   │   {col3}   │   {col4}"
    lines.append(pad_box_line(metrics_line, w))

    in_t = format_tokens(stats["input_tokens"])
    out_t = format_tokens(stats["output_tokens"])
    cw_t = format_tokens(stats["cache_create_tokens"])
    cr_t = format_tokens(stats["cache_read_tokens"])
    cost_str = f"${stats['est_cost_usd']:.4f}"
    breakdown_line = (
        f"{BOLD}In:{RESET} {GREEN}{in_t}{RESET} │ "
        f"{BOLD}Out:{RESET} {BLUE}{out_t}{RESET} │ "
        f"{BOLD}CacheWrite:{RESET} {YELLOW}{cw_t}{RESET} │ "
        f"{BOLD}CacheRead:{RESET} {CYAN}{cr_t}{RESET} │ "
        f"{BOLD}Cost:{RESET} {MAGENTA}{cost_str}{RESET}"
    )
    lines.append(pad_box_line(breakdown_line, w))

    # Quota Section
    lines.append(border_mid)
    q_stats, reset_dt = quota_info
    duration = timedelta(hours=DEFAULT_QUOTA_HOURS)
    now_dt = datetime.now(timezone.utc)
    elapsed = now_dt - reset_dt
    remaining = duration - elapsed
    remaining_str = format_timedelta(remaining) if remaining.total_seconds() > 0 else f"{RED}OVERDUE (Reset needed){RESET}"
    reset_time_str = reset_dt.astimezone().strftime("%H:%M:%S")

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

    if stats["tools"]:
        lines.append(border_mid)
        lines.append(pad_box_line(f"{BOLD}🛠️  Top Tool Calls:{RESET}", w))
        sorted_tools = sorted(stats["tools"].items(), key=lambda x: x[1], reverse=True)
        tool_strs = [f"{DIM}{k}:{RESET}{BOLD}{v}{RESET}" for k, v in sorted_tools[:6]]
        tool_line = "  " + "   ".join(tool_strs)
        lines.append(pad_box_line(tool_line, w))

    if message_banner:
        lines.append(border_mid)
        lines.append(pad_box_line(f"{GREEN}{BOLD}{message_banner}{RESET}", w))

    lines.append(border_bot)
    lines.append(f"{DIM}  [Press 'r' to Reset Quota]  [Press 'q' to Quit]  [--daemon for background sync]{RESET}")

    return "\n".join(lines)


def render_compact(conv_id, stats, quota_info, max_tokens=DEFAULT_MAX_TOKENS, color=True):
    """Render 1-line compact summary."""
    ctx_tokens = stats["latest_context_tokens"] if stats["latest_context_tokens"] > 0 else (stats["input_tokens"] + stats["output_tokens"])
    pct = (ctx_tokens / max_tokens) * 100
    t_count = sum(stats["tools"].values())
    q_stats, reset_dt = quota_info
    duration = timedelta(hours=DEFAULT_QUOTA_HOURS)
    now_dt = datetime.now(timezone.utc)
    remaining = duration - (now_dt - reset_dt)
    rem_str = format_timedelta(remaining) if remaining.total_seconds() > 0 else "Reset overdue"

    if color:
        pct_color = GREEN if pct < 50 else (YELLOW if pct < 80 else RED)
        return (
            f"🧠 {BOLD}{stats['model']}{RESET} | "
            f"📊 {pct_color}{format_tokens(ctx_tokens)}/200k ({pct:.1f}%){RESET} | "
            f"💬 Turn {stats['turns']} ({stats['steps']} stp) | "
            f"🛠️ {t_count} tools | "
            f"💰 {MAGENTA}${stats['est_cost_usd']:.3f}{RESET} | "
            f"⏱️ Quota: {q_stats['turns']} turns (${q_stats['est_cost_usd']:.2f}, reset in {rem_str})"
        )
    return (
        f"🧠 {stats['model']} | "
        f"📊 {format_tokens(ctx_tokens)}/200k ({pct:.1f}%) | "
        f"💬 Turn {stats['turns']} | "
        f"🛠️ {t_count} tools | "
        f"💰 ${stats['est_cost_usd']:.3f} | "
        f"⏱️ Quota reset in {rem_str}"
    )


def sync_to_status_file(stats, conv_id, quota_info, max_tokens=DEFAULT_MAX_TOKENS):
    """Sync JSON status payload to file for shell & status bar integrations."""
    ctx_tokens = stats["latest_context_tokens"] if stats["latest_context_tokens"] > 0 else (stats["input_tokens"] + stats["output_tokens"])
    pct = round((ctx_tokens / max_tokens) * 100, 1)
    q_stats, reset_dt = quota_info
    duration = timedelta(hours=DEFAULT_QUOTA_HOURS)
    now_dt = datetime.now(timezone.utc)
    elapsed = (now_dt - reset_dt).total_seconds()
    remaining = max(0, (duration - (now_dt - reset_dt)).total_seconds())

    payload = {
        "conversation_id": conv_id,
        "model": stats["model"],
        "est_tokens": ctx_tokens,
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

    paths = [STATUS_JSON_FILE]
    win_home = get_windows_user_home()
    if win_home:
        paths.append(os.path.join(win_home, ".claude_usage.json"))

    for p in set(paths):
        try:
            tmp_p = p + ".tmp"
            with open(tmp_p, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            os.replace(tmp_p, p)
        except Exception:
            pass


def daemonize():
    """Double fork to daemonize watcher process."""
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
        with open("/tmp/claude_usage_daemon.log", "a+") as f:
            os.dup2(f.fileno(), sys.stdout.fileno())
            os.dup2(f.fileno(), sys.stderr.fileno())
    except Exception:
        pass


class KeyListener:
    """Non-blocking keyboard listener for TUI interaction."""

    def __enter__(self):
        self.old_settings = None
        if sys.stdin.isatty():
            try:
                self.old_settings = termios.tcgetattr(sys.stdin)
                tty.setcbreak(sys.stdin.fileno())
            except Exception:
                self.old_settings = None
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.old_settings and sys.stdin.isatty():
            try:
                termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self.old_settings)
            except Exception:
                pass

    def get_key(self):
        """Check if key was pressed without blocking."""
        if not sys.stdin.isatty():
            return None
        try:
            rlist, _, _ = select.select([sys.stdin], [], [], 0.05)
            if rlist:
                return sys.stdin.read(1)
        except Exception:
            pass
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Claude CLI - Realtime Usage & Quota Monitor"
    )
    parser.add_argument("--id", help="Target session ID")
    parser.add_argument("-d", "--daemon", action="store_true", help="Run background daemon syncing JSON state")
    parser.add_argument("-c", "--compact", action="store_true", help="1-line loop mode")
    parser.add_argument("--compact-once", action="store_true", help="Print 1-line summary and exit")
    parser.add_argument("-i", "--interval", type=float, default=0.5, help="Refresh interval (seconds, default 0.5s)")
    parser.add_argument("--json", action="store_true", help="Output JSON snapshot and exit")
    parser.add_argument("--reset-quota", "--reset", action="store_true", help="Reset quota period start time to NOW")
    parser.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS, help="Context Window Token Limit")
    parser.add_argument("--quota-hours", type=float, default=DEFAULT_QUOTA_HOURS, help="Quota window duration in hours")
    args = parser.parse_args()

    # Handle manual quota reset CLI command
    if args.reset_quota:
        state = reset_quota(args.quota_hours)
        print(f"✅ Quota reset successfully! New period start: {state['quota_reset_at']}")
        sys.exit(0)

    quota_state = load_quota_state()

    # Compact-once mode
    if args.compact_once:
        conv_id, log_path = find_active_session_log(args.id)
        if not log_path or not os.path.exists(log_path):
            print("Claude Idle")
            sys.exit(0)
        stats = parse_session(log_path)
        quota_info = parse_quota_usage(quota_state["quota_reset_at"], args.quota_hours)
        if stats:
            print(render_compact(conv_id, stats, quota_info, args.max_tokens, color=False))
        sys.exit(0)

    # JSON export mode
    if args.json:
        conv_id, log_path = find_active_session_log(args.id)
        if not log_path:
            print(json.dumps({"error": "No active Claude session found"}))
            sys.exit(1)
        stats = parse_session(log_path)
        quota_info = parse_quota_usage(quota_state["quota_reset_at"], args.quota_hours)
        sync_to_status_file(stats, conv_id, quota_info, args.max_tokens)
        q_stats, reset_dt = quota_info
        res = {
            "conversation_id": conv_id,
            "session_stats": stats,
            "quota_stats": q_stats,
            "quota_reset_at": reset_dt.isoformat(),
        }
        res["session_stats"]["last_updated"] = str(res["session_stats"]["last_updated"])
        print(json.dumps(res, indent=2))
        sys.exit(0)

    # Daemon mode
    if args.daemon:
        daemonize()
        while True:
            try:
                state = load_quota_state()
                conv_id, log_path = find_active_session_log(args.id)
                if log_path and os.path.exists(log_path):
                    stats = parse_session(log_path)
                    quota_info = parse_quota_usage(state["quota_reset_at"], args.quota_hours)
                    if stats:
                        sync_to_status_file(stats, conv_id, quota_info, args.max_tokens)
            except Exception:
                pass
            time.sleep(args.interval)

    # Interactive TUI Dashboard mode
    banner_msg = None
    banner_ticks = 0

    with KeyListener() as key_listener:
        try:
            sys.stdout.write("\033[?25l")
            sys.stdout.flush()

            while True:
                # Non-blocking key check
                key = key_listener.get_key()
                if key:
                    key_lower = key.lower()
                    if key_lower == "q":
                        break
                    elif key_lower == "r":
                        quota_state = reset_quota(args.quota_hours)
                        banner_msg = f"✅ Quota reset at {datetime.now().strftime('%H:%M:%S')}!"
                        banner_ticks = 6
                    elif key_lower == "c":
                        args.compact = not args.compact

                conv_id, log_path = find_active_session_log(args.id)

                if not log_path or not os.path.exists(log_path):
                    sys.stdout.write("\033[H\033[2J")
                    print(f"{YELLOW}⏳ Waiting for Claude CLI session to begin...{RESET}")
                    print(f"{DIM}[Press 'r' to reset quota | Press 'q' to quit]{RESET}")
                    time.sleep(args.interval)
                    continue

                stats = parse_session(log_path)
                if not stats:
                    time.sleep(args.interval)
                    continue

                quota_info = parse_quota_usage(quota_state["quota_reset_at"], args.quota_hours)
                sync_to_status_file(stats, conv_id, quota_info, args.max_tokens)

                active_banner = banner_msg if banner_ticks > 0 else None
                if banner_ticks > 0:
                    banner_ticks -= 1

                if args.compact:
                    sys.stdout.write("\r\033[K" + render_compact(conv_id, stats, quota_info, args.max_tokens))
                    sys.stdout.flush()
                else:
                    sys.stdout.write("\033[H\033[2J")
                    sys.stdout.write(render_dashboard(conv_id, stats, quota_info, args.max_tokens, message_banner=active_banner) + "\n")
                    sys.stdout.flush()

                time.sleep(args.interval)

        except KeyboardInterrupt:
            pass
        finally:
            sys.stdout.write("\033[?25h\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
