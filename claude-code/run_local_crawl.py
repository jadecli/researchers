"""Run releasebot_spider against local test fixtures via a local HTTP server.

Usage: PYTHONPATH=. python3 run_local_crawl.py
"""

import http.server
import json
import os
import threading
import time
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "test_fixtures"
PORT = 8787
OUTPUT_FILE = Path(__file__).parent / "data" / "releasebot_local_crawl.jsonl"


class FixtureHandler(http.server.SimpleHTTPRequestHandler):
    """Serve test fixtures from the fixtures directory."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FIXTURES_DIR), **kwargs)

    def translate_path(self, path: str) -> str:
        """Route /sitemap-products.xml and /products/* to fixture files."""
        if path == "/robots.txt":
            # Return a permissive robots.txt
            return str(FIXTURES_DIR / "_robots.txt")
        if path == "/sitemap-products.xml":
            return str(FIXTURES_DIR / "sitemap-products.xml")
        if path.startswith("/products/"):
            product_name = path.split("/products/")[-1].rstrip("/")
            return str(FIXTURES_DIR / "products" / f"{product_name}.html")
        return super().translate_path(path)

    def end_headers(self):
        """Add Content-Type for XML sitemaps."""
        if self.path.endswith(".xml"):
            self.send_header("Content-Type", "application/xml")
        super().end_headers()

    def log_message(self, format, *args):
        """Suppress noisy HTTP logs."""
        pass


def create_robots_txt():
    """Create a permissive robots.txt fixture."""
    robots = FIXTURES_DIR / "_robots.txt"
    robots.write_text("User-agent: *\nAllow: /\n")


def run_server():
    """Start the local HTTP server."""
    server = http.server.HTTPServer(("127.0.0.1", PORT), FixtureHandler)
    server.serve_forever()


def run_scrapy_crawl():
    """Run the Scrapy spider against the local server."""
    import subprocess

    env = os.environ.copy()
    env["PYTHONPATH"] = str(Path(__file__).parent)

    # Override start_urls via spider argument
    cmd = [
        "python3", "-m", "scrapy", "crawl", "releasebot_spider",
        "-a", f"start_url=http://127.0.0.1:{PORT}/sitemap-products.xml",
        "-s", "DELTAFETCH_ENABLED=False",
        "-s", "EXTENSIONS={}",
        "-s", "DOWNLOADER_MIDDLEWARES={}",
        "-s", "ITEM_PIPELINES={}",
        "-s", "ROBOTSTXT_OBEY=True",
        "-s", "HTTPCACHE_ENABLED=False",
        "-s", "DOWNLOAD_DELAY=0.1",
        "-s", "AUTOTHROTTLE_ENABLED=False",
        "-s", "LOG_LEVEL=INFO",
        "-s", f"http_proxy=",
        "-s", f"https_proxy=",
        "-o", str(OUTPUT_FILE),
    ]

    start = time.perf_counter()
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).parent),
        env={**env, "http_proxy": "", "https_proxy": "", "HTTP_PROXY": "", "HTTPS_PROXY": ""},
        timeout=60,
    )
    elapsed = time.perf_counter() - start

    print("=== SCRAPY OUTPUT ===")
    if result.stdout:
        # Print just stats
        for line in result.stdout.split("\n"):
            if line.strip():
                print(line)
    if result.stderr:
        for line in result.stderr.split("\n"):
            if "INFO" in line or "ERROR" in line or "WARNING" in line:
                print(line)

    print(f"\n=== CRAWL COMPLETE ===")
    print(f"Elapsed: {elapsed:.3f}s")
    print(f"Exit code: {result.returncode}")

    # Show results
    if OUTPUT_FILE.exists():
        items = []
        for line in OUTPUT_FILE.read_text().strip().split("\n"):
            if line.strip():
                items.append(json.loads(line))
        print(f"Items scraped: {len(items)}")
        for item in items:
            print(f"  - {item.get('title', 'untitled')} ({item.get('url', 'no-url')}) quality={item.get('quality_score', 'N/A')}")
    else:
        print("No output file generated")

    return elapsed, result.returncode


if __name__ == "__main__":
    create_robots_txt()
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Remove old output
    if OUTPUT_FILE.exists():
        OUTPUT_FILE.unlink()

    # Start local server in background
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    time.sleep(0.5)  # Wait for server to start

    print(f"Local fixture server running on http://127.0.0.1:{PORT}")
    print(f"Sitemap: http://127.0.0.1:{PORT}/sitemap-products.xml")
    print()

    elapsed, returncode = run_scrapy_crawl()

    # Write benchmark result
    benchmark = {
        "crawler": "python-scrapy",
        "target": "releasebot.io/sitemap-products.xml",
        "fixture_mode": True,
        "elapsed_seconds": round(elapsed, 3),
        "exit_code": returncode,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    benchmark_file = Path(__file__).parent / "data" / "benchmark_python.json"
    benchmark_file.write_text(json.dumps(benchmark, indent=2))
    print(f"\nBenchmark written to {benchmark_file}")
