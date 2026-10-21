# Changelog

All notable changes to CapsuleOS are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Bilingual documentation: `README.md` (English) and `README.ru.md` (Russian).
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

[Unreleased]: https://github.com/kostyk348/capsuleos/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kostyk348/capsuleos/releases/tag/v1.0.0
