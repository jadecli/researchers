# AI Video Generation Competitors - llms.txt Crawl Results

> Crawled: 2026-03-28 (Round 2 - enriched via WebSearch deep crawl)
> Task: Crawl llms.txt and llms-full.txt for Higgsfield AI competitors in AI video generation
> Note: WebFetch blocked in environment; all content extracted via WebSearch indexed results

---

## Summary Table

| # | Provider | llms.txt | llms-full.txt | Status |
|---|----------|----------|---------------|--------|
| 1 | Higgsfield AI | `https://docs.higgsfield.ai/llms.txt` | `https://docs.higgsfield.ai/llms-full.txt` (likely, Mintlify-hosted) | FOUND |
| 2 | Kling (Kuaishou) | Not on klingai.com; Replicate per-model llms.txt available | Not found | PARTIAL (Replicate) |
| 3 | Google Veo / Gemini API | `https://ai.google.dev/gemini-api/docs/llms.txt` | No single llms-full.txt; individual `.md.txt` pages | FOUND |
| 4 | Google Gemini API Reference | `https://ai.google.dev/api/llms.txt` | Individual `.md.txt` pages | FOUND |
| 5 | Seedance / ByteDance | Not on capcut.com; Replicate per-model llms.txt available | Not found | PARTIAL (Replicate) |
| 6 | Runway | Not on runwayml.com; Replicate `runwayml/gen4-image/llms.txt` | Not found | PARTIAL (Replicate) |
| 7 | Luma AI | `https://lumalabs.ai/llm-info` (custom LLM info page, not standard llms.txt) | Not found | PARTIAL |
| 8 | Pika | Not found | Not found | NOT FOUND |
| 9 | Minimax / Hailuo | Not on minimaxi.com; Replicate per-model available | Not found | PARTIAL (Replicate) |
| 10 | Vidu (Shengshu) | Not found | Not found | NOT FOUND |
| 11 | Wan Video (Alibaba) | Not on wan.video; Replicate per-model available | Not found | PARTIAL (Replicate) |
| 12 | OpenAI (Sora) | `https://developers.openai.com/api/docs/llms.txt` | `https://developers.openai.com/api/docs/llms-full.txt` | FOUND |
| 13 | OpenAI Codex | `https://developers.openai.com/codex/llms.txt` | `https://developers.openai.com/codex/llms-full.txt` | FOUND |
| 14 | OpenAI Platform | `https://platform.openai.com/docs/llms.txt` | `https://platform.openai.com/docs/llms-full.txt` | FOUND |
| 15 | HeyGen | `https://docs.heygen.com/llms.txt` | `https://docs.heygen.com/llms-full.txt` (likely) | FOUND |
| 16 | Synthesia | Not found | Not found | NOT FOUND |
| 17 | Captions AI | Not found | Not found | NOT FOUND |
| 18 | D-ID | Not found | Not found | NOT FOUND |
| 19 | Midjourney | Not found | Not found | NOT FOUND |
| 20 | Lightricks / LTX | Not found | Not found | NOT FOUND |

---

## 1. Higgsfield AI

### llms.txt: `https://docs.higgsfield.ai/llms.txt`

**Higgsfield API Docs** - Index of documentation pages:

- [Generate Images from Text](https://docs.higgsfield.ai/guides/images.md) - Learn how to create stunning images using text prompts
- [Generate Videos from Images](https://docs.higgsfield.ai/guides/video.md) - Learn how to transform static images into dynamic videos
- [FAQ](https://docs.higgsfield.ai/help/faq.md) - Frequently asked questions
- [Support](https://docs.higgsfield.ai/help/support.md) - Get help with Higgsfield API
- [How to use API](https://docs.higgsfield.ai/how-to/introduction.md) - Complete guide to using the Higgsfield API
- [Client Libraries](https://docs.higgsfield.ai/how-to/sdk.md) - Official SDKs and client libraries
- [Webhook Integration](https://docs.higgsfield.ai/how-to/webhooks.md) - Guide to using webhooks
- [Introduction to Higgsfield](https://docs.higgsfield.ai/index.md)

### llms-full.txt: `https://docs.higgsfield.ai/llms-full.txt`

Hosted on Mintlify, which auto-generates llms-full.txt. Contains the full documentation content in a single markdown file.

**Key details from documentation:**
- Higgsfield API empowers developers to integrate advanced generative AI models into applications
- Unifies access to tools for creating images, videos, voices, and audio from text or static images
- Python SDK available (supports sync and async usage)
- Credentials obtained from Higgsfield Cloud (cloud.higgsfield.ai)
- GitHub: https://github.com/higgsfield-ai/higgsfield-client

---

## 2. Kling AI (Kuaishou)

### Status: PARTIAL (via Replicate)

No llms.txt on klingai.com or app.klingai.com. However, Replicate hosts per-model llms.txt files:

**Replicate llms.txt files:**
- `https://replicate.com/kwaivgi/kling-v3-video/llms.txt` - Kling Video 3.0
- `https://replicate.com/kwaivgi/kling-lip-sync/llms.txt` - Kling Lip Sync

**Kling Video 3.0 (from Replicate):**
- Generates cinematic video from text or images at up to 1080p
- Duration: 3-15 seconds (up from 10s limit in earlier versions)
- Native audio generation: dialogue with lip sync, sound effects, ambient sound in one pass
- Modes: text-to-video, image-to-video
- Data sent from Replicate to Kuaishou

**Kling Lip Sync (llms.txt content):**
- Inputs: `voice_id` (string), `text` (string), `video_id` (string), `video_url` (string, .mp4/.mov, <100MB, 2-10s, 720-1080p), `audio_file` (string, .mp3/.wav/.m4a/.aac, <5MB), `voice_speed` (number)
- Output: URI string pointing to generated lip-synced video
- Example voice_id: `en_AOT`

**Other Kling versions on Replicate:** v2.6, v2.1 Master, v2.1, v2.0, v1.6 Pro/Standard, v1.5 Pro/Standard

**Official API docs:** `https://app.klingai.com/global/dev/document-api/quickStart/userManual`

---

## 3. Google Veo / Gemini API

### llms.txt (Gemini API Docs): `https://ai.google.dev/gemini-api/docs/llms.txt`

**Gemini Developer API Docs and API Reference** - Index linking to `.md.txt` formatted pages:

Key documentation sections include:
- Google AI Studio Quickstart (`ai-studio-quickstart.md.txt`)
- Audio Understanding (`audio.md.txt`)
- Available Regions (`available-regions.md.txt`)
- Billing (`billing.md.txt`)
- Context Caching (`caching.md.txt`)
- Embeddings (`embeddings.md.txt`)
- Ephemeral Tokens (`ephemeral-tokens.md.txt`)
- Grounding with Google Search (`grounding.md.txt`)
- Image Generation / Nano Banana (`image-generation.md.txt`)
- Image Understanding (`image-understanding.md.txt`)
- Imagen (`imagen.md.txt`)
- LangGraph + Gemini 2.5 (`langgraph-example.md.txt`)
- LearnLM (`learnlm.md.txt`)
- Live API Guide (`live-guide.md.txt`)
- Gemini Models (`models.md.txt`)
- **Video generation with Veo** (`video.md.txt`)

Base URL pattern: `https://ai.google.dev/gemini-api/docs/<page>.md.txt`

### llms.txt (API Reference): `https://ai.google.dev/api/llms.txt`

Index of API reference documentation covering:
- Models, PaLM (decommissioned), Chunks, Corpora, Documents
- Question Answering, Tuning, Counting Tokens, Embeddings
- Live API WebSockets reference
- Batch API, Caching, Files, Content Generation

### Veo-specific documentation:
- **Veo model page:** https://deepmind.google/models/veo/
- **Veo 3.1 via Gemini API:** https://ai.google.dev/gemini-api/docs/video
  - Generates 8-second 720p/1080p/4K videos with natively generated audio
  - Supports portrait videos, video extension, frame-specific generation
  - Up to 3 reference images for image-based direction
- **Veo prompt guide:** https://deepmind.google/models/veo/prompt-guide/

### llms-full.txt: No single combined file

Google provides individual `.md.txt` pages rather than a single llms-full.txt file.

---

## 4. Seedance / ByteDance

### Status: PARTIAL (via Replicate)

No llms.txt on capcut.com or dreamina.capcut.com. Note: seedance.ai is NOT affiliated with ByteDance.

**Replicate models (bytedance namespace):**
- `https://replicate.com/bytedance/seedance-1.5-pro` — Cinema-quality video with synchronized audio, precise lip-syncing, multilingual support
- `https://replicate.com/bytedance/seedance-1-pro` — T2V and I2V, 5s/10s, 480p/1080p
- `https://replicate.com/bytedance/seedance-1-pro-fast` — 30-60% faster inference, lower compute cost
- `https://replicate.com/bytedance/seedance-1-lite` — 5s/10s from text or images, 480p/720p

**Seedance 1.5 Pro details:**
- Dual-branch architecture generates audio and video simultaneously
- Multi-language support with accurate lip-sync: English, Mandarin, Japanese, Korean, Spanish, Portuguese, Indonesian, Cantonese, Sichuanese

**ByteDance's official platform:** `https://dreamina.capcut.com`

Seedance versions (official):
- Seedance 1.0 mini - Entry model
- Seedance 1.0 - Next-gen model, leading T2V and I2V benchmarks
- Seedance 1.5 Pro (Video 3.5 Pro) - Native multi-shot storytelling, bilingual dialogue, 1080p
- Seedance 2.0 - Multi-scene videos with smooth transitions, synced audio, character consistency

---

## 5. Runway

### Status: PARTIAL (via Replicate)

No llms.txt on runwayml.com or docs.dev.runwayml.com. Replicate hosts Gen-4 Image model llms.txt.

**Replicate llms.txt:** `https://replicate.com/runwayml/gen4-image/llms.txt`

**Gen-4 Image (from Replicate llms.txt):**
- Description: "Runway's Gen-4 Image model with references"
- Inputs:
  - `prompt` (required, string) - Text prompt for image generation
  - `seed` (optional, integer) - Random seed for reproducibility
  - `aspect_ratio` (optional, string) - Image aspect ratio
  - `resolution` (optional, string) - Image resolution
  - `reference_images` (optional, array, up to 3) - Images between 0.5-2 aspect ratio
  - `reference_tags` (optional, array) - Alphanumeric tags, 3-15 chars, referenced via `@tag_name`
- Output: URI string to generated image
- Features: Character preservation, location consistency, multi-reference support, conversational prompting
- Turbo variant: `runwayml/gen4-image-turbo` — 2.5x faster, cheaper

**Official API documentation:**
- Main docs: https://docs.dev.runwayml.com/
- API Reference: https://docs.dev.runwayml.com/api/
- Getting Started: https://docs.dev.runwayml.com/guides/using-the-api/
- Models: https://docs.dev.runwayml.com/guides/models/
- Individual pages as `.md` (e.g., `docs.dev.runwayml.com/guides/setup.md`)
- Docs include "Open in Cursor / ChatGPT / Claude" options
- Runway Characters: real-time video agent API for custom conversational characters

---

## 6. Luma AI

### LLM Info Page: `https://lumalabs.ai/llm-info`

Custom LLM-oriented info page (not standard llms.txt format) containing structured information for AI assistants:

**Company:**
- Generative AI company focused on video and image generation at cinematic quality
- Combines large-scale multimodal models with production-friendly tools
- Raised $900M Series-C, partnering with Humain for 2GW compute supercluster (Project Halo)

**Products:**
- **Dream Machine** - Flagship AI creative platform for generating videos and transforming media
- **Video models:** Ray3.14, Ray3, Ray2, Ray2 Flash
- **Image models:** Photon, Photon Flash
- **UNI-1** - Unified understanding and generation model

**API:**
- Programmatic interface for video and image generation
- Supports automated workflows, third-party integrations

**Pricing (Dream Machine subscriptions):**

| Plan | Price | Credits | Features |
|------|-------|---------|----------|
| Free | $0 | Limited | Ray3.14 draft only, 720p images, watermarks, personal use |
| Lite | $9.99/mo | 3,200 | Priority processing, 1080p images, watermarks, non-commercial |
| Plus | $29.99/mo | 10,000 | No watermarks, full commercial rights |
| Unlimited | $94.99/mo | 10,000 fast + unlimited relaxed | Full access |

**Credit costs (Ray3.14):** Draft 5s = 20 credits, 540p 5s = 50, 720p 5s = 100, 1080p 5s = 400
**API credits (Ray3.14):** Draft = 4, 540p = 10, 720p = 20, 1080p = 80
**Photon (images):** $0.015/image (1080p), $0.002 with Photon Flash

**Also available on platform:** Ray3, Ray3.14, Kling 2.6, Sora 2, Veo3, Veo3.1

---

## 7. Pika

### Status: NOT FOUND

No llms.txt found on pika.art or related domains.

---

## 8. Minimax / Hailuo

### Status: PARTIAL (via Replicate)

No llms.txt on minimaxi.com or hailuoai.video. Replicate hosts per-model pages.

**Replicate models (minimax namespace):**
- `https://replicate.com/minimax/hailuo-2.3` — Hailuo 2.3 standard
- `https://replicate.com/minimax/hailuo-2.3-fast` — Hailuo 2.3 fast variant (2-2.5x faster)
- `https://replicate.com/minimax/hailuo-02` — Hailuo 02
- `https://replicate.com/minimax/hailuo-02-fast` — Hailuo 02 fast
- `https://replicate.com/minimax/video-01` — Video-01 (original)
- `https://replicate.com/minimax/video-01-live` — Hailuo Live (I2V animation)

**Hailuo 2.3 details (from Replicate):**
- High-fidelity video generation for realistic human motion, cinematic VFX, expressive characters
- Supports T2V and I2V workflows (Fast model: I2V only)
- Resolution: 768p (6s or 10s) or 1080p (6s only). 24fps.
- Latency: 30-90s for 6s 768p, 2-3min for 1080p/10s
- Styles: realistic, anime, illustration, ink-wash painting, game-CG
- Built on NCR framework: 2.5x training/inference efficiency improvement
- Camera control via prompt directives (pans, tilts, zooms, tracking shots)

**Hailuo 02 details:**
- Max 1080p, 10 seconds
- NCR (Noise-aware Compute Redistribution) architecture

**Official platforms:**
- MiniMax API: https://platform.minimaxi.com/ (Chinese), https://intl.minimaxi.com/ (English)
- Full model suite: text (M2.7), speech (2.6), video (Hailuo 2.3), music (2.5+)
- OpenAI SDK compatible

---

## 9. Vidu (Shengshu Technology)

### Status: NOT FOUND

No llms.txt found on vidu.com or vidu.studio.

**API platform:** https://platform.vidu.com/

---

## 10. Wan Video (Alibaba)

### Status: PARTIAL (via Replicate)

No llms.txt on wan.video. Replicate hosts extensive Wan model collection.

**Replicate models (wan-video namespace):** `https://replicate.com/wan-video`
- `wan-video/wan2.6-i2v-flash` — Wan 2.6 I2V Flash, up to 15s with optional audio
- `wan-video/wan-2.6-i2v` — Wan 2.6 I2V, 1080p, lip-sync capable
- `wan-video/wan-2.5-i2v-fast` — Wan 2.5 I2V Fast, up to 1080p + background audio/lip-sync
- `wan-video/wan-2.5-t2v-fast` — Wan 2.5 T2V Fast
- `wan-video/wan-2.1-1.3b` — Wan 2.1 1.3B (consumer GPU compatible)
- Most popular model: 9.2M runs

**Wan 2.6 details (from Replicate):**
- Native audio-visual synchronization (sound effects + ambient atmosphere synced to visual motion)
- Lip-sync from text, audio, images, or reference clips at 1080p
- Up to 15 seconds per clip
- Preserves source image style (lighting, composition, aesthetic)

**Wan 2.5 details:**
- Supports T2V, I2V, and audio-synced generation
- Up to 1080p output with background audio or lip-sync
- Fast variants among quickest T2V options on Replicate

**Wan 2.2:** Newest and most capable open-source model. 480p/720p support. 5s at 480p = 39s generation, 5s at 720p = 150s.

**Open source:**
- GitHub: https://github.com/wan-video/wan2.1
- Apache 2.0 license
- T2V-1.3B model: only 8.19 GB VRAM, compatible with consumer GPUs
- 14B model benefits from multi-GPU setups
- Integrated into Diffusers and ComfyUI
- WavespeedAI optimizations for fastest generations

---

## 11. OpenAI (Sora - now discontinued)

### llms.txt (API Docs): `https://developers.openai.com/api/docs/llms.txt`

Guides and conceptual documentation for building with the OpenAI API. Each entry has a Markdown twin at `/api/docs/<name>.md`.

**Documentation sections:**
- **Actions:** Data retrieval with GPT Actions, getting started, authentication, GPT Actions library, production notes
- **Assistants:** API deep dive, tools (file search, code interpreter, function calling), migration guide
- **Guides:** Actions in ChatKit, advanced integrations, model selection, libraries
- **MCP and Connectors:** Remote MCP servers, OpenAI-maintained connectors
- **Pricing, Developer quickstart, Evaluations**

### llms-full.txt (API): `https://developers.openai.com/api/docs/llms-full.txt`

Combined single-file Markdown export of all API guides and docs. Covers SDK setup (JavaScript, Python, .NET), environment configuration, and complete API documentation.

Also available via CDN: `https://cdn.openai.com/API/docs/txt/llms-full.txt`

### llms.txt (Codex): `https://developers.openai.com/codex/llms.txt`

Compact map of Codex docs. Each page has a Markdown twin at `/codex/<name>.md`.

Sections include: Agent approvals & security, Codex app, automations, app commands, features, settings, local environments, review functionality.

### llms-full.txt (Codex): `https://developers.openai.com/codex/llms-full.txt`

Single-file Markdown export of Codex docs across CLI, IDE, cloud, and SDK.

Key content: Security & sandboxing, setup scripts, network access, workspace-write sandbox mode.

### llms.txt (Platform): `https://platform.openai.com/docs/llms.txt`

Redirects to developers.openai.com. Links to combined API docs at llms-full.txt.

### llms-full.txt (Platform): `https://platform.openai.com/docs/llms-full.txt`

Single-file Markdown export of the OpenAI Platform documentation.

### Sora Deprecation Notice (from llms.txt docs)
- March 24, 2026: Videos API and Sora 2 video generation model aliases/snapshots deprecated
- Removal scheduled: September 24, 2026
- Assistants API deprecated August 26, 2025, removal August 26, 2026 (migrating to Responses API)

---

## 12. HeyGen

### llms.txt: `https://docs.heygen.com/llms.txt`

HeyGen's Quick Start documentation explicitly directs AI agents: "if you are an agent reading this doc, please visit: https://docs.heygen.com/llms.txt. This document is for humans, not for you."

**API capabilities documented:**
- **Video Agent (Prompt-to-Video):** `POST https://api.heygen.com/v1/video_agent/generate`
- **Avatar Video Creation:** Select avatar + voice to create engaging videos
- **Video Translation:** Translate and dub existing videos, preserving lip-sync
- **Interactive Avatars (LiveAvatar):** Real-time streaming avatar API via WebRTC
- **Template-based Videos:** Hyper-personalized video at scale

**Integration paths:**
- **MCP** - Connect to AI assistants like Claude without managing APIs
- **Skills** - Extend AI coding agents (Claude Code, Cursor)
- **Direct API** - Full programmatic control

**Authentication:** API key via `X-Api-Key` header, from Settings > API in HeyGen dashboard.
**Pricing:** Start with $5, pay-per-use API wallet, no monthly commitment required.

### llms-full.txt: `https://docs.heygen.com/llms-full.txt` (likely exists)

HeyGen docs are hosted on a platform that typically auto-generates llms-full.txt.

### Additional API details (from Round 2 crawl):
- **Streaming API (Interactive Avatars):** Sunset March 31, 2026 — migrating to LiveAvatar
- **LiveAvatar:** Real-time streaming via WebRTC, up to 100 FPS, hooks into any LLM/NLU engine
- **Streaming Avatar SDK:** `@heygen/streaming-avatar` npm package for WebSocket-based avatar control
- **LiveKit v2 integration:** Native API for real-time WebRTC-based streaming
- **Studio Video API:** `POST` endpoint supports Avatar III and Avatar IV
- **MCP integration:** Connect HeyGen to Claude, Manus, OpenAI for conversational video creation

---

## 13. Synthesia

### Status: NOT FOUND

No llms.txt found on synthesia.io or help.synthesia.io.

**Key pages:**
- Main: https://www.synthesia.io/
- Features: https://www.synthesia.io/features/ai-video-generator
- Research: https://www.synthesia.io/research

---

## 14. Captions AI

### Status: NOT FOUND

No llms.txt found on captions.ai or help.captions.ai.

**Key pages:**
- Main: https://captions.ai/
- API (Mirage Studio): https://www.captions.ai/api
- Help: https://help.captions.ai/
- API Reference: https://captions.ai/help/api-reference/api
- Mirage Research: https://www.captions.ai/mirage

**Mirage API (early access beta):**
- Flexible inputs: script, image reference, or actor ID
- High-fidelity output: natural eye contact, gestures, emotional expression
- Realistic AI-generated speaking voices
- Credits-based billing, SDKs, sandbox/playground, detailed docs
- Full commercial rights to generated content, no licensing restrictions on AI actors
- Use cases: ad creative, hook testing, L&D, marketing, ecommerce

---

## 15. D-ID

### Status: NOT FOUND

No llms.txt found on d-id.com or docs.d-id.com.

**API documentation available at:**
- Main docs: https://docs.d-id.com/
- Getting started: https://docs.d-id.com/reference/get-started
- Quickstart: https://docs.d-id.com/docs/quickstart
- Agents SDK: https://docs.d-id.com/reference/agents-sdk-overview
- Agents Overview: https://docs.d-id.com/reference/agents-overview

**Key capabilities:**
- Interactive AI agents: combine digital avatars with LLMs + custom knowledge bases via WebRTC
- Visual Agents: LLM + TTS + STT + avatar animation + RAG
- Real-time streaming: up to 100 FPS video
- Talks/Clips Streams (legacy) — migrating to Agents SDK/Agents Streams
- Turn still photos into realistic videos of digital presenters speaking
- Microsoft partnership for AI-powered avatars

---

## 16. Midjourney

### Status: NOT FOUND

No llms.txt found on midjourney.com or docs.midjourney.com.

**Note:** Midjourney explicitly prohibits API access and third-party automation in their ToS. No public developer API exists. Documentation is user-facing only at docs.midjourney.com (Zendesk-hosted).

---

## 17. Lightricks / LTX

### Status: NOT FOUND

No llms.txt found on lightricks.com.

**API docs:** https://www.lightricks.com/ltxv-documentation

---

## Replicate as Aggregated llms.txt Source

Replicate (replicate.com) provides per-model llms.txt files for many AI video models, even when the original providers don't host their own. These follow a standard format with model description, inputs schema, outputs schema, and example usage.

**URL pattern:** `https://replicate.com/<namespace>/<model>/llms.txt`

**Available namespaces for video competitors:**
- `kwaivgi/` — Kling models (v3-video, v2.6, v2.1, lip-sync, etc.)
- `bytedance/` — Seedance models (1.5-pro, 1-pro, 1-pro-fast, 1-lite)
- `runwayml/` — Gen-4 Image (gen4-image, gen4-image-turbo)
- `minimax/` — Hailuo models (2.3, 02, video-01, video-01-live)
- `wan-video/` — Wan models (2.6-i2v-flash, 2.5-i2v-fast, 2.5-t2v-fast, 2.1-1.3b)

---

## Key Findings

### Providers WITH native llms.txt (5 of 18):
1. **Higgsfield AI** - Full llms.txt + likely llms-full.txt (Mintlify-hosted)
2. **Google (Gemini/Veo)** - Two llms.txt indexes (docs + API ref), individual .md.txt pages
3. **OpenAI** - Most comprehensive: 3 llms.txt + 3 llms-full.txt (API, Codex, Platform)
4. **HeyGen** - llms.txt with explicit agent detection/redirect
5. **Luma AI** - Custom /llm-info page (non-standard but functionally equivalent)

### Providers with llms.txt VIA REPLICATE (5 of 18):
6. **Kling** - Per-model llms.txt on Replicate (kwaivgi namespace)
7. **Seedance/ByteDance** - Per-model llms.txt on Replicate (bytedance namespace)
8. **Runway** - Gen-4 Image llms.txt on Replicate (runwayml namespace)
9. **Minimax/Hailuo** - Per-model on Replicate (minimax namespace)
10. **Wan Video** - Per-model on Replicate (wan-video namespace)

### Providers WITHOUT any llms.txt (8 of 18):
Pika, Vidu, Synthesia, Captions AI, D-ID, Midjourney, Lightricks/LTX

### Observations:
- Only 28% of AI video providers have native llms.txt (5 of 18)
- Replicate serves as a de facto llms.txt aggregator, adding 5 more providers (56% total coverage)
- Companies with native llms.txt are platform/API-first (OpenAI, Google, HeyGen, Higgsfield)
- Chinese-origin tools (Kling, Seedance, Hailuo, Wan) lack native llms.txt but have Replicate coverage
- Consumer-focused tools (Pika, Midjourney) and avatar-only tools (Synthesia, D-ID) have zero coverage
- Midjourney explicitly prohibits API access, making llms.txt unlikely
- HeyGen is the only avatar platform with native llms.txt
- OpenAI's Sora 2 deprecated March 24, 2026 (removal Sept 2026) — llms.txt docs are for API/Codex, not video
