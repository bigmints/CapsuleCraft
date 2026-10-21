# Changelog

All notable changes to CapsuleOS are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

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
