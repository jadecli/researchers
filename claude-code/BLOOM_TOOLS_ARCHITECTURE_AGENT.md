# BLOOM_TOOLS_ARCHITECTURE — Agent Reference

> **Format**: Deterministic reference for Claude agents. No prose. Structured for tool-call planning, code generation, and automated validation. All claims traced to file:line or evaluation output.

---

## SYSTEM IDENTITY

```yaml
component: bloom-filter-dedup
repo: jadecli/researchers
subdir: claude-code/scrapy_researchers
language: python 3.11+
external_deps: none  # uses stdlib hashlib, struct, math only
test_command: "cd claude-code && PYTHONPATH=. python3 -m pytest tests/test_bloom_filter.py -v"
eval_command: "cd claude-code && PYTHONPATH=. python3 -m scrapy_researchers.bloom_eval"
test_count: 27
test_status: passing
```

---

## MODULE MAP

```
bloom_filter.py          → BloomFilter, BloomProfile, BLOOM_PROFILES, get_bloom_profile()
bloom_dupefilter.py      → BloomDupeFilter (Scrapy DUPEFILTER_CLASS)
bloom_eval.py            → evaluation script (memory, FP rate, persistence, profiles)
bloom_tool_analysis.py   → agent tool scoring matrix (14 tools × 4 criteria)
pipelines.py             → DedupPipeline (bloom-backed, lines 107-179)
settings.py              → DUPEFILTER_CLASS assignment (line 35)
spiders/base_spider.py   → update_settings() injects BloomProfile (lines 44-60)
tests/test_bloom_filter.py → 27 tests across 4 test classes
.bloomstate/             → persisted state directory (gitignored)
```

---

## DATA STRUCTURES

### BloomFilter

```
file: scrapy_researchers/bloom_filter.py:29
```

```python
class BloomFilter:
    __init__(expected_items: int = 100_000, fp_rate: float = 0.001)
    add(item: str) -> bool          # returns True if item was already possibly present
    __contains__(item: str) -> bool  # membership test (no false negatives)
    save(path: str | Path) -> None   # binary serialize to disk
    load(path: str | Path) -> BloomFilter  # classmethod, binary deserialize
    merge(other: BloomFilter) -> None      # OR bit arrays (same size required)

    # read-only properties
    count: int                  # approximate unique items inserted
    memory_bytes: int           # len(bit_array)
    estimated_fp_rate: float    # (1 - e^(-kn/m))^k
    num_bits: int               # m
    num_hashes: int             # k
```

**Hash function**: Kirsch-Mitzenmacker double hashing over SHA256.
```
digest = SHA256(item.encode("utf-8"))
h1 = uint64_le(digest[0:8])
h2 = uint64_le(digest[8:16])
position_i = (h1 + i * h2) % num_bits   for i in 0..num_hashes
```

**Optimal parameter formulas**:
```
num_bits   = ceil(-(n * ln(p)) / (ln(2)^2))
num_hashes = ceil((m / n) * ln(2))
```

**Persistence format** (binary, little-endian):
```
offset  size  type     field
0       4     uint32   expected_items
4       8     float64  fp_rate
12      4     uint32   num_bits
16      4     uint32   num_hashes
20      4     uint32   count
24      var   bytes    bit_array (ceil(num_bits / 8) bytes)
```

### BloomProfile

```
file: scrapy_researchers/bloom_filter.py:169
```

```python
@dataclass(frozen=True)
class BloomProfile:
    expected_urls: int          # capacity before FP rate degrades
    fp_rate: float              # target false positive rate
    persist_dir: str            # directory for .bloom state files
    request_dedup: bool = True  # enable BloomDupeFilter for HTTP requests
    item_dedup: bool = True     # enable bloom-backed DedupPipeline
    download_delay: float = 2.0
    autothrottle_start: float = 2.0
    autothrottle_max: float = 60.0
    retry_times: int = 5

    dupefilter_path(spider_name: str) -> str   # "{persist_dir}/{spider_name}_dupefilter.bloom"
    dedup_path(spider_name: str) -> str        # "{persist_dir}/{spider_name}_dedup.bloom"
    to_scrapy_settings(spider_name: str) -> dict[str, Any]
```

---

## PROFILE REGISTRY

```
file: scrapy_researchers/bloom_filter.py:218-295
lookup: get_bloom_profile(spider_name: str) -> BloomProfile
fallback: DEFAULT_BLOOM_PROFILE (100K capacity, 0.001 FP)
```

| spider_name | expected_urls | fp_rate | memory_bytes | num_hashes | request_dedup | item_dedup | download_delay | autothrottle_max | retry_times |
|---|---|---|---|---|---|---|---|---|---|
| `platform_spider` | 5000 | 0.0005 | 9937 | 11 | true | true | 3.0 | 120.0 | 7 |
| `docs_spider` | 10000 | 0.001 | 17972 | 10 | true | true | 2.0 | 60.0 | 5 |
| `anthropic_spider` | 50000 | 0.002 | 80860 | 9 | true | true | 2.0 | 60.0 | 5 |
| `claude_com_spider` | 5000 | 0.0005 | 9937 | 11 | true | true | 3.0 | 120.0 | 7 |
| `llms_full_spider` | 1000 | 0.001 | 1798 | 10 | **false** | true | 2.0 | 60.0 | 5 |
| `github_spider` | 10000 | 0.001 | 17972 | 10 | **false** | true | 0.0 | 0.0 | 5 |

### Profile selection logic

```
IF spider_name IN BLOOM_PROFILES:
    RETURN BLOOM_PROFILES[spider_name]
ELSE:
    RETURN DEFAULT_BLOOM_PROFILE

IF profile.request_dedup == False:
    to_scrapy_settings() emits DUPEFILTER_CLASS = "scrapy.dupefilters.RFPDupeFilter"
    → BloomDupeFilter is NOT instantiated for this spider
```

---

## INTEGRATION POINTS

### 1. Request-level dedup (BloomDupeFilter)

```
file: scrapy_researchers/bloom_dupefilter.py
scrapy hook: DUPEFILTER_CLASS (settings.py:35)
lifecycle: from_settings() → open() → request_seen() per request → close()
fingerprint: "{METHOD}:{canonicalize_url(url, keep_fragments=False)}"
persist: save on close(), load on open()
```

### 2. Item-level dedup (DedupPipeline)

```
file: scrapy_researchers/pipelines.py:107-179
scrapy hook: ITEM_PIPELINES at priority 100
lifecycle: open_spider() → process_item() per item → close_spider()
fingerprint: SHA256("{url}:{content_markdown[:500]}")
persist: save on close_spider(), load on open_spider()
```

### 3. Profile injection (BaseResearchSpider)

```
file: scrapy_researchers/spiders/base_spider.py:44-60
scrapy hook: update_settings() classmethod (called before __init__)
behavior: merges BloomProfile.to_scrapy_settings() into Scrapy Settings
priority: "spider" (overridden by custom_settings if explicitly set)
```

**Call sequence per spider run**:
```
1. Scrapy calls SpiderClass.update_settings(settings)
   → get_bloom_profile(cls.name)
   → profile.to_scrapy_settings(cls.name)
   → settings.set(key, value, priority="spider") for each bloom key
2. Scrapy instantiates BloomDupeFilter.from_settings(settings)
   → reads BLOOM_EXPECTED_URLS, BLOOM_FP_RATE, BLOOM_PERSIST_PATH
3. Scrapy instantiates DedupPipeline, calls open_spider()
   → reads BLOOM_DEDUP_EXPECTED_ITEMS, BLOOM_DEDUP_FP_RATE, BLOOM_DEDUP_PERSIST_PATH
4. Crawl runs. BloomDupeFilter.request_seen() gates requests.
   DedupPipeline.process_item() gates items.
5. Spider closes. Both save state to disk.
```

---

## ANTI-BLOCKING MEASURES (platform.claude.com)

Applied in `platform_spider.py`. Ordered by execution phase:

| Phase | Measure | File:Line | Mechanism |
|---|---|---|---|
| Entry | llms.txt start URL | platform_spider.py:38 | Bot-friendly endpoint, avoids HTML anti-bot |
| Scheduling | URL shuffle | platform_spider.py:74 | `random.shuffle(urls)` breaks sequential patterns |
| Scheduling | Priority tiers | platform_spider.py:78-80 | PRIORITY_FRESH=5 > PRIORITY_INTERNAL=0 |
| Request | Bloom dedup | bloom_dupefilter.py | Cross-run: never re-request served URLs |
| Request | Fragment strip | platform_spider.py:103 | `url.split("#")[0]` before yielding |
| Request | Per-page dedup | platform_spider.py:100-110 | `seen_on_page: set[str]` within callback |
| Download | Polite delay | middlewares.py:37-50 | 3.0s base + 1.0s jitter (from profile) |
| Download | AutoThrottle | settings.py:100-104 | Scales up to 120s (from profile) |
| Download | HTTP cache | settings.py:90-95 | RFC2616 304 Not Modified |
| Download | Retry backoff | middlewares.py:120-145 | Exponential: 2^n + uniform(0,1) |
| Item | Content dedup | pipelines.py:154-163 | Bloom filter on SHA256(url+content[:500]) |

---

## EVALUATION RESULTS

```
source: bloom_eval.py output (reproducible via eval_command above)
```

### Memory comparison (SHA256 set vs Bloom filter)

| n | set_bytes | bloom_bytes | ratio |
|---|---|---|---|
| 100 | 26931 | 180 | 149.6x |
| 1000 | 218010 | 1798 | 121.3x |
| 10000 | 2374554 | 17972 | 132.1x |
| 50000 | 11347174 | 89860 | 126.3x |
| 100000 | 22694426 | 179720 | 126.3x |

### False positive rate

| n | target_fp | actual_fp | test_n |
|---|---|---|---|
| 100 | 0.001 | 0.0000 | 100 |
| 1000 | 0.001 | 0.0030 | 10000 |
| 10000 | 0.001 | 0.0011 | 10000 |
| 50000 | 0.001 | 0.0014 | 10000 |
| 100000 | 0.001 | 0.0016 | 10000 |

### Invariants (verified by test suite)

```
INVARIANT: false_negatives == 0              # bloom filters guarantee this
INVARIANT: loaded.count == original.count     # persistence preserves count
INVARIANT: loaded.num_bits == original.num_bits
INVARIANT: loaded.num_hashes == original.num_hashes
INVARIANT: ∀ item ∈ inserted: item ∈ loaded  # no false negatives after roundtrip
INVARIANT: ∀ (s1, s2) ∈ BLOOM_PROFILES:
             s1.dupefilter_path(s1_name) ≠ s2.dupefilter_path(s2_name)  # no path collisions
```

---

## AGENT TOOL APPLICABILITY MATRIX

```
source: bloom_tool_analysis.py
method: A[14×4] @ w[4×1] = scores[14×1]
```

### Criteria (columns of A, all normalized [0,1])

| index | criterion | weight | derivation |
|---|---|---|---|
| 0 | token_savings | 0.40 | `(dup_rate × avg_tokens × calls) / max_savings` |
| 1 | fingerprint_quality | 0.20 | `fingerprint_feasibility` (direct) |
| 2 | low_rework | 0.25 | `1.0 - rework_effort` |
| 3 | call_frequency | 0.15 | `log(calls + 1) / log(max_calls + 1)` |

### Scored tools (descending)

| tool | score | tokens_saved_per_session | dup_rate | fingerprint_feasibility | rework_effort | category |
|---|---|---|---|---|---|---|
| Read | 0.965 | 18000 | 0.40 | 0.95 | 0.10 | builtin |
| Grep | 0.582 | 2000 | 0.25 | 0.90 | 0.10 | builtin |
| GitHub (read) | 0.580 | 3600 | 0.30 | 0.95 | 0.10 | mcp |
| Context7 (query-docs) | 0.558 | 3375 | 0.45 | 0.90 | 0.10 | mcp |
| Glob | 0.556 | 900 | 0.30 | 0.95 | 0.10 | builtin |
| GitHub (list/search) | 0.553 | 3360 | 0.35 | 0.85 | 0.15 | mcp |
| WebFetch | 0.548 | 2800 | 0.35 | 0.95 | 0.10 | builtin |
| ToolSearch | 0.533 | 1600 | 0.50 | 0.95 | 0.05 | builtin |
| Linear (list/search) | 0.505 | 2000 | 0.40 | 0.85 | 0.15 | mcp |
| Slack (read) | 0.467 | 1080 | 0.30 | 0.85 | 0.15 | mcp |
| Supabase (execute_sql) | 0.448 | 720 | 0.20 | 0.80 | 0.25 | mcp |
| WebSearch | 0.421 | 800 | 0.25 | 0.60 | 0.15 | builtin |
| Agent (Explore) | 0.420 | 3000 | 0.20 | 0.50 | 0.30 | agent |
| Bash | 0.405 | 450 | 0.15 | 0.70 | 0.40 | builtin |

### Aggregate projections

```
total_tokens_per_session:     129700
theoretical_max_savings:       43685  (33.7%)
feasible_savings:              39435  (30.4%)  # fingerprint >= 0.70 AND rework <= 0.35
```

### Tool dedup decision tree

```
FOR each tool_call in agent_loop:
    IF tool.name IN {Write, Edit, NotebookEdit}:
        SKIP  # write operations, never dedup
    IF tool.name IN {slack_send_message, gmail_create_draft, save_issue, save_comment}:
        SKIP  # side-effectful sends, never dedup
    IF tool.name == "Bash":
        SKIP  # side effects make cached results dangerous
    IF tool.name == "Agent":
        SKIP  # prompts too fuzzy to fingerprint (feasibility=0.50)

    fingerprint = compute_fingerprint(tool.name, tool.input_params)
    IF fingerprint IN bloom_filter:
        RETURN cached_result[fingerprint]  # skip API call
    ELSE:
        result = execute_tool(tool_call)
        bloom_filter.add(fingerprint)
        cached_result[fingerprint] = result
        RETURN result
```

### Fingerprint schemes per tool

| tool | fingerprint_input | notes |
|---|---|---|
| Read | `f"{file_path}:{offset}:{limit}"` | exact match |
| Glob | `f"{pattern}:{path}"` | exact match |
| Grep | `f"{pattern}:{path}:{type}:{glob}"` | exact match |
| ToolSearch | `f"{query}"` | exact match, schemas are static |
| WebFetch | `f"{url}"` | URL is canonical identifier |
| GitHub (read) | `f"{owner}/{repo}/{resource_type}/{id}"` | e.g. `jadecli/researchers/pull/5` |
| GitHub (list) | `f"{owner}/{repo}/{endpoint}:{sorted(params)}"` | query params sorted for stability |
| Context7 (query-docs) | `f"{library_id}:{query}"` | library resolved first |
| Linear (list) | `f"{endpoint}:{sorted(filter_params)}"` | same pattern as GitHub |
| Slack (read) | `f"{channel_id}:{thread_ts}"` | thread_ts=None for channel reads |
| WebSearch | `f"{normalized_query}"` | lowercase, strip whitespace; low feasibility |

---

## CONSTRAINTS AND INVARIANTS

### Must hold

```
1. BloomFilter guarantees zero false negatives.
2. Persisted state must roundtrip without data loss.
3. Each spider's .bloom files must be path-isolated (no filename collisions).
4. request_dedup=False spiders must NOT instantiate BloomDupeFilter.
5. Write/Edit/send tools must NEVER be bloom-deduped.
6. Bash tool must NEVER return cached results (side effects).
```

### Known limitations

```
1. Bloom filters cannot detect content changes. Use DeltaFetch + HTTP 304 for that.
2. BLOOM_PROFILES is static. No runtime resizing if capacity is exceeded.
   Symptom: estimated_fp_rate rises above target.
   Mitigation: profiles are conservatively sized at ~10x expected URL count.
3. Bloom filter FP rate at small n (< 1000) has high variance.
   Mitigation: use DeltaFetch as primary dedup; bloom is supplementary.
4. Agent (Explore) tool has fingerprint_feasibility=0.50 — prompts are
   too variable for reliable dedup. Do not attempt without prompt normalization.
```

---

## MODIFICATION GUIDE

### Adding a new spider

```
1. Define BloomProfile in bloom_filter.py BLOOM_PROFILES dict
2. Spider must inherit from BaseResearchSpider
3. update_settings() auto-injects profile — no manual wiring needed
4. Add spider_name to test_all_spiders_have_profiles test
5. Run: PYTHONPATH=. python3 -m pytest tests/test_bloom_filter.py -v
```

### Changing a spider's bloom parameters

```
1. Edit the spider's entry in BLOOM_PROFILES (bloom_filter.py:218+)
2. Delete the old .bloomstate/{spider_name}_*.bloom files
   (parameter change makes old state incompatible)
3. Run eval to verify: PYTHONPATH=. python3 -m scrapy_researchers.bloom_eval
```

### Resetting bloom state for a spider

```bash
rm scrapy_researchers/.bloomstate/{spider_name}_dupefilter.bloom
rm scrapy_researchers/.bloomstate/{spider_name}_dedup.bloom
# next crawl run creates fresh filters
```

### Adding bloom dedup to the agent tool loop

```
target: claude-multi-agent-sdk/src/agent/loop.ts:150
pattern: check bloom before Promise.all(), cache result after
estimated LOC: ~20 lines
prerequisite: port BloomFilter to TypeScript or use a JS bloom filter library
fingerprint: tool.name + JSON.stringify(sorted_input_params)
cache: Map<string, ToolResult> alongside the BloomFilter
```

---

## CROSS-REFERENCES

| document | relationship |
|---|---|
| `BLOOM_TOOLS_ARCHITECTURE.md` | Human-readable narrative version of this document |
| `ARCHITECTURE.md` | Root orchestration trace (references crawl rounds, test counts) |
| `claude-code/.claude/CLAUDE.md` | Spider configuration, crawl commands, round results |
| `claude-multi-agent-sdk/src/agent/loop.ts` | Agent tool execution loop (bloom integration target) |
| `claude-multi-agent-sdk/src/context/manager.ts` | Progressive tool disclosure (complementary optimization) |
| `claude-multi-agent-dispatch/src/quality/feedback.ts:187` | Existing Set-based dedup (bloom could replace) |
