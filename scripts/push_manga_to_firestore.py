#!/usr/bin/env python3
"""
push_manga_to_firestore.py
Get Real - Manga Scraper & Cloud Firestore Uploader

Scrapes manga chapter images from jjkmangaa.com (with Jetpack / wsrv mirrors as fallback),
encodes them as base64 data URLs, and pushes them directly into Google Cloud Firestore.
This guarantees 100% reliable reader loading without external domain blocking or CORS issues.

Usage:
  python scripts/push_manga_to_firestore.py --chapter 1
  python scripts/push_manga_to_firestore.py --range 1 5
  python scripts/push_manga_to_firestore.py --chapter 1 --force
"""

import sys
import os
import re
import json
import time
import base64
import argparse
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

# Ensure unbuffered real-time stdout printing
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

DEFAULT_PROJECT_ID = "get-real-515ba"
DEFAULT_API_KEY = "AIzaSyB0iTRR8EVcXfykeFZ1E-D4GcWRHF95Q34"
FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
]

def load_catalog():
    """Load chapter catalog from chapters.js if available."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    chapters_js_path = os.path.join(script_dir, "..", "chapters.js")
    if not os.path.exists(chapters_js_path):
        return {}

    with open(chapters_js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract CHAPTER_DATA JSON
    m = re.search(r"const\s+CHAPTER_DATA\s*=\s*(\[[\s\S]*?\]);", content)
    if not m:
        return {}

    try:
        data = json.loads(m.group(1))
        catalog = {ch["number"]: ch for ch in data if "number" in ch}
        return catalog
    except Exception as e:
        print(f"[!] Warning: Could not parse chapters.js JSON: {e}")
        return {}

def scrape_chapter_webpage(chapter_num, url=None):
    """Scrape image URLs directly from chapter webpage."""
    if not url:
        url = f"https://jjkmangaa.com/jujutsu-kaisen-manga-chapter-{chapter_num}/"

    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENTS[0],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    })

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"[-] Failed to fetch webpage {url}: {e}")
        return []

    # Find image sources
    img_urls = []
    matches = re.findall(r'<img[^>]+(?:src|data-src)=["\'](https?://[^"\']+)["\']', html, re.IGNORECASE)
    for src in matches:
        if any(x in src.lower() for x in ["avatar", "logo", "icon", "banner", "gravatar", "admin"]):
            continue
        if src.lower().endswith((".webp", ".jpg", ".jpeg", ".png")) and src not in img_urls:
            img_urls.append(src)

    return img_urls

def download_image(url):
    """Download image with fallback mirrors. Returns (bytes, mime_type)."""
    clean_url = url.replace("https://", "").replace("http://", "")
    urls_to_try = [
        url,
        f"https://i0.wp.com/{clean_url}",
        f"https://wsrv.nl/?url={urllib.parse.quote(url)}"
    ]

    headers = {
        "User-Agent": USER_AGENTS[0],
        "Referer": "https://jjkmangaa.com/"
    }

    for u in urls_to_try:
        try:
            req = urllib.request.Request(u, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status == 200:
                    data = resp.read()
                    content_type = resp.headers.get("Content-Type", "image/webp")
                    if ";" in content_type:
                        content_type = content_type.split(";")[0].strip()
                    if content_type == "application/octet-stream" or not content_type.startswith("image/"):
                        content_type = "image/webp"
                    return data, content_type
        except Exception:
            continue

    return None, None

def optimize_image(data, mime):
    """Ensure image fits comfortably within Firestore 1 MB document limit using WebP."""
    if len(data) < 700000 and mime == "image/webp":
        return data, mime
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(data))
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=82)
        opt_data = out.getvalue()
        if len(opt_data) < len(data) or mime != "image/webp":
            return opt_data, "image/webp"
    except Exception:
        pass
    return data, mime

def check_page_exists(project_id, api_key, chapter_num, page_num):
    """Check if page already exists in Firestore."""
    url = f"{FIRESTORE_BASE.format(project_id=project_id)}/manga_chapters/{chapter_num}/pages/{page_num}?key={api_key}"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        return False
    except Exception:
        return False

def upload_page_to_firestore(project_id, api_key, chapter_num, page_num, data_url):
    """Upload page base64 image data to Firestore."""
    url = f"{FIRESTORE_BASE.format(project_id=project_id)}/manga_chapters/{chapter_num}/pages/{page_num}?key={api_key}"
    body = {
        "fields": {
            "page": {"integerValue": str(page_num)},
            "imageData": {"stringValue": data_url},
            "timestamp": {"integerValue": str(int(time.time() * 1000))}
        }
    }
    payload = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="PATCH"
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"[-] Firestore PATCH error (ch {chapter_num} p {page_num}): {e}")
        return False

def update_chapter_metadata(project_id, api_key, chapter_num, cloud_count):
    """Update parent chapter document with cloud sync status."""
    url = (f"{FIRESTORE_BASE.format(project_id=project_id)}/manga_chapters/{chapter_num}"
           f"?updateMask.fieldPaths=hasCloudPages&updateMask.fieldPaths=cloudPageCount&key={api_key}")
    body = {
        "fields": {
            "hasCloudPages": {"booleanValue": True},
            "cloudPageCount": {"integerValue": str(cloud_count)}
        }
    }
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False

def process_single_page(project_id, api_key, chapter_num, page_num, img_url, force=False):
    """Worker task: checks, downloads, encodes, and uploads a single page."""
    if not force and check_page_exists(project_id, api_key, chapter_num, page_num):
        return page_num, True, "cached"

    img_data, mime = download_image(img_url)
    if not img_data:
        return page_num, False, "download_failed"

    img_data, mime = optimize_image(img_data, mime)

    b64 = f"data:{mime};base64," + base64.b64encode(img_data).decode("utf-8")
    ok = upload_page_to_firestore(project_id, api_key, chapter_num, page_num, b64)
    if ok:
        return page_num, True, f"uploaded ({len(img_data) // 1024} KB)"
    else:
        return page_num, False, "upload_failed"

def sync_chapter(project_id, api_key, chapter_num, catalog, concurrency=5, force=False):
    """Sync an entire chapter to Firestore."""
    print(f"\n=======================================================")
    print(f"[*] Processing Chapter {chapter_num}...")
    print(f"=======================================================")

    # 1. Determine image URLs
    ch_info = catalog.get(chapter_num)
    img_urls = []
    if ch_info and ch_info.get("pages"):
        img_urls = ch_info["pages"]
        print(f"[+] Loaded {len(img_urls)} page URLs from local catalog")
    else:
        print(f"[*] Scraping live page URLs from web...")
        img_urls = scrape_chapter_webpage(chapter_num)
        print(f"[+] Scraped {len(img_urls)} page URLs from webpage")

    if not img_urls:
        print(f"[-] No page images found for Chapter {chapter_num}. Skipping.")
        return 0, 0

    total_pages = len(img_urls)
    success_count = 0

    # 2. Process pages in parallel
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {}
        for idx, url in enumerate(img_urls, start=1):
            f = executor.submit(process_single_page, project_id, api_key, chapter_num, idx, url, force)
            futures[f] = idx

        for f in as_completed(futures):
            p_num, ok, detail = f.result()
            if ok:
                success_count += 1
                status = "[OK]"
            else:
                status = "[ERR]"
            print(f"  {status} Ch {chapter_num} Page {p_num:02d}/{total_pages:02d} -> {detail}")

    elapsed = time.time() - start_time
    print(f"[+] Chapter {chapter_num} complete: {success_count}/{total_pages} pages synced in {elapsed:.1f}s")

    if success_count > 0:
        update_chapter_metadata(project_id, api_key, chapter_num, success_count)

    return success_count, total_pages

def main():
    parser = argparse.ArgumentParser(description="Get Real Manga Scraper & Firestore Uploader")
    parser.add_argument("--chapter", type=int, help="Single chapter number to scrape and push (e.g. 1)")
    parser.add_argument("--range", nargs=2, type=int, metavar=("START", "END"), help="Range of chapters (e.g. 1 5)")
    parser.add_argument("--all", action="store_true", help="Scrape and upload all 272 chapters")
    parser.add_argument("--concurrency", type=int, default=5, help="Concurrent worker threads (default: 5)")
    parser.add_argument("--force", action="store_true", help="Force re-upload of existing pages")
    parser.add_argument("--project-id", default=DEFAULT_PROJECT_ID, help="Firebase project ID")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="Firebase Web API key")

    args = parser.parse_args()

    if not args.chapter and not args.range and not args.all:
        parser.print_help()
        print("\nDefaulting to Chapter 1...")
        args.chapter = 1

    catalog = load_catalog()
    print(f"[i] Catalog loaded with {len(catalog)} chapters.")
    print(f"[i] Target Firestore: projects/{args.project_id}/databases/(default)")

    if args.chapter:
        chapters = [args.chapter]
    elif args.range:
        chapters = list(range(args.range[0], args.range[1] + 1))
    elif args.all:
        chapters = sorted(catalog.keys()) if catalog else list(range(1, 273))

    total_success = 0
    total_expected = 0

    for ch_num in chapters:
        succ, exp = sync_chapter(
            project_id=args.project_id,
            api_key=args.api_key,
            chapter_num=ch_num,
            catalog=catalog,
            concurrency=args.concurrency,
            force=args.force
        )
        total_success += succ
        total_expected += exp

    print("\n=======================================================")
    print(f"[+] SYNC COMPLETE: {total_success}/{total_expected} total pages stored in Firestore.")
    print(f"=======================================================")

if __name__ == "__main__":
    main()
