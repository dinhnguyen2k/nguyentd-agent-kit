#!/usr/bin/env python3
"""
ASP.NET Core & Web API Patterns Sync Script
- Cập nhật chuẩn thiết kế API, Middleware, Minimal API và Authentication
- Tự động cập nhật aspnet-core-patterns.md
"""

import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

FEED_URL = "https://devblogs.microsoft.com/dotnet/category/asp-net/feed/"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "../references/aspnet-core-patterns.md")
TIMEOUT = 10

KEYWORDS = ["asp.net", "api", "minimal api", "controller", "middleware", "authentication", "rate limiting", "openapi", "swagger"]

def fetch_feed(url):
    print(f"[SYNC] Fetching ASP.NET Core feed: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Antigravity-CSharp-DocSync/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            return response.read()
    except Exception as e:
        print(f"[WARN] Fetch failed ({url}): {e}")
        fallback_url = "https://devblogs.microsoft.com/dotnet/feed/"
        req = urllib.request.Request(fallback_url, headers={"User-Agent": "Antigravity-CSharp-DocSync/2.0"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
                return response.read()
        except Exception as e2:
            print(f"[WARN] Fallback fetch failed: {e2}")
            return None

def parse_feed(xml_data):
    if not xml_data:
        return []
    items = []
    try:
        root = ET.fromstring(xml_data)
        channel = root.find("channel")
        if channel is None:
            return []
        for elem in channel.findall("item"):
            title = elem.findtext("title", default="").strip()
            link = elem.findtext("link", default="").strip()
            pub_date = elem.findtext("pubDate", default="").strip()
            description = elem.findtext("description", default="").strip()
            clean_desc = re.sub(r'<[^>]+>', '', description)
            clean_desc = (clean_desc[:200] + '...') if len(clean_desc) > 200 else clean_desc
            if any(kw in (title + " " + clean_desc).lower() for kw in KEYWORDS):
                items.append({"title": title, "link": link, "pub_date": pub_date, "description": clean_desc})
    except Exception as e:
        print(f"[ERROR] XML parse failed: {e}")
    return items

def generate_markdown(items):
    output_dir = os.path.dirname(OUTPUT_FILE)
    os.makedirs(output_dir, exist_ok=True)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    md = []
    md.append("# ASP.NET Core API Design & Architecture Patterns")
    md.append(f"<!-- last_synced: {datetime.now().strftime('%Y-%m-%d')} -->")
    md.append(f"\n> **Tự động cập nhật**: {now}")
    md.append("> **Nguồn**: [Microsoft ASP.NET Core Docs](https://learn.microsoft.com/aspnet/core/)")
    md.append("\n---\n")

    md.append("## 📌 Cogain BaseController Rules")
    md.append("- **Route Convention**: `api/v{version:apiVersion}/[controller]`")
    md.append("- **Authorization**: Yêu cầu thuộc tính `[Authorize]` trên Controller.")
    md.append("- **Standard Response**: Dùng `ApiResponse<T>` chuẩn hóa kết quả và mã lỗi.")
    md.append("- **Built-in CRUD**: Tận dụng endpoint CRUD từ `BaseController<>`. Chỉ bổ sung endpoint custom.")
    md.append("\n---\n")

    md.append("## 📰 Bài Viết Mới Nhất về ASP.NET Core\n")
    if items:
        for i, item in enumerate(items[:10], 1):
            md.append(f"### {i}. [{item['title']}]({item['link']})")
            md.append(f"- **Ngày**: {item['pub_date']}")
            md.append(f"- **Tóm tắt**: {item['description']}\n")
    else:
        md.append("*Tài liệu ASP.NET Core hiện tại đã ở trạng thái mới nhất.*\n")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print(f"[OK] Generated: {OUTPUT_FILE}")

def main():
    xml_data = fetch_feed(FEED_URL)
    if xml_data is None and os.path.exists(OUTPUT_FILE):
        print("[WARN] Offline fallback — keeping existing reference file.")
        return
    items = parse_feed(xml_data)
    generate_markdown(items)

if __name__ == "__main__":
    main()
