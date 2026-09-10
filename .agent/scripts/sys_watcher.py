#!/usr/bin/env python3
"""
Lightweight System Stats Watcher Daemon for WezTerm Status Bar
--------------------------------------------------------------
Đọc trực tiếp /proc/stat và /proc/meminfo (0% overhead, không giật lag).
Xuất dữ liệu tĩnh ra ~/.sys_stats.json để WezTerm Lua đọc mà không cần spawn process.
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import time

WIN_USER_DIR = "/mnt/c/Users/dinhn"
LINUX_USER_DIR = os.path.expanduser("~")

def daemonize():
    """Double fork để chạy ngầm hoàn toàn độc lập."""
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
        with open("/tmp/sys_daemon.log", "a+") as f:
            os.dup2(f.fileno(), sys.stdout.fileno())
            os.dup2(f.fileno(), sys.stderr.fileno())
    except Exception:
        pass

def get_cpu_times():
    try:
        with open("/proc/stat", "r") as f:
            line = f.readline()
            if not line.startswith("cpu "):
                return None, None
            fields = [float(x) for x in line.strip().split()[1:]]
            idle = fields[3] + fields[4]
            total = sum(fields)
            return idle, total
    except Exception:
        return None, None

def get_mem_stats():
    try:
        mem = {}
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split(":")
                if len(parts) == 2:
                    mem[parts[0].strip()] = int(parts[1].split()[0])
        total_kb = mem.get("MemTotal", 0)
        avail_kb = mem.get("MemAvailable", 0)
        used_kb = max(0, total_kb - avail_kb)
        used_gb = round(used_kb / 1024 / 1024, 1)
        total_gb = round(total_kb / 1024 / 1024, 0)
        pct = round((used_kb / total_kb) * 100) if total_kb > 0 else 0
        return used_gb, total_gb, pct
    except Exception:
        return 0, 0, 0

def get_top_process():
    try:
        res = subprocess.run(
            ["ps", "-eo", "comm,%cpu", "--sort=-%cpu"],
            capture_output=True,
            text=True,
            timeout=1
        )
        lines = [line.strip() for line in res.stdout.strip().split("\n") if line.strip()]
        if len(lines) >= 2:
            parts = lines[1].split()
            if len(parts) >= 2:
                proc = parts[0]
                cpu_p = float(parts[1])
                if proc not in ("ps", "sys_watcher.py", "python3"):
                    return proc, cpu_p
                if len(lines) >= 3:
                    p3 = lines[2].split()
                    if len(p3) >= 2:
                        return p3[0], float(p3[1])
        return "", 0.0
    except Exception:
        return "", 0.0

def sync_stats(data):
    payload = json.dumps(data)
    linux_path = os.path.join(LINUX_USER_DIR, ".sys_stats.json")
    try:
        with open(linux_path, "w") as f:
            f.write(payload)
    except Exception:
        pass

    if os.path.isdir(WIN_USER_DIR):
        win_path = os.path.join(WIN_USER_DIR, ".sys_stats.json")
        try:
            with open(win_path, "w") as f:
                f.write(payload)
        except Exception:
            pass

def main():
    parser = argparse.ArgumentParser(description="System Stats Watcher for WezTerm")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in background")
    parser.add_argument("--interval", type=float, default=2.0, help="Interval in seconds (default 2s)")
    args = parser.parse_args()

    if args.daemon:
        daemonize()

    prev_idle, prev_total = get_cpu_times()

    def handle_exit(signum, frame):
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    while True:
        time.sleep(args.interval)
        curr_idle, curr_total = get_cpu_times()
        cpu_pct = 0
        if prev_idle is not None and curr_idle is not None:
            idle_delta = curr_idle - prev_idle
            total_delta = curr_total - prev_total
            if total_delta > 0:
                cpu_pct = max(0, min(100, round((1.0 - (idle_delta / total_delta)) * 100)))
        prev_idle, prev_total = curr_idle, curr_total

        mem_used_gb, mem_total_gb, mem_pct = get_mem_stats()
        top_proc, top_cpu = get_top_process()

        data = {
            "cpu_pct": cpu_pct,
            "mem_used_gb": mem_used_gb,
            "mem_total_gb": mem_total_gb,
            "mem_pct": mem_pct,
            "top_proc": top_proc,
            "top_cpu": top_cpu,
            "updated_at": int(time.time()),
        }

        sync_stats(data)

        if not args.daemon:
            print(json.dumps(data, indent=2))
            break

if __name__ == "__main__":
    main()
