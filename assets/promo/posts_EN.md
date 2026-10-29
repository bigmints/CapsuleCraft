# CapsuleCraft v1.8.1 — EN promo copy

Project: https://github.com/kostyk348/CapsuleCraft
Releases: https://github.com/kostyk348/CapsuleCraft/releases
Attach: banner_x_1200x675_en.png (first tweet / Reddit), demo.gif (quote-tweet or Reddit body).

---

## 1. X / Twitter thread (EN) — 4 tweets, attach banner to tweet 1, demo.gif to tweet 3

**1/**
Your knowledge base should outlive the app you wrote it in.

CapsuleCraft is a local-first notes & planning app where every page is a plain RFC 5322 `.eml` file on disk. No database. No cloud. No accounts. [image]

github.com/kostyk348/CapsuleCraft

**2/**
What "one page = one .eml" buys you:

— open notes in Thunderbird/mutt
— `grep` the whole vault
— `git diff` your thinking
— sync with Syncthing/rsync
— export is a no-op: the file already IS the export

Delete the app tomorrow — the data won't notice.

**3/**
It's a real editor, not a gimmick:

■ block editor (todos, callouts, code, CSV datagrids)
■ [[wiki links]] + live backlinks
■ BM25 search w/ scores, snippets, Cyrillic-aware
■ Agenda / Kanban / Gantt + ICS export
■ email-style threads via In-Reply-To

[video: demo.gif]

**4/**
For the privacy-minded:

— parsing, search & AI run 100% offline
— deterministic local Co-Thinker critiques your drafts (no API keys)
— MCP server: Claude/Cursor can search your vault on your terms
— native Rust + egui shell, ~11 MB AppImage, no browser engine

MIT · v1.8.1 out now ⬇
github.com/kostyk348/CapsuleCraft/releases

---

## 2. Reddit show-post (EN)

**Subreddits:** r/PKMS (primary), cross-post to r/opensource, r/rust, r/selfhosted, r/NoteTaking
**Flair:** [Show / Self-Promotion] where required — read each sub's self-promo rules first.

**Title:**
I built a PKM where the entire database is a folder of .eml files — grep it, git-diff it, open it in Thunderbird (CapsuleCraft, MIT, Rust/egui, offline)

**Body:**

Hey r/PKMS! For the past months I've been building **CapsuleCraft** — a local-first note editor & planner with a storage format that can't lock you in: **one page = one plain RFC 5322 email file (.eml)** on disk.

**Why .eml?** Because "your data outlives the app" shouldn't be a marketing claim. A vault is just a folder: Thunderbird opens every note, `grep` searches it, `git` diffs it, `rsync`/Syncthing syncs it. There is no database underneath — no SQLite, nothing. The app is a viewer/editor over plain text, so there are no migrations and no exports: the file *is* the export.

**What's inside (v1.8.1):**
- **Block editor** — headings, paragraphs, task lists w/ dates & priorities, callouts, code, CSV datagrids (datasets travel as MIME parts addressed by `Content-ID`), audio notes; autosave + undo/redo + strict `.eml` round-trip
- **[[Wiki links]]** with a live backlink index; renaming a page rewrites every link in the vault
- **Okapi BM25 search** over the whole vault — relevance scores, highlighted snippets, Cyrillic-aware case folding; "related by meaning" via tf-idf cosine on the same index
- **Planning layer** — every task block across the vault aggregated into Agenda / Kanban (drag & drop) / Gantt (dependency arrows, cycle protection) / calendar, with RFC 5545 ICS export
- **Threads** — replies are real child `.eml`s with `In-Reply-To`/`References`, i.e. standard mail threading
- **Import** — drop `.eml` from Gmail/Outlook/Thunderbird (byte-for-byte), IMAP sync, and an Obsidian vault importer
- **Offline Co-Thinker** — deterministic local critique of your drafts (vague words, balance, data anomalies). No API keys, no cloud
- **MCP server** — expose the vault to Claude/Cursor/any MCP client for agent-side search & read
- **Native shell** — Rust + egui, no browser engine: ~11 MB Linux AppImage (glibc-only deps), portable Windows zip, macOS arm64 .app. RU/EN UI

**Honest limitations** (tracked in LIMITATIONS.md, not hidden): the native shell can't execute code or play audio yet, folder watching is best-effort, no GPG encryption yet. It starts empty on purpose — built-in FAQ instead of fake demo notes.

**Compare:** vs Obsidian — I trade the plugin ecosystem for an open, mail-client-readable format and a 11 MB webview-free shell; vs Notion/OneNote — no accounts, no cloud, nothing proprietary anywhere.

**Get it:** https://github.com/kostyk348/CapsuleCraft/releases (AppImage / Windows / macOS, SHA256SUMS included) · Source: https://github.com/kostyk348/CapsuleCraft · MIT, CI + 98 native unit tests.

Feedback very welcome — especially on the `.eml` format decisions (headers, MIME part layout) and what you'd want in an Obsidian importer. PRs open: CONTRIBUTING.md.

**Demo GIF:** https://github.com/kostyk348/CapsuleCraft/raw/main/assets/promo/demo.gif
