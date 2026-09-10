#!/usr/bin/env python3
"""
Microsoft .NET & C# Docs Sync Script (v2.0)
- RSS feed từ Microsoft .NET Blog
- Keyword filter cho C#/.NET specific content
- last_synced metadata
- Offline fallback (giữ file cũ nếu fetch fail)
"""

import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

FEED_URL = "https://devblogs.microsoft.com/dotnet/feed/"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "../references/csharp-whats-new.md")
TIMEOUT = 10  # seconds

# Keywords to filter relevant articles
RELEVANT_KEYWORDS = [
    "c#", "csharp", ".net", "dotnet", "ef core", "entity framework",
    "asp.net", "grpc", "performance", "linq", "roslyn", "source generator",
    "minimal api", "blazor", "docker", "container", "kubernetes",
    "memory", "span", "frozen", "collection", "pattern matching",
    "primary constructor", "record", "async", "cancellation",
]

def fetch_rss_feed(url):
    print(f"[SYNC] Fetching RSS feed: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Antigravity-CSharp-DocSync/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            return response.read()
    except Exception as e:
        print(f"[WARN] Fetch failed: {e}")
        return None

def is_relevant(title, description):
    text = (title + " " + description).lower()
    return any(kw in text for kw in RELEVANT_KEYWORDS)

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
            if is_relevant(title, clean_desc):
                items.append({"title": title, "link": link, "pub_date": pub_date, "description": clean_desc})
    except Exception as e:
        print(f"[ERROR] XML parse failed: {e}")
    return items

def generate_markdown(items):
    output_dir = os.path.dirname(OUTPUT_FILE)
    os.makedirs(output_dir, exist_ok=True)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    md = []
    md.append("# Microsoft .NET & C# Latest Updates")
    md.append(f"<!-- last_synced: {datetime.now().strftime('%Y-%m-%d')} -->")
    md.append("<!-- source: devblogs.microsoft.com/dotnet/feed/ -->")
    md.append(f"\n> **Tự động cập nhật**: {now}")
    md.append("> **Nguồn**: [Microsoft .NET Blog](https://devblogs.microsoft.com/dotnet/)")
    md.append("\n---\n")

    md.append("## TL;DR")
    md.append("1. **Primary Constructors (C# 12)**: Khai báo tham số constructor trên tên class/struct.")
    md.append("2. **Collection Expressions `[...]` (C# 12)**: Cú pháp đồng nhất cho mảng, List, Span.")
    md.append("3. **Extension Members (C# 14)**: Extension properties, operators — không chỉ methods.")
    md.append("4. **`field` keyword (C# 14)**: Truy cập backing field trong auto-property accessors.")
    md.append("5. **`?.=` Null-conditional assignment (C# 14)**: Gán giá trị chỉ khi object != null.")
    md.append("6. **FrozenDictionary/FrozenSet (.NET 8+)**: Tra cứu immutable $O(1)$ read-only.")
    md.append("\n---\n")

    md.append("## 📰 Bài Viết Mới Nhất (Filtered: C#/.NET)\n")
    if items:
        for i, item in enumerate(items[:15], 1):
            md.append(f"### {i}. [{item['title']}]({item['link']})")
            md.append(f"- **Ngày**: {item['pub_date']}")
            md.append(f"- **Tóm tắt**: {item['description']}\n")
    else:
        md.append("*Không có bài viết C#/.NET mới hoặc không thể tải RSS feed.*\n")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print(f"[OK] Generated: {OUTPUT_FILE}")

def main():
    # Offline fallback: nếu fetch fail, giữ file cũ
    xml_data = fetch_rss_feed(FEED_URL)
    if xml_data is None and os.path.exists(OUTPUT_FILE):
        print("[WARN] Offline fallback — keeping existing reference file.")
        return
    items = parse_feed(xml_data)
    generate_markdown(items)

if __name__ == "__main__":
    main()
