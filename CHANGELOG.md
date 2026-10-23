# Changelog

All notable changes to CapsuleOS are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **External email parser & dual preview modes** (`engine/emailParser.ts`): allows dropping raw `.eml` emails from Gmail, Outlook, Apple Mail, Thunderbird or newsletters directly into the vault folder.
  - Recursively resolves MIME multiparts (`multipart/mixed`, `multipart/related`, `multipart/alternative`) and single-part emails.
  - Decodes Quoted-Printable (RFC 2045) and encoded-word headers (RFC 2047 `B` & `Q` encodings with adjacent whitespace collapsing per Sec 6.2).
  - Handles `Content-Transfer-Encoding: base64` for HTML/text bodies.
  - Robust boundary parameter extraction and regex escaping.
  - Full HTML entity decoding (`&copy;`, `&reg;`, `&trade;`, `&mdash;`, etc.) and automatic stripping of invisible preheader padding hacks (`&#847;`, `\u034F`, `\u200B`, `&zwnj;`).
  - Converts email HTML into clean CapsuleOS note blocks (headings clamped to 1..3, tasks list, callout quotes, paragraphs) without duplicate content from layout `div`s.
  - Resolves inline `cid:` images to Data URIs and preserves raw Base64 for binary attachments.
  - **Dual preview modes** in `AutonomousHtmlPreview.tsx`: segmented toggle between **«Original Email»** (authentic email styling, white background, CID images, sandboxed) and **«Capsule Dashboard»** (dark theme block note view), plus contextual `.html` download.
  - 24 parser tests in `emailParser.test.ts`; the suite is now **151 tests / 11 files**.
- **Live vault folder watcher** (PR #6): desktop builds watch the `.eml` folder with a debounce and a write-loop guard, so files edited outside CapsuleOS appear without a restart.
- **Hierarchical pages (wiki tree)**: pages can be nested without touching mail threading — `parentId` is persisted in a `X-Capsule-Page-Parent` MIME header. The sidebar is now a collapsible page tree (search stays a flat BM25 relevance list), the editor shows a clickable breadcrumb, a parent picker, and a "Subpage" action. Reparenting is cycle-safe (a page cannot become its own descendant), dangling parents are promoted to roots, and deleting a page never cascades — its children become roots. The graph draws hierarchy as amber `Sub-page` edges. 8 hierarchy tests + MIME round-trip coverage.
- **Cross-project task filters**: one filter bar drives Agenda, Kanban, Gantt and the dependency editor — free-text search (task text, capsule subject, list title, tags), status (`all / open / todo / doing / done`), priority, due bucket (`overdue / today / next 7 days / no date`), capsule and tag. The shown/total counter and stats reflect the filtered set, calendar dots and ICS export follow the visible rows, and a new task is never silently hidden by a stale filter (the filters clear after quick-add). Pure `filterTasks` engine + 5 tests.

### Fixed
- Imported email text keeps inline formatting tight (`<strong>AI for Everyone</strong>.` → `AI for Everyone.` instead of `Everyone .`), astral-plane numeric entities (`&#128512;`) decode to one code point, and quoted blocks no longer ship a hardcoded Russian "Цитата" title — the editor shows an empty title, the exported dashboard falls back to "Quote".

### Changed
- **Zero demo content in block defaults.** Inserting a DataGrid no longer plants a `North/South/East` sample CSV or a Russian chart title: the block is created with an empty attachment and shows an explicit empty state with a real CSV file picker. A whiteboard starts with an empty scene instead of pre-placed "Cognitive Node A" shapes. New capsules and replies start with a single empty paragraph — no "Новая мысль" heading, no instructional filler, no auto-tags. Removed the unused `createChildReply()` path that injected canned Russian "AI" criticism. Known gaps are now tracked in [LIMITATIONS.md](LIMITATIONS.md).

## [1.4.0] — 2026-10-22

### Added
- **Planning layer** (`engine/planning.ts`): aggregates every TODO block across the vault into one task list, with local `YYYY-MM-DD` day keys (DST-safe), month grid, overdue / today / week buckets, priority sorting/filtering, and RFC 5545 **VTODO** ICS export. New **Planning** tab + 21 engine tests.
- **Kanban board** in the Planning view: fixed To do / In progress / Done columns, drag-and-drop between columns, per-card status selector, and status kept in sync with the checkbox. ICS export now maps `doing` → `IN-PROCESS`, `done` → `COMPLETED`.
- **Gantt timeline** in the Planning view: day-scale chart with week labels, today marker, bars from `start` to `due`, amber styling + lock icon for tasks whose prerequisites are unfinished, and SVG dependency arrows. The editor below the chart sets start/due dates and a "depends on" prerequisite; candidate lists are filtered by `wouldCreateCycle`, so a dependency cycle cannot be created. Task identity is stable across the vault (`blockId:itemId`), and dependencies are stored as `blockedBy: string[]` inside the TODO item.
- **`/task`**: typing `/task` inside a paragraph turns that paragraph into a trackable todo block (one task per line); selecting it with no text inserts an empty task. The slash menu is now fully RU/EN localized.
- **Command palette** (`Ctrl/Cmd+K`): every action searchable and ranked (acronym + fuzzy scoring), plus capsule navigation — 12 tests.
- **Undo/redo** for capsule edits (`engine/history.ts`): coalesced typing bursts, per-capsule stacks, palette + keyboard shortcuts.
- **RU / EN localization**: dependency-free i18n store, typed dictionaries, persistent locale toggle (`localStorage`), Russian source dictionary, English translation (some block-level labels still pending).
- **Task properties in TODO blocks**: due date and priority rendered/edited inline, feeding the planning layer.
- **Graph UX**: auto-fit on load, selected-node styling, responsive navbar with the Planning tab.

### Changed
- **Audio notes are real or explicit — never simulated.** Adding a voice note starts `MediaRecorder` capture immediately; if the microphone is unavailable or denied, the block offers two honest actions: record again or attach an audio file. Removed the default fake waveform, fake playback timer, `0:30` default duration, the `SIMULATED` badge and the "simulated" MIME label. Attached/recorded audio stays a real base64 MIME part of the `.eml`.
- **No demo content anywhere**: deleted `INITIAL_CAPSULES`, `resetToStarterVault()`, the "load sample vault" button, palette action, toast and localization keys. Fresh installs start with a genuinely empty vault; new capsules are created with an empty body paragraph instead of placeholder demo text.
- **Co-Think is model-agnostic**: removed Claude / Gemini / DeepSeek / GPT mentions from the modal, defaults, block authorship, thread classification and tests. The engine is labeled `Local Co-Thinker · no external model`; model selection returns when a real integration exists.
- Sidebar card now says "Local-first" and describes the actual `.eml` folder behaviour instead of claiming autonomous sync.

### Fixed
- Escape closes modals; AI block upserts no longer duplicate on repeated critique; graph selection no longer restarts the force simulation.
- Version badge and docs now report the real test count (109 tests / 8 files).

## [1.3.0] — 2026-10-22

### Fixed
- **Offline Co-Thinker was canned — now it actually reads the capsule.** The previous "AI" returned hardcoded text about LTV/CAC no matter what the capsule contained (even `data_insight` invented "Средний CAC: $117.50" out of thin air). The rewritten engine (`offlineAi.ts`) is content-aware and honest: it mines the capsule's real numeric claims and quotes them, extracts actual keyword themes (RU+EN stopwords filtered), runs rule-based risk scans (absolute claims, missing downside, thin extrapolation, deadline pressure), computes **real statistics from attached CSVs** (mean/min/max, trend by OLS slope, first→last delta %, Pearson correlation with a "correlation ≠ causation" caveat) and **refuses to invent numbers** when there is no data. Fully deterministic: same capsule → same analysis; personas (Claude/Gemini/DeepSeek) change the framing and honest confidence, not the facts.

### Added
- **"Похожие по смыслу" (related capsules)**: new `relatedCapsules()` in the vault store ranks every other capsule by **tf-idf cosine similarity** over the same inverted index that powers BM25 search (weight = idf × (1 + ln tf), SMART-style). The editor's links panel gained a third section with similarity-percentage badges; direct backlink targets are excluded (already listed). No LLM, no embeddings — just the index.
- `Bm25Index.similarity(a, b)` — tf-idf cosine over indexed documents.
- Engine test suite grown from 30 to **57 tests**: CSV parsing/math (incl. the demo dataset's real CAC mean 106.67 and CAC↔LTV correlation < −0.95), claim mining, risk rules, keyword extraction, anti-canned regression ("two different capsules → two different analyses"), determinism, related-capsule similarity.

## [1.2.0] — 2026-10-22

### Added
- **Okapi BM25 relevance ranking** for full-text search: the vault now scores results instead of listing "anything that matches". Ranking combines classic BM25 (IDF-weighted terms, term-frequency saturation, document-length normalization) with prefix-term matching for autocomplete-style queries and the legacy subject/tag substring boosts; ties break to the newer capsule. The sidebar shows the match count ("N matches · BM25 ranked"), the indexed-term count and a per-capsule relevance badge (Σ-score + matched terms on hover). `[[wikilink]]` autocomplete inherits the same ranking.
- **Linux builds in the release pipeline**: tagged releases now also produce `CapsuleOS_*_amd64.AppImage` (portable) and `CapsuleOS_*_amd64.deb` (Debian/Ubuntu, built on Ubuntu 22.04 / glibc 2.35+) alongside the Windows MSI/NSIS installers, with per-OS SHA256SUMS artifacts. Release workflow is a two-platform matrix with fail-fast disabled.

### Changed
- Engine test suite grown from 17 to 30 tests (BM25 tokenizer, IDF, tf-saturation, length normalization, prefix matching, corpus bookkeeping).

## [1.1.0] — 2026-10-22

### Fixed
- `parseEml` no longer leaks the internal `canvas_state.json` part into the attachment list of every imported capsule; attachments with boundary-like or non-Latin1 payloads now round-trip via `Content-Transfer-Encoding: base64`.
- MIME boundaries are deterministic (FNV hash) — re-assembling an unchanged capsule produces byte-identical `.eml`, so the folder vault stops rewriting files on every save.
- Co-Think modal modes are wired to the offline engine (`synthesis` → AI Synthesis callout, `counter_arg` → child `.eml`, `data_insight` → Data Insight callout); reply capsules reuse the AI-generated blocks instead of a static template.
- Slash-command menu opens only at line starts / after whitespace — "and/or" and URLs no longer trigger it, and the trigger `/` is never left in the text.
- Code REPL: JavaScript runs in a sandboxed Web Worker with a 3s watchdog (infinite loops no longer freeze the app); JSON mode validates and pretty-prints; Python/Rust honestly report that no offline interpreter is bundled instead of failing with JavaScript syntax errors.
- Tag filter chips rendered a double hash (`##finance`); `Cmd/Ctrl+K` now actually focuses the vault search.
- Graph view gained working zoom controls and a deterministic tag-color palette; Thought Threads render callout/todo/audio/code blocks and highlight the selected capsule.
- Deleting a capsule no longer resets the selection unless the deleted capsule was selected; Navbar shows the real version and real index-rebuild time.

### Added
- Real audio for voice notes: attach an audio file — it is stored as a base64 MIME attachment, played back with a click-to-seek waveform, embedded into the autonomous HTML dashboard, and the block badge flips from `SIMULATED` to `REAL AUDIO`.
- In-app microphone recording: the voice-note block records straight from the mic (MediaRecorder + live level meter), saves the take as a real MIME attachment, and uses the recorded envelope as its waveform — voice notes no longer require an external recorder.
- Empty-vault onboarding: fresh installs no longer seed demo notes. A built-in onboarding screen explains the `.eml` concept, answers the frequent questions (FAQ) and offers "New .eml" / "Import .eml" / "Load sample vault"; the FAQ is also reachable anytime from the navbar. The five-capsule sample vault stays available on demand.
- Standalone `.html` dashboard export from the Preview view.
- Honest in-browser benchmark: the modal really pushes N synthetic capsules through `parseEml` + graph build (previously it simulated 'SIMD/AVX2 mmap' numbers).
- Vitest engine test suite (17 tests) and a `test` step in CI.
- Bilingual documentation: `README.md` (English) and `README.ru.md` (Russian) with a full screenshot tour.
- `CONTRIBUTING.md`, `CHANGELOG.md`, issue and PR templates.

## [1.0.0] — 2026-10-21

### Added
- Block canvas editor: heading, paragraph, callout, TODO, DataGrid (table/chart/pivot), whiteboard, code REPL, audio note, AI opponent.
- RFC 5322 `.eml` capsules with multipart body: JSON blocks, HTML fallback, MIME attachments addressed by `Content-ID`.
- Vault graph store with inverted index, tag/author indexes and instant full-text search.
- Thought threads, relationship graph, `[[wikilinks]]` with backlinks and a related-capsules panel.
- Markdown live preview and Markdown export (`.eml` stays the source of truth).
- Offline deterministic Co-Thinker (`critique`, `continue`, `reply_thread`, `data_insight`) — no API key.
- Tauri 2 desktop shell: native window, filesystem vault (`vault/` + `vault.json`), native Save As / Open dialogs, zip and `.eml` import/export.
- Raw MIME inspector and autonomous HTML preview.

### Changed
- Vault folder is authoritative on startup; the JSON snapshot is only a cache.

### Infrastructure
- GitHub Actions: Windows x64 release pipeline (MSI + NSIS, `SHA256SUMS.txt`) on tags and manual dispatch.
- CI: TypeScript typecheck, Vite build, `cargo check`, `cargo fmt --check`, `cargo clippy -D warnings`.

[Unreleased]: https://github.com/kostyk348/capsuleos/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/kostyk348/capsuleos/releases/tag/v1.1.0
[1.0.0]: https://github.com/kostyk348/capsuleos/releases/tag/v1.0.0
