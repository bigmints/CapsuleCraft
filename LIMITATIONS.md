# Known limitations

Honest list of what CapsuleOS does **not** do yet. Updated as features land — if a
limitation below is fixed, it gets removed instead of being quietly forgotten.

_Last updated: 2026-10-22 (v1.4.0)_

## Planning & tasks

- The Gantt editor edits **one** prerequisite per task. The data model stores
  `blockedBy: string[]` and the chart draws every edge, but the select replaces
  the whole array — extra blockers cannot be added from the UI yet.
- Gantt has no drag-and-drop of bars, no zoom and no rescheduling by dragging;
  dates are edited in the table below the chart.
- Dates are local calendar days (`YYYY-MM-DD`), not instants: there is no time
  of day, timezone or recurring task support.
- ICS export is a VTODO handoff only — no alarms, attendees or timezone block.
- Status model is `todo / doing / done`; no custom columns, WIP limits or swimlanes.
- Completing a blocked task is not prevented — the UI warns, but the action is
  allowed (a warning, not a hard gate).

## Editor & data

- DataGrid accepts CSV only and reads it from the `.eml` attachment. JSON tables
  and pasting data are not implemented; an empty grid asks for a real CSV file.
- Whiteboards store a flat element list (`rectangle / circle / sticky / arrow /
  text`). There is no grouping, undo, multi-select or connection routing.
- Code REPL executes JavaScript in the browser; other language selectors are
  syntax labels, not real execution environments.
- Block placeholders and some block-level toolbar labels are still hardcoded
  English or Russian instead of going through i18n.
- English/Russian pluralization is not implemented (`1 capsules`).
- New capsules have no default tags or demo body; the subject falls back to a
  localized "New capsule" until you rename it.

## Architecture / product

- Sync, multi-user access, RBAC and encryption-at-rest are roadmap items only.
  Nothing in the UI claims otherwise.
- No plugin API, webhooks or external API yet. Extensibility is limited to the
  `.eml` file format and the TypeScript engine.
- The web build persists the vault in `localStorage`; the Tauri build persists a
  folder of `.eml` files. Cross-device sync is manual (copy the folder).
- The "Co-Thinker" is a deterministic heuristic engine, not an LLM. It quotes
  real capsule content and refuses to invent numbers, but it cannot reason
  beyond its rule set.
- Import covers `.eml` files and vault ZIPs; there is no Evernote/Notion/PDF
  importer.
