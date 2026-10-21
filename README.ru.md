# 🧠 CapsuleOS

[English](README.md) · **Русский**

[![Release](https://img.shields.io/github/v/release/kostyk348/capsuleos?sort=semver&color=blue)](https://github.com/kostyk348/capsuleos/releases)
[![CI](https://github.com/kostyk348/capsuleos/actions/workflows/ci.yml/badge.svg)](https://github.com/kostyk348/capsuleos/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)](#сборка-из-исходников)

> **Мультимодальное рабочее пространство и персональный движок знаний без базы данных.**
> Каждая заметка, таблица, доска и аудиозаметка — обычное письмо **RFC 5322 `.eml`**.
> Никакого SQL, документных хранилищ, облака и вендор-лока. Только файлы, которые открываются в любом почтовом клиенте.

CapsuleOS — **нативное десктопное приложение** (Tauri 2 + Rust + React 19 + TypeScript): настоящее окно, реальная файловая система, без вкладки браузера и без серверного процесса.

| Блочный редактор капсул | Граф хранилища |
|---|---|
| ![редактор](screenshots/capsuleos-editor.png) | ![граф](screenshots/capsuleos-graph.png) |

---

## Зачем

Большинство заметочников держат ваши знания в проприетарной базе. Заметки ваши ровно до тех пор, пока живёт приложение и не поменялась схема.

CapsuleOS переворачивает это:

| Обычный PKM | CapsuleOS |
|---|---|
| SQLite / закрытое хранилище | Обычные `.eml`-файлы на диске |
| Экспорт = обеднённый Markdown-дамп | Экспорт = файл, который уже лежит у вас |
| Треды и ссылки — внутренние для приложения | `In-Reply-To` / `References` — семантика RFC 5322 |
| Вложения — вендорные блобы | Стандартные MIME-части с адресацией по `Content-ID` |
| Облачная синхронизация, аккаунт, телеметрия | Локальное хранилище, офлайн по умолчанию |

Вся база знаний — это **папка писем**: грепается, дифается, бэкапится любым инструментом и остаётся читаемой десятилетиями.

## Возможности

### 📦 Архитектура Zero-DB (RFC 5322 EML)
- Каждая капсула — полноценное MIME-письмо: `Message-ID`, `In-Reply-To`, `References`, `X-Capsule-Tags`, `X-Capsule-Status`, multipart-тело.
- Граф-хранилище с **инвертированным индексом** — мгновенный полнотекстовый поиск по всем капсулам.
- Импорт/экспорт `.eml` и `zip`-архивов, инспектор сырого MIME.
- Папка хранилища — источник истины: при старте она пересканируется и приоритетнее JSON-снапшота.

### 🧱 Блочный канвас-редактор
- Заголовки, параграфы, коллауты, TODO-списки.
- **Живые DataGrid** — таблицы на основе CSV/JSON-вложений с представлениями «график» и «pivot».
- **Whiteboard** — фигуры, стикеры, узлы mind-map и стрелки на канвасе.
- **Code REPL** — исполнение JavaScript-блоков на месте, JSON-блоки валидируются.
- **Аудиозаметки** — waveform и транскрипт как блоки капсулы.
- **AI-оппонент** — блок-критика, спорящий с утверждением, к которому привязан.

### 🕸 Граф связей и треды
- Мгновенный граф отношений (`in_reply_to`, `references`, теги) с превью сателлитов.
- Thought-треды: линейные и мультиветвящиеся цепочки рассуждений.

### 🔗 Wikilinks и бэклики
- Пишите `[[название капсулы]]` в любом текстовом блоке — с автокомплитом по живым капсулам.
- Кликабельные ссылки в режиме предпросмотра и панель **Связанные капсулы** (входящие/исходящие).
- Рёбра wikilinks рисуются в графе зелёным пунктиром.

### ✍️ Markdown-рендер
- `**жирный**`, `*курсив*`, `` `код` ``, `[ссылка](url)` — live-предпросмотр в блоках paragraph, callout и heading.
- Экспорт капсулы в **Markdown** (`.eml` остаётся источником истины).

### 🤖 Офлайн Co-Thinker
- Детерминированный локальный ассистент: `critique`, `continue`, `reply_thread`, `data_insight`.
- Без API-ключа и без сетевых вызовов — приложение полностью работает офлайн.

## Формат капсулы

Капсула — обычное письмо. Его можно открыть в Thunderbird, mutt или в бэкап-утилите:

```eml
Message-ID: <capsule-1755000000000@vault.local>
Subject: Q4 pricing experiment
From: Owner <owner@vault.local>
To: Vault <vault@capsuleos.local>
Date: Tue, 12 Aug 2026 09:14:00 +0000
In-Reply-To: <capsule-root@vault.local>
References: <capsule-root@vault.local>
X-Capsule-Tags: pricing, experiment
X-Capsule-Status: Active
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="capsule-boundary"

--capsule-boundary
Content-Type: text/html; charset=utf-8

<h1>Q4 pricing experiment</h1>
<p>Fallback HTML view for any mail client.</p>

--capsule-boundary
Content-Type: application/json; name="blocks.json"
Content-Disposition: attachment; filename="blocks.json"
Content-ID: <blocks_json>

[{"id":"blk_1","type":"heading","data":{"level":1,"text":"Q4 pricing experiment"}}]

--capsule-boundary
Content-Type: text/csv; name="cohorts.csv"
Content-Disposition: attachment; filename="cohorts.csv"
Content-ID: <dataset_cohorts_csv>

cohort,users,conversion
Q4-A,1200,0.041

--capsule-boundary--
```

JSON-часть — структурированный блочный канвас, HTML-часть — читаемый фолбэк, остальные части — датасеты и вложения, на которые DataGrid-блоки ссылаются по `Content-ID`.

## Загрузка

Готовые установщики **Windows x64** прикреплены к каждому [релизу](https://github.com/kostyk348/capsuleos/releases/latest):

| Файл | Что это |
|---|---|
| `CapsuleOS_*_x64_en-US.msi` | Пакет Windows Installer |
| `CapsuleOS_*_x64-setup.exe` | Установщик NSIS |

- Нужен Microsoft Edge **WebView2 Runtime** (в Windows 10/11 уже есть; иначе [скачать](https://developer.microsoft.com/microsoft-edge/webview2/)).
- Установщики пока **не подписаны**, поэтому SmartScreen может предупредить: *Подробнее → Выполнить в любом случае*.
- Рядом с установщиками публикуется `SHA256SUMS.txt`.

Сборок под Linux и macOS пока нет — собирайте из исходников.

## Сборка из исходников

**Требования**

- [Rust](https://rustup.rs/) 1.77.2+ (stable)
- [Node.js](https://nodejs.org/) 20+ с npm
- Только Linux: `webkit2gtk-4.1`, `gtk3`, `librsvg2`, `libayatana-appindicator3`, `patchelf`
- Windows: MSVC build tools + WebView2 · macOS: Xcode command line tools

```bash
git clone https://github.com/kostyk348/capsuleos.git
cd capsuleos
npm ci
npm run tauri:dev      # окно разработки с hot reload
npm run tauri:build    # релизные установщики
```

Результат:

- бинарь — `src-tauri/target/release/capsuleos` (`capsuleos.exe` на Windows);
- пакеты — `src-tauri/target/release/bundle/` (`.msi`/`.exe` на Windows, `.deb`/`.rpm`/`.AppImage` на Linux, `.app` на macOS).

### Веб-режим (без десктоп-оболочки)

```bash
npm ci
npm run dev            # dev-сервер Vite на http://localhost:5173
npm run build          # production-сборка в dist/
npm run preview        # раздача сборки
```

В обычном браузере хранилище деградирует до `localStorage`; нативный доступ к файлам есть только в Tauri.

## Структура проекта

```
src/
  engine/mime.ts            сборка/парсинг RFC 5322-капсул, вложения, CID
  engine/vaultStore.ts      граф-хранилище, инвертированный индекс, индексы, персистентность
  engine/desktopStore.ts    мост Tauri IPC к реальной файловой системе
  engine/offlineAi.ts       детерминированный офлайн Co-Thinker
  engine/markdown.tsx       инлайн-рендер markdown
  components/               канвас-редактор, DataGrid, граф, треды, MIME-инспектор
  components/blocks/        по компоненту на тип блока
  types.ts                  типы капсул / блоков / графа
src-tauri/
  src/lib.rs                Rust-команды: файловый IO, диалоги, app data dir
  tauri.conf.json           окно, бандлы, идентификатор
  capabilities/             набор разрешений Tauri
.github/workflows/
  ci.yml                    typecheck + веб-сборка, cargo check/fmt/clippy
  release.yml               релиз Windows x64 (msi + nsis) по тегу или вручную
```

## Данные и приватность

Всё локально. Ничего не покидает машину: собственных сетевых вызовов у приложения нет.

| ОС | Каталог хранилища |
|---|---|
| Windows | `%APPDATA%\com.capsuleos.app\` |
| Linux | `~/.local/share/com.capsuleos.app/` |
| macOS | `~/Library/Application Support/com.capsuleos.app/` |

Внутри: папка `vault/` с одним `.eml` на капсулу и `vault.json` — кэш-снапшот индекса. Удалите папку — удалите рабочее пространство. Скопируйте — унесёте всю базу знаний.

## Статус

`v1.0.0` — десктопное приложение пригодно сквозным сценарием. Известные шероховатости:

- установщики не подписаны (SmartScreen предупреждает);
- автотестов пока нет (CI покрывает typecheck, веб-сборку, `cargo check`, fmt, clippy);
- капсулы пересканируются из папки при старте — нормально для тысяч файлов, дальше не бенчмаркалось.

## Участие

Issues и PR приветствуются — см. [CONTRIBUTING.md](CONTRIBUTING.md). Изменения ведутся в [CHANGELOG.md](CHANGELOG.md).

## Лицензия

[MIT](LICENSE) © CapsuleOS Contributors
