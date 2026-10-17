#!/usr/bin/env python3
"""
Microsoft C# Language Features Sync Script
- Cập nhật tính năng C# 12, 13, 14 mới nhất từ Microsoft Learn & .NET Blog
- Tự động cập nhật csharp-14-features.md
"""

import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

FEED_URL = "https://devblogs.microsoft.com/dotnet/category/csharp/feed/"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "../references/csharp-14-features.md")
TIMEOUT = 10

KEYWORDS = ["c# 12", "c# 13", "c# 14", "c#", "field", "primary constructor", "collection expression", "extension", "null-conditional", "pattern matching", "params collections"]

def fetch_feed(url):
    print(f"[SYNC] Fetching C# Language feed: {url}")
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
    md.append("# Modern C# Language Features (C# 12 → 14)")
    md.append(f"<!-- last_synced: {datetime.now().strftime('%Y-%m-%d')} -->")
    md.append(f"\n> **Tự động cập nhật**: {now}")
    md.append("> **Nguồn**: [Microsoft Learn — What's new in C#](https://learn.microsoft.com/dotnet/csharp/whats-new/)")
    md.append("\n---\n")

    md.append("## 🚀 C# 12 Key Features")
    md.append("- **Primary Constructors**: `public class Service(ILogger logger)` (Không dùng cho `BaseService` con).")
    md.append("- **Collection Expressions**: `int[] arr = [1, 2, 3];` và spread operator `[..listA, ..listB]`.")
    md.append("- **Ref Readonly Parameters**: Tối ưu hiệu năng truyền tham số struct lớn.")
    md.append("\n## 🚀 C# 13 Key Features")
    md.append("- **`params` Collections**: Hỗ trợ `params IEnumerable<T>` và `params ReadOnlySpan<T>`.")
    md.append("- **New Lock Object**: `System.Threading.Lock` giúp khóa luồng nhanh và an toàn hơn.")
    md.append("- **Field-backed properties preview**: Bắt đầu thử nghiệm từ khóa `field`.")
    md.append("\n## 🚀 C# 14 Key Features (Preview)")
    md.append("- **`field` Keyword**: Truy cập trực tiếp backing field trong property accessor.")
    md.append("- **`?.=` Null-conditional Assignment**: Gán giá trị an toàn khi target không null.")
    md.append("- **Extension Members**: Định nghĩa extension properties và operators.")
    md.append("\n---\n")

    md.append("## 📰 Tin Tức & Bài Viết Mới về Ngôn Ngữ C#\n")
    if items:
        for i, item in enumerate(items[:10], 1):
            md.append(f"### {i}. [{item['title']}]({item['link']})")
            md.append(f"- **Ngày**: {item['pub_date']}")
            md.append(f"- **Tóm tắt**: {item['description']}\n")
    else:
        md.append("*Tài liệu tính năng ngôn ngữ C# hiện tại đã ở trạng thái mới nhất.*\n")

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
