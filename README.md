# 🧠 CapsuleOS — Zero-DB, Pure-MIME Workspace (Native Desktop)

[![Release](https://img.shields.io/github/v/release/kostyk348/capsuleos?sort=semver&color=blue)](https://github.com/kostyk348/capsuleos/releases)
[![Last commit](https://img.shields.io/github/last-commit/kostyk348/capsuleos?branch=main)](https://github.com/kostyk348/capsuleos/commits/main)

> **Мультимодальное рабочее пространство и персональный движок знаний** на архитектуре «Zero-Database»: вся информация живёт в крипто-свитках **RFC 5322 EML** — без внешних баз данных и без облака.

**Нативная десктопная сборка (Tauri + React 19 + TypeScript)** — реальное нативное окно, файловая система, без браузера и без серверов.

| Редактор капсул (Block Canvas) | Граф связей (Graph DAG) |
|---|---|
| ![editor](screenshots/capsuleos-editor.png) | ![graph](screenshots/capsuleos-graph.png) |

---

## ✨ Возможности

### 📦 Архитектура Zero-DB (RFC 5322 EML)

- Каждая капсула знаний — это полноценное почтовое сообщение `.eml` (`Message-ID`, `In-Reply-To`, `X-Capsule-Tags`, SHA-256 контрольные суммы).
- Хранилище-граф с инвертированным индексом: мгновенный полнотекстовый поиск по всем капсулам.
- Импорт/экспорт `.eml` и `zip`-архивов, Raw-MIME инспектор.

### 🧱 Блочный канвас-редактор

- Заголовки, параграфы, коллауты, TODO-списки.
- **Живые DataGrid**: таблицы с pivot/chart-представлениями и CSV-аттачами.
- **Whiteboard**: канвас с фигурами, стикерами, mind-map узлами и стрелками.
- **Code REPL**: исполнение JS/JSON-блоков прямо в капсуле.
- **Аудио-заметки** с waveform и транскриптом.

### 🕸 In-Memory Graph & Threads

- Мгновенный граф связей капсул (parent/child, In-Reply-To) с просмотром сателлитов.
- Thought-треды: линейные и мультиветвящиеся цепочки рассуждений.

### 🔗 Бэклики ([[wikilinks]]) — как в Obsidian

- Пиши `[[название капсулы]]` в любом текстовом блоке — автокомплит по живым капсулам.
- Кликабельные ссылки в режиме предпросмотра + панель **Связанные капсулы** (incoming/outgoing).
- Рёбра `[[wikilinks]]` отображаются в графе зелёным пунктиром.

### ✍️ Markdown-рендер в блоках

- `**bold**`, `*italic*`, `` `code` ``, `[link](url)` — live-предпросмотр (иконка глаза) в paragraph/callout/heading блоках.
- Экспорт капсулы в **Markdown** (кнопка Export .md — `.eml` остаётся источником истины).

### 📁 Vault как папка (.eml на капсулу)

- Каждая капсула — отдельный RFC 5322 `.eml` файл в `~/.local/share/com.capsuleos.app/vault/`.
- При старте vault сканируется: папка авторитетнее JSON-снапшота. Всё самодостаточно в одном файле: блоки JSON + HTML-фолбэк + вложения — без мусора из md+папок с ассетами.

### 🤖 Офлайн Co-Thinker (без API-ключа)

- Встроенный детерминированный AI-ассистент: `critique` / `continue` / `reply_thread` / `data_insight`.
- Работает полностью офлайн — никаких внешних серверов и ключей.

### 💾 Настоящая файловая персистентность

- Хранилище автоматически сохраняется в **JSON-файл** в каталоге данных приложения (`~/.local/share/com.capsuleos.app/vault.json`).
- Нативные диалоги **Save As… / Open…** для экспорта/импорта капсул и архивов.

---

## 🚀 Запуск

### Требования

- [Rust](https://rustup.rs/) 1.77+
- [Node.js](https://nodejs.org/) 18+
- Linux: `webkit2gtk-4.1`, `gtk3`, `librsvg` · Windows: WebView2 · macOS: WebKit

### Разработка

```bash
npm install
npm run tauri dev
```

### Сборка нативного бинаря

```bash
npm run tauri build
# Бинарь: src-tauri/target/release/capsuleos
# Пакеты: src-tauri/target/release/bundle/ (AppImage/.deb/.rpm на Linux, .msi на Windows, .app на macOS)

```

### Просто веб-режим (без десктоп-оболочки)

```bash
npm install
npm run dev   # Vite dev-сервер на :5173
npm run build && npm run preview
```

---

## 🧠 Как это устроено

| Модуль | Назначение |
|---|---|
| `src/engine/mime.ts` | Сборка/парсинг RFC 5322 EML-капсул, вложения, CID |
| `src/engine/vaultStore.ts` | Граф-хранилище + инвертированный индекс + персистентность |
| `src/engine/desktopStore.ts` | Мост к нативной ФС через Tauri IPC |
| `src/engine/offlineAi.ts` | Детерминированный офлайн Co-Thinker |
| `src/components/BlockCanvasEditor.tsx` | Блочный редактор капсулы |
| `src/components/DataGridBlock.tsx` | Живые таблицы/chart/pivot |
| `src/components/GraphView.tsx` | Граф связей капсул |
| `src-tauri/src/lib.rs` | Rust-бэкенд: файловые команды, нативные диалоги |

---

## 📄 Лицензия

MIT
