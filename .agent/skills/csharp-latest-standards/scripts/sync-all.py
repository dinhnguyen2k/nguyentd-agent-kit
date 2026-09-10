#!/usr/bin/env python3
"""
Master Sync Script — Chạy tất cả scripts cào dữ liệu tuần tự.
Fail-safe: 1 script fail không ảnh hưởng các scripts còn lại.
"""

import os
import subprocess
import sys
from datetime import datetime

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
TIMEOUT_PER_SCRIPT = 15  # seconds

SCRIPTS = [
    "fetch-dotnet-docs.py",
    "fetch-efcore-docs.py",
    "fetch-csharp-whats-new.py",
    "fetch-aspnet-patterns.py",
    "fetch-azure-waf.py",
]

def run_script(script_name):
    script_path = os.path.join(SCRIPTS_DIR, script_name)
    if not os.path.exists(script_path):
        print(f"  [SKIP] {script_name} — file not found")
        return False
    try:
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_PER_SCRIPT,
            cwd=SCRIPTS_DIR
        )
        if result.returncode == 0:
            print(f"  [OK]   {script_name}")
            return True
        else:
            print(f"  [FAIL] {script_name}: {result.stderr.strip()[:100]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"  [TIMEOUT] {script_name} — exceeded {TIMEOUT_PER_SCRIPT}s")
        return False
    except Exception as e:
        print(f"  [ERROR] {script_name}: {e}")
        return False

def main():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{'='*50}")
    print(f"  .NET Knowledge Sync — {now}")
    print(f"{'='*50}")
    
    success = 0
    failed = 0
    skipped = 0
    
    for script in SCRIPTS:
        script_path = os.path.join(SCRIPTS_DIR, script)
        if not os.path.exists(script_path):
            skipped += 1
            print(f"  [SKIP] {script}")
        elif run_script(script):
            success += 1
        else:
            failed += 1
    
    print(f"\n{'='*50}")
    print(f"  Results: {success} OK | {failed} FAILED | {skipped} SKIPPED")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
