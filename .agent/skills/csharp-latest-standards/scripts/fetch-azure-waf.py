#!/usr/bin/env python3
"""
Azure Well-Architected Framework & .NET Cloud Architecture Sync Script
- Cập nhật chuẩn kiến trúc đám mây, Security, Reliability và Cost Optimization
- Tự động cập nhật azure-well-architected.md
"""

import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

FEED_URL = "https://devblogs.microsoft.com/dotnet/category/cloud/feed/"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "../references/azure-well-architected.md")
TIMEOUT = 10

KEYWORDS = ["azure", "cloud", "architecture", "security", "reliability", "cost", "resilience", "containers", "aspire"]

def fetch_feed(url):
    print(f"[SYNC] Fetching Cloud Architecture feed: {url}")
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
    md.append("# Azure Well-Architected Framework for .NET Microservices")
    md.append(f"<!-- last_synced: {datetime.now().strftime('%Y-%m-%d')} -->")
    md.append(f"\n> **Tự động cập nhật**: {now}")
    md.append("> **Nguồn**: [Microsoft Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)")
    md.append("\n---\n")

    md.append("## 🛡️ Core Pillars for Cogain Architecture")
    md.append("1. **Reliability**: Tích hợp Polly Circuit Breaker, Retry Policy cho gRPC & DB calls.")
    md.append("2. **Security**: Không lưu secrets trong code; sử dụng Environment Variables / Vault.")
    md.append("3. **Performance Efficiency**: Tận dụng Redis Caching, Async/Await non-blocking I/O.")
    md.append("4. **Operational Excellence**: Cấu hình Telemetry & Health Check Endpoints.")
    md.append("\n---\n")

    md.append("## 📰 Bài Viết Mới Nhất về Cloud & .NET Architecture\n")
    if items:
        for i, item in enumerate(items[:10], 1):
            md.append(f"### {i}. [{item['title']}]({item['link']})")
            md.append(f"- **Ngày**: {item['pub_date']}")
            md.append(f"- **Tóm tắt**: {item['description']}\n")
    else:
        md.append("*Tài liệu Cloud Architecture hiện tại đã ở trạng thái mới nhất.*\n")

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
