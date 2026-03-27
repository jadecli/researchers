# Bloom filters for iterative documentation crawling

When agents crawl documentation sites iteratively—re-running spiders across sessions to catch updated pages—they face a compounding problem: the set of "already seen" URLs and content fingerprints grows without bound. A naive SHA256 fingerprint set consuming 21.6MB at 100K items is fine for a single run, but across dozens of iterative rounds it becomes a meaningful drag on memory, and more critically, it doesn't persist across runs. Every new session starts from zero.

We replaced the in-memory fingerprint set with a pure-Python Bloom filter that persists to disk, uses 126x less memory, and adapts its parameters based on which spider is running. This document describes the implementation, the contextual switching system we built for it, and the evaluation methodology that confirmed the improvement was meaningful.

## The problem: duplicate work compounds across iterations

Our crawling system runs iteratively. Each round crawls documentation sites (platform.claude.com, anthropic.com, claude.com), scores page quality, and writes improvement deltas that steer the next round. The feedback loop looks like this:

```
Spider crawls page → Pipeline scores quality → Writes improvements/iter_N.jsonl
                                                         ↓
Next iteration ← context_delta.py generates steering payload
```

The issue is at the request and item levels. Without cross-run deduplication, the spider re-requests every URL it discovered in previous runs. DeltaFetch (BsdDb3-backed) handles some of this at the request level, but the item-level `DedupPipeline` used an in-memory Python `set` of SHA256 hex strings that vanished when the spider process exited.

This matters most for `platform.claude.com/docs`. The site serves tool usage documentation that updates frequently, and we need to crawl it iteratively to catch changes. But it also enforces rate limits—hitting the same URLs repeatedly across runs risks 429 responses or outright blocks. We needed deduplication that survives spider restarts.

## Why Bloom filters, and why not Redis

The standard recommendation for Scrapy duplicate filtering at scale is `scrapy-redis-bloomfilter`, which pairs a Bloom filter with a Redis backend for distributed state. We didn't use it for three reasons:

1. **No distributed crawling.** Our spiders run single-node. Redis would be infrastructure overhead for a feature we don't need.
2. **Persistence is the actual requirement.** We need state to survive process restarts, not to be shared across machines. A file on disk serves this purpose.
3. **Zero external dependencies.** The crawling system already has a complex dependency tree (Scrapy, beautifulsoup4, markdownify, pydantic, spidermon, scrapy-deltafetch). Adding Redis as a runtime dependency for deduplication felt disproportionate.

So we built a pure-Python Bloom filter using `hashlib.sha256` with Kirsch-Mitzenmacker double hashing, binary serialization for persistence, and a `BloomProfile` system that selects parameters based on the spider's crawl pattern.

## Implementation

### The Bloom filter itself

The core data structure is straightforward. Two 64-bit values extracted from a SHA256 digest generate `k` bit positions via the Kirsch-Mitzenmacker optimization:

```python
def _get_bit_positions(self, item: str) -> list[int]:
    digest = hashlib.sha256(item.encode("utf-8")).digest()
    h1 = struct.unpack_from("<Q", digest, 0)[0]
    h2 = struct.unpack_from("<Q", digest, 8)[0]
    return [(h1 + i * h2) % self.num_bits for i in range(self.num_hashes)]
```

Optimal bit array size and hash count are derived from the standard formulas:

- Bits: `m = -(n * ln(p)) / (ln(2)^2)` where `n` is expected items and `p` is false positive rate
- Hashes: `k = (m/n) * ln(2)`

For 100K items at 0.1% false positive rate, this produces ~1.44M bits (175KB) with 10 hash functions.

Persistence uses a compact binary format: a 24-byte header (expected_items, fp_rate, num_bits, num_hashes, count) followed by the raw bit array. Loading is a single `open()` + `read()`. No serialization library needed.

### Two deduplication layers

We integrated the Bloom filter at two levels of the Scrapy pipeline:

**Request level — `BloomDupeFilter`** replaces Scrapy's default `RFPDupeFilter`. Before a request enters the downloader, we check if its canonicalized URL fingerprint exists in the Bloom filter. If it does, the request is silently dropped—it never hits the network.

```
DUPEFILTER_CLASS = "scrapy_researchers.bloom_dupefilter.BloomDupeFilter"
```

**Item level — `DedupPipeline`** checks content fingerprints (`SHA256(url + content[:500])`) after the page has been downloaded and extracted. This catches cases where different URLs serve identical content—common in documentation sites with canonical URL redirects.

Both layers load persisted state on `open_spider` and save on `close_spider`, so deduplication accumulates across runs.

### Contextual switching via `BloomProfile`

This is the part that required the most design thought. Our six spiders have fundamentally different crawl patterns:

| Spider | Pattern | URLs discovered | Rate limit risk | Link following |
|--------|---------|----------------|-----------------|----------------|
| `platform_spider` | Iterative doc crawl | ~500 | High | Yes, depth 4 |
| `claude_com_spider` | Iterative doc crawl | ~500 | High | Yes, depth 4 |
| `anthropic_spider` | Sitemap-driven | ~1000+ | Low | No (sitemap provides all URLs) |
| `docs_spider` | Generic llms.txt | ~100 | Medium | Yes, depth 5 |
| `llms_full_spider` | Single file download | 1 | None | No (DEPTH_LIMIT=0) |
| `github_spider` | API-driven (gh CLI) | ~200 | Separate (API rate limiter) | No |

A single set of Bloom filter parameters would either be wasteful for small spiders or too tight for large ones. Worse, `llms_full_spider` and `github_spider` don't use Scrapy's HTTP downloader at all—request-level deduplication is meaningless for them.

We solved this with `BloomProfile`, a frozen dataclass that bundles all bloom-related configuration:

```python
@dataclass(frozen=True)
class BloomProfile:
    expected_urls: int
    fp_rate: float
    persist_dir: str
    request_dedup: bool = True
    item_dedup: bool = True
    download_delay: float = 2.0
    autothrottle_start: float = 2.0
    autothrottle_max: float = 60.0
    retry_times: int = 5
```

Each spider has a named profile in `BLOOM_PROFILES`:

```python
"platform_spider": BloomProfile(
    expected_urls=5_000,
    fp_rate=0.0005,        # stricter — missing a changed page is costly
    persist_dir="scrapy_researchers/.bloomstate",
    download_delay=3.0,
    autothrottle_max=120.0,
    retry_times=7,
),

"github_spider": BloomProfile(
    expected_urls=10_000,
    fp_rate=0.001,
    persist_dir="scrapy_researchers/.bloomstate",
    request_dedup=False,   # uses gh CLI, not HTTP downloader
    item_dedup=True,
    download_delay=0.0,    # API has its own rate limiter
),
```

The key design decision: profiles are applied at the class level via `BaseResearchSpider.update_settings()`, which Scrapy calls before spider instantiation. This means `BloomDupeFilter.from_settings()` and `DedupPipeline.open_spider()` both receive the correct spider-specific parameters without any special wiring.

```python
@classmethod
def update_settings(cls, settings):
    super().update_settings(settings)
    profile = get_bloom_profile(getattr(cls, "name", ""))
    bloom_settings = profile.to_scrapy_settings(getattr(cls, "name", "default"))
    for key, value in bloom_settings.items():
        if settings.get(key) is None or key not in (cls.custom_settings or {}):
            settings.set(key, value, priority="spider")
```

Spiders that set `request_dedup=False` in their profile get Scrapy's default `RFPDupeFilter` instead of `BloomDupeFilter`—no bloom overhead for spiders that don't benefit from it.

## Anti-blocking strategy for platform.claude.com

The bloom filter is one part of a broader strategy for crawling platform.claude.com/docs without getting blocked. The full approach:

1. **llms.txt as entry point.** This file is explicitly designed for LLM and bot consumption. It's the safest starting URL—less likely to trigger anti-bot measures than crawling HTML pages directly.

2. **Cross-run bloom dedup.** Once a URL has been served, it's in the bloom filter's persisted state. Subsequent runs don't re-request it unless the filter is reset. This reduces request volume by the duplicate rate across iterations.

3. **URL shuffling.** The `platform_spider` shuffles URLs extracted from llms.txt before crawling. Sequential access patterns (page-1, page-2, page-3...) are a common signal that triggers rate limiters. Randomized ordering looks more like organic browsing.

4. **Fragment stripping and per-page dedup.** Before yielding an internal link as a follow-up request, we strip URL fragments (`#section`) and deduplicate within the page's link set. This prevents the same base URL from being requested multiple times because different anchor links point to it.

5. **Priority tiers.** Fresh URLs from llms.txt get higher scheduler priority than followed internal links. If the crawl budget runs out, we've prioritized the pages we know exist over speculative discovery.

6. **Conditional HTTP caching.** RFC2616 policy sends `If-Modified-Since` and `If-None-Match` headers. Pages returning 304 Not Modified are served from cache at zero network cost. This works alongside bloom dedup—the bloom filter prevents the request entirely, while the cache handles cases where a request is made but the content hasn't changed.

## Evaluation

We evaluated at five scales (100 to 100K items) measuring memory usage, false positive rate, persistence reliability, and insert throughput.

### Memory

| Items | SHA256 set | Bloom filter | Reduction |
|------:|----------:|----------:|--------:|
| 100 | 26.3 KB | 0.2 KB | 149x |
| 1,000 | 212.9 KB | 1.8 KB | 121x |
| 10,000 | 2,318.9 KB | 17.6 KB | 132x |
| 50,000 | 11,081.4 KB | 87.8 KB | 126x |
| 100,000 | 22,162.6 KB | 175.5 KB | 126x |

At 100K items—typical for a mature iterative crawling campaign—the Bloom filter uses 176KB versus the SHA256 set's 21.6MB.

### False positive rate

| Items | Target FP | Actual FP | Estimated FP |
|------:|----------:|----------:|------------:|
| 100 | 0.10% | 0.00% | 0.10% |
| 1,000 | 0.10% | 0.30% | 0.10% |
| 10,000 | 0.10% | 0.11% | 0.10% |
| 100,000 | 0.10% | 0.16% | 0.10% |

The actual false positive rate stays close to the target. The 0.30% spike at 1K items is expected variance for small sample sizes—the same test at 10K converges to 0.11%.

### Per-spider memory footprint

When profiles are applied, each spider uses only what it needs:

| Spider | Capacity | FP rate | Memory | Request dedup | Delay |
|--------|----------|---------|--------|:-------------:|-------|
| `platform_spider` | 5,000 | 0.05% | 9.7 KB | Yes | 3.0s |
| `claude_com_spider` | 5,000 | 0.05% | 9.7 KB | Yes | 3.0s |
| `anthropic_spider` | 50,000 | 0.20% | 78.9 KB | Yes | 2.0s |
| `docs_spider` | 10,000 | 0.10% | 17.6 KB | Yes | 2.0s |
| `llms_full_spider` | 1,000 | 0.10% | 1.8 KB | No | 2.0s |
| `github_spider` | 10,000 | 0.10% | 17.6 KB | No | 0.0s |

The `llms_full_spider` uses 1.8KB. The `anthropic_spider` uses 78.9KB. Neither is wasting memory on parameters designed for the other.

### Persistence

All five scale tests confirmed successful save/load roundtrips. The loaded filter correctly identified all previously inserted items (zero false negatives) and maintained the same count, bit count, and hash count as the original.

## Applicability beyond crawling: agent tool call dedup

We also analyzed whether Bloom filters could reduce token usage in Claude Code's agent tool loop. The agent loop at `claude-multi-agent-sdk/src/agent/loop.ts:150` executes tools via `Promise.all()` over tool use blocks. When context compression occurs during long sessions, the model loses memory of previous tool results and re-issues identical calls.

We scored 14 tools across four criteria using a weighted matrix multiplication:

```
Score = A @ w

where A[i][j] = normalized tool characteristics
      w = [0.40, 0.20, 0.25, 0.15]  (token savings, fingerprint quality,
                                       low rework, call frequency)
```

The top candidates, ranked by composite score:

| Rank | Tool | Score | Tokens saved/session | Duplicate rate |
|------|------|------:|--------------------:|:-------------:|
| 1 | Read | 0.965 | 18,000 | 40% |
| 2 | Grep | 0.582 | 2,000 | 25% |
| 3 | GitHub (read) | 0.580 | 3,600 | 30% |
| 4 | Context7 (query-docs) | 0.558 | 3,375 | 45% |
| 5 | Glob | 0.556 | 900 | 30% |

Read dominates because it has the highest per-call token cost (1,500 avg), highest duplicate rate (40%—same files re-read after context compression), and a trivially fingerprinted input (`file_path + offset + limit`).

Across all bloom-compatible tools, the feasible token savings per session are **30.4%** of total tool output tokens (39,435 of 129,700). This parallels Anthropic's finding with Programmatic Tool Calling that keeping intermediate results out of context reduced average token usage by 37%.

Not all tools benefit. Write, Edit, and send operations (Slack, Gmail) produce new content by definition—deduplication would be incorrect. Agent prompts are too fuzzy to fingerprint reliably. Bash commands have side effects that make cached results dangerous.

## What we'd do differently

**The false positive rate tradeoff is context-dependent.** For `platform_spider`, we chose 0.05% because missing an updated page means the improvement loop can't detect the change. For `anthropic_spider`, we relaxed to 0.2% because sitemap-sourced URLs are stable—a false positive just means skipping one page that was already crawled. This contextual tuning matters more than the absolute FP rate.

**Bloom filters don't help with change detection.** They answer "have I seen this before?" but not "has this changed since I last saw it?" For that, we still rely on DeltaFetch (BsdDb3 storage) and HTTP conditional requests (304 Not Modified). The bloom filter and DeltaFetch are complementary layers, not substitutes.

**The profile system could be dynamic.** Currently, `BLOOM_PROFILES` is a static dict. A spider that discovers far more URLs than expected will saturate its bloom filter, increasing the false positive rate. A production system would monitor `estimated_fp_rate` during the crawl and resize if it exceeds a threshold. We haven't needed this yet because the profile capacities are conservatively sized—but it's the first thing that would break at scale.

## Files

```
scrapy_researchers/
├── bloom_filter.py          # BloomFilter + BloomProfile + BLOOM_PROFILES registry
├── bloom_dupefilter.py      # Scrapy DUPEFILTER_CLASS replacement
├── bloom_eval.py            # Evaluation script (memory, FP rate, persistence)
├── bloom_tool_analysis.py   # Agent tool applicability scoring matrix
├── pipelines.py             # DedupPipeline (bloom-backed item dedup)
├── settings.py              # DUPEFILTER_CLASS config
├── spiders/
│   ├── base_spider.py       # update_settings() injects BloomProfile
│   ├── platform_spider.py   # Anti-blocking: shuffle, fragment strip, priority tiers
│   ├── docs_spider.py       # Per-page link dedup
│   ├── claude_com_spider.py # Per-page link dedup
│   ├── anthropic_spider.py  # Sitemap-driven, high-capacity profile
│   ├── llms_full_spider.py  # Item-only dedup (no request-level bloom)
│   └── github_spider.py     # Item-only dedup (API-driven)
└── .bloomstate/             # Persisted bloom filter state (gitignored)
    ├── platform_spider_dupefilter.bloom
    ├── platform_spider_dedup.bloom
    └── ...
```

Tests: 27 passing (`tests/test_bloom_filter.py`), covering core filter operations, false positive bounds, persistence roundtrips, profile resolution, and per-spider path isolation.
