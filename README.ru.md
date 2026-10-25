<div align="center">

<img src="screenshots/capsulecraft-mascot.png" alt="CapsuleCraft — маскот с капсулой .eml" width="180">

# CapsuleCraft

### Ваша база знаний — это папка с письмами.

**Мультимодальное рабочее пространство и персональный движок знаний без базы данных.**
Каждая заметка, таблица, вайтборд и голосовая заметка — обычное **RFC 5322 `.eml`-сообщение**:
без SQL, без документных СУБД, без облака и vendor lock-in. Файлы, которые открываются в любом почтовом клиенте, ищутся `grep`-ом, диффятся и хранятся десятилетиями.

[![Release](https://img.shields.io/github/v/release/kostyk348/CapsuleCraft?sort=semver&color=0ea5e9&label=release)](https://github.com/kostyk348/CapsuleCraft/releases)
[![CI](https://github.com/kostyk348/CapsuleCraft/actions/workflows/ci.yml/badge.svg)](https://github.com/kostyk348/CapsuleCraft/actions/workflows/ci.yml)
[![тесты движка](https://img.shields.io/badge/тесты%20движка-151%20passing-22c55e)](https://github.com/kostyk348/CapsuleCraft/actions/workflows/ci.yml)
[![тесты native](https://img.shields.io/badge/тесты%20native-97%20passing-22c55e)](native/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=black)](https://v2.tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-1.77+-DEA584?logo=rust&logoColor=white)](native/)
[![egui](https://img.shields.io/badge/egui-0.37-0ea5e9)](https://github.com/emilk/egui)
[![No DB](https://img.shields.io/badge/БД-нет-orange)](#-почему)
[![Offline](https://img.shields.io/badge/offline-first-success)](#-данные-и-приватность)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

[English](README.md) · **Русский**

[Почему](#-почему) · [Экскурсия](#-экскурсия-по-фичам) · [Native-оболочка](#native-оболочка-на-egui-эксперимент) · [Формат](#-формат-капсулы) · [Начало работы](#-начало-работы) · [Архитектура](#-архитектура) · [Роадмап](#-роадмап)

</div>

---

## 🆕 v1.5 — CapsuleCraft и native-оболочка

> Тот же формат, то же хранилище, новое имя и вторая оболочка без webview. [Заметки о релизе →](docs/releases/v1.5.0.md)

- 🫧 **CapsuleCraft** — проект, известный как CapsuleOS: маскот и полный набор
  иконок. Формат, заголовки, папка данных и Message-ID не изменились.
- 🖥 **Native-оболочка на egui** — второй бинарник над той же папкой, без браузерного
  движка: wiki-ссылки с обратными ссылками, поиск BM25, планирование, граф,
  треды, MIME и вид письма.
- 🔗 **Переименование не ломает вики**, 👀 **слежение за папкой** и режим
  `--snapshot`, который рендерит эти самые скриншоты из настоящего приложения.

<img src="screenshots/capsulecraft-native-page.png" alt="Native-оболочка CapsuleCraft — страница с wiki-ссылками, тегами и задачами" width="100%">

<img src="screenshots/capsulecraft-native-backlinks.png" alt="Native-оболочка — обратные ссылки, сохранённый код и хлебные крошки" width="100%">

<details>
<summary><b>Ещё скриншоты</b> — планирование, граф, треды, поиск, MIME, письмо</summary>

| | |
|---|---|
| <img src="screenshots/capsulecraft-native-planning.png" alt="Планирование: повестка, канбан, гантт, календарь"> | <img src="screenshots/capsulecraft-native-graph.png" alt="Граф связей с подписями узлов"> |
| <img src="screenshots/capsulecraft-native-threads.png" alt="Цепочки ответов из заголовков In-Reply-To"> | <img src="screenshots/capsulecraft-native-search.png" alt="Поиск BM25 с подсветкой выдержек"> |
| <img src="screenshots/capsulecraft-native-mime.png" alt="Инспектор сырого MIME"> | <img src="screenshots/capsulecraft-native-mail.png" alt="Страница в виде письма"> |

</details>

## 🧭 Коротко

- 📦 **Zero-DB.** Одна капсула = один `.eml`-файл на диске. Thunderbird прочтёт ваши заметки, `grep` найдёт, `rsync` синхронизирует.
- 🧱 **Больше, чем Markdown.** Блочный редактор: заголовки, callout'ы, TODO, живые DataGrid'ы из CSV с графиками, вайтборды, код-REPL, голосовые заметки — всё в одном MIME-контейнере.
- 🤖 **Офлайн-соавтор.** Детерминированный локальный ИИ-оппонент критикует тезисы, продолжает мысли и анализирует датасеты. Без API-ключа, без сети.
- ⚡ **Быстро.** Честный бенчмарк в браузере парсит **50 000 капсул примерно за 1.4 с** (~36k файлов/с) — измерено, а не заявлено.

> Известные пробелы перечислены в [LIMITATIONS.md](LIMITATIONS.md) — пункты роадмапа не выдаются за готовые функции.

## 🗓 Релизы

| Версия | Дата | Главное |
|---|---|---|
| [v1.5](docs/releases/v1.5.0.md) | 2026-10-23 | Переименование в CapsuleCraft, иконки-маскот, native-оболочка (wiki-ссылки, поиск, слежение за папкой) |
| [v1.4](docs/releases/v1.4.0.md) | 2026-10-22 | Планирование, иерархия страниц, импорт писем, фильтры задач |
| [v1.3](docs/releases/v1.3.0.md) | 2026-10-22 | Контент-зависимый офлайн Co-Thinker, связанные капсулы по tf-idf |
| [v1.2](docs/releases/v1.2.0.md) | 2026-10-22 | Поиск по BM25, Linux-инсталляторы |
| [v1.1](docs/releases/v1.1.0.md) | 2026-10-22 | Настоящие аудиозаметки, честный бенчмарк, онбординг пустого хранилища |
| [v1.0](https://github.com/kostyk348/CapsuleCraft/releases/tag/v1.0.0) | 2026-08-16 | Блочный канвас, `.eml`-хранилище, граф, треды, оболочка Tauri |

Полные заметки — в каждом релизе: [GitHub Releases](https://github.com/kostyk348/CapsuleCraft/releases) · [Changelog](CHANGELOG.md).

## ❓ Почему

Большинство заметочных приложений хранят знания в проприетарной базе. Ваши заметки принадлежат вам лишь до тех пор, пока живо приложение и не поменялась схема.

CapsuleCraft переворачивает это:

| Обычный PKM | CapsuleCraft |
|---|---|
| SQLite / проприетарное хранилище | Обычные `.eml`-файлы на диске |
| Экспорт = потери при конвертации в Markdown | Экспорт = файл, который у вас уже есть |
| Треды и связи — внутренняя логика приложения | `In-Reply-To` / `References` — семантика RFC 5322 |
| Вложения — вендорные бинарные блобы | Стандартные MIME-части, адресуемые через `Content-ID` |
| Облачная синхронизация, аккаунт, телеметрия | Локальный vault, офлайн по умолчанию |

Вся база знаний — это **папка с сообщениями**: ищется grep-ом, диффится, резервируется любым инструментом, читается десятилетиями.

## ✨ Экскурсия по фичам

> Скриншоты в этом разделе и в заметках о релизах ниже сделаны до переименования и
> показывают прежнее имя. Свежие native-скриншоты — в начале README.

### 🧱 Блочный редактор

<table>
<tr>
<td><img src="screenshots/capsuleos-datagrid.png" alt="Живой DataGrid и интерактивный вайтборд"></td>
</tr>
<tr>
<td align="center"><sub>Живой DataGrid (графики из CSV) · интерактивный вайтборд с майнд-блоками и стикерами</sub></td>
</tr>
</table>

- Заголовки, абзацы, callout'ы, TODO — с живым инлайн-Markdown.
- **Живой DataGrid** — таблицы из CSV/JSON-вложений с видами «график» и «сводная».
- **Вайтборд** — фигуры, стикеры, узлы майнд-карт и стрелки на холсте.
- **Код-REPL** — JavaScript исполняется в изолированном Web Worker со сторожем на 3 с (бесконечный цикл не уронит приложение); JSON валидируется и форматируется.
- **Аудиозаметки** — запись прямо с микрофона или прикрепление файла; настоящее аудио с waveform-перемоткой и бейджем длительности, хранится как MIME-часть того же `.eml`.
- **ИИ-оппонент** — блок критики, который спорит с тезисом, к которому прикреплён.

### 🕸 Граф и треды

<table>
<tr>
<td width="50%"><img src="screenshots/capsuleos-graph.png" alt="Граф связей с зумом"></td>
<td width="50%"><img src="screenshots/capsuleos-threads.png" alt="Вид тредов"></td>
</tr>
<tr>
<td align="center"><sub>DAG связей · зум · физика · палитра тегов</sub></td>
<td align="center"><sub>Треды мыслей · цепочки RFC 5322 In-Reply-To</sub></td>
</tr>
</table>

- Мгновенный граф связей (`in_reply_to`, `references`, викилинки) со спутниковыми превью.
- Треды: линейные и ветвящиеся цепочки рассуждений, собранные из реальных блоков капсул.
- `[[викилинки]]` с автодополнением, кликабельные обратные ссылки и панель **Связанных капсул**.

### 🤖 Офлайн Co-Thinker

<table>
<tr>
<td><img src="screenshots/capsuleos-cothink.png" alt="Модалка Co-Think с четырьмя режимами"></td>
</tr>
<tr>
<td align="center"><sub>Четыре режима: критика · синтез · контраргумент · анализ данных</sub></td>
</tr>
</table>

- Детерминированный локальный ассистент: `critique`, `continue`, `reply_thread`, `data_insight`.
- Без API-ключа и сетевых вызовов — приложение полностью офлайн.
- Режим контраргумента порождает **дочернюю `.eml`-капсулу** с AI-блоками — ваш спор становится частью RFC 5322 DAG.

### ⚡ Честный бенчмарк и MIME-инспектор

<table>
<tr>
<td width="50%"><img src="screenshots/capsuleos-benchmark.png" alt="Честный бенчмарк: 50000 капсул за 1371 мс"></td>
<td width="50%"><img src="screenshots/capsuleos-mime.png" alt="Инспектор RFC 5322"></td>
</tr>
<tr>
<td align="center"><sub>Честный бенчмарк — 50k капсул, 1371 мс, 36k файлов/с</sub></td>
<td align="center"><sub>Инспектор RFC 5322 — каждый заголовок, каждая часть</sub></td>
</tr>
</table>

- Модалка бенчмарка реально прогоняет N синтетических капсул через `parseEml` + построение графа и показывает фактические цифры.
- MIME-инспектор показывает полное дерево и сырой исходник любой капсулы — можно скопировать или скачать точный `.eml`.

## 📦 Формат капсулы

Капсула — обычное письмо. Откройте его в Thunderbird, mutt или своём бэкап-инструменте:

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

JSON-часть — структурированный блочный холст; HTML-часть — человекочитаемый фолбэк; остальные части — датасеты и вложения, адресуемые через `Content-ID` из блоков DataGrid.

## 🚀 Начало работы

### Скачать (Windows и Linux)

Готовые инсталляторы приложены к каждому [релизу](https://github.com/kostyk348/CapsuleCraft/releases/latest):

| Файл | Что это |
|---|---|
| `CapsuleCraft_*_x64_en-US.msi` | Пакет Windows Installer |
| `CapsuleCraft_*_x64-setup.exe` | Инсталлятор NSIS |
| `CapsuleCraft_native_*_x86_64.AppImage` | Linux — **native egui**, без webview-зависимостей (только glibc) |
| `CapsuleCraft_*_amd64.AppImage` | Linux — портативный (legacy Tauri/web-сборка), `chmod +x` и запуск |
| `CapsuleCraft_*_amd64.deb` | Linux — пакет Debian / Ubuntu |

- Windows требует **WebView2 Runtime** от Microsoft Edge (предустановлен в Windows 10/11; иначе [скачайте](https://developer.microsoft.com/microsoft-edge/webview2/)).
- **Native AppImage** (выше) требует только **glibc ≥ 2.17** и рабочий стол X11 или Wayland — никаких WebKitGTK и WebView2.
- Инсталляторы пока **не подписаны** — SmartScreen может предупредить: *More info → Run anyway*.
- `SHA256SUMS.txt` публикуется для каждого артефакта.

Сборки для macOS пока не поставляются — соберите из исходников ниже.

### Первый запуск

CapsuleCraft стартует с **пустого хранилища** — никаких демо-заметок. Вместо них — встроенный онбординг-экран: он объясняет концепцию `.eml`, отвечает на частые вопросы и предлагает два действия — создать капсулу или импортировать `.eml`. FAQ доступен в любой момент по кнопке **FAQ** в верхней панели.

<img src="screenshots/capsuleos-faq.png" alt="Первый запуск CapsuleCraft — пустое хранилище со встроенным FAQ" width="100%">

### Сборка из исходников

**Требования**

- [Rust](https://rustup.rs/) 1.77.2+ (stable)
- [Node.js](https://nodejs.org/) 20+ с npm
- Только для Linux: `webkit2gtk-4.1`, `gtk3`, `librsvg2`, `libayatana-appindicator3`, `patchelf`
- Windows: MSVC build tools + WebView2 · macOS: Xcode command line tools

```bash
git clone https://github.com/kostyk348/CapsuleCraft.git
cd capsuleos
npm ci
npm run tauri:dev      # окно разработки с hot reload
npm run tauri:build    # релизные инсталляторы
```

Результат:

- бинарник — `src-tauri/target/release/capsuleos` (`capsuleos.exe` на Windows)
- пакеты — `src-tauri/target/release/bundle/` (`.msi`/`.exe` на Windows, `.deb`/`.rpm`/`.AppImage` на Linux, `.app` на macOS)

### Веб-режим (без десктоп-оболочки)

```bash
npm ci
npm run dev            # Vite dev-сервер на http://localhost:5173
npm run build          # прод-сборка в dist/
npm run preview        # раздача сборки
npm test               # движок-тесты vitest (151 шт.)
```

В обычном браузере vault падает на `localStorage`; нативный доступ к файлам — только через Tauri.

## 🏗 Архитектура

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        Десктоп-оболочка Tauri 2                      │
│  src-tauri/src/lib.rs — файловый IO, диалоги, app-data dir (Rust)    │
├──────────────────────────────────────────────────────────────────────┤
│  React 19 UI                                                         │
│  components/         канвас-редактор · DataGrid · граф · треды       │
│  components/blocks/  по компоненту на тип блока                      │
├──────────────────────────────────────────────────────────────────────┤
│  Движок (чистый TypeScript, покрыт тестами)                          │
│  engine/mime.ts          сборка / разбор RFC 5322, CIDs              │
│  engine/vaultStore.ts    граф-хранилище, инвертированный индекс      │
│  engine/desktopStore.ts  Tauri IPC-мост к реальной файловой системе  │
│  engine/offlineAi.ts     детерминированный офлайн Co-Thinker         │
│  engine/markdown.tsx     рендер инлайн-Markdown                      │
├──────────────────────────────────────────────────────────────────────┤
│  Хранилище = ваша папка                                              │
│  vault/*.eml   одно текстовое сообщение на капсулу                   │
│  vault.json    одноразовый снапшот индекса (папка главнее)           │
└──────────────────────────────────────────────────────────────────────┘
```

```text
src/
  engine/                 ядро zero-DB (MIME, хранилище, офлайн-ИИ)
  components/             канвас-редактор, DataGrid, граф, треды, инспектор
  components/blocks/      по компоненту на тип блока
  types.ts                типы капсул / блоков / графа
src-tauri/                Rust-оболочка: файловый IO, диалоги, конфиг пакета
.github/workflows/        ci.yml · release.yml (Windows x64 msi + nsis)
```

## 🔒 Данные и приватность

Всё локально. Ничего не покидает машину: приложение само не делает сетевых вызовов.

| ОС | Расположение vault |
|---|---|
| Windows | `%APPDATA%\com.capsuleos.app\` |
| Linux | `~/.local/share/com.capsuleos.app/` |
| macOS | `~/Library/Application Support/com.capsuleos.app/` |

Внутри: `vault/` с одним `.eml` на капсулу и `vault.json` как кэш-снапшот индекса. Удалите папку — удалите рабочее пространство. Скопируйте — унесите всю базу знаний с собой.

## 🗺 Роадмап

- ✅ v1.0 — блочный канвас, `.eml`-vault, граф, треды, оболочка Tauri
- ✅ v1.1 — точность движка + тесты, настоящий звук, честный бенчмарк, HTML-экспорт, онбординг с пустым хранилищем и FAQ
- ✅ v1.2 — ранжирование поиска по Okapi BM25 с баллами релевантности, Linux-сборки (AppImage / deb) в релизном пайплайне
- ✅ v1.3 — контент-зависимый офлайн Co-Thinker, связанные капсулы по tf-idf
- ✅ v1.4 — слой планирования (повестка, канбан, гантт, календарь), иерархия страниц, импорт писем, фильтры задач
- ✅ v1.5 — переименование в CapsuleCraft + иконки-маскот, native-оболочка на egui (wiki-ссылки, поиск, слежение за папкой)
- ⬜ Воспроизведение аудио и исполнение кода в native-оболочке
- ⬜ GPG-подпись капсул (подлинность мыслей)
- ⬜ Python-ячейки через Pyodide, Rust-ячейки через WASM
- ⬜ Сборки macOS в релизном пайплайне
- ⬜ Опциональная E2E-шифрованная синхронизация vault (папка `.eml` уже переносима)

## 📊 Статус

`v1.5.0` — две оболочки над одним форматом. Веб-приложение (Tauri) работоспособно от начала до конца, движок покрыт suite'ом vitest (MIME round-trip, ранжирование BM25, контент-зависимый офлайн-ИИ, CSV-аналитика, регрессия фантомных вложений, хелперы редактора). Native-оболочка на egui — экспериментальный второй фронтенд со своими cargo-тестами (97 unit-тестов: ссылки, поиск, планирование, история, i18n, CLI, слежение за папкой). Известные шероховатости:

- инсталляторы не подписаны кодовой подписью (SmartScreen предупреждает);
- Python/Rust-ячейки хранятся и версионируются, но не исполняются офлайн (WASM-интерпретаторы не вшиты);
- браузерный бенчмарк парсит 50k синтетических капсул за ~1.3 с — реальный холодный скан папки медленнее;
- native-оболочка пока не воспроизводит аудио и не исполняет код — см. [LIMITATIONS.md](LIMITATIONS.md#native-egui-prototype).

## ⁇ FAQ

**Что такое CapsuleCraft — в двух словах?**
Локальный «рабочий стол для мышления». Каждая мысль — настоящее письмо RFC 5322 (файл `.eml`): блочный редактор вместо Markdown, треды как в почте, граф связей и офлайн Co-Thinker. Никакой базы данных — папка `.eml`-файлов и есть вся база знаний.

**Где физически хранятся мои заметки?**
В десктоп-версии — папка `vault/` внутри каталога данных приложения: по одному `.eml` на капсулу, `vault.json` — только кэш. В браузере — `localStorage`. Положили чужой `.eml` в папку — он появился в хранилище; удалили файл — капсула исчезла.

**Как работают треды и связи?**
Ответ на мысль — это дочерний `.eml` с заголовками `In-Reply-To` / `References` — ровно как в email. [[викилинки]] дают обратные ссылки (backlinks), а Graph DAG и Thought Threads показывают всё дерево размышления.

**Как записать голосовую заметку?**
Наберите `/` в редакторе, выберите *Audio note* и нажмите запись: звук пишется с микрофона прямо в приложение (MediaRecorder) и сохраняется как MIME-вложение webm/opus с реальной длительностью и волной. Полностью офлайн.

**Куда отправляются мои данные?**
Никуда. Разбор MIME, поиск, бенчмарк и Co-Thinker работают локально — ни сети, ни телеметрии, ни API-ключей. Выдерните шнур — всё продолжит работать.

**Как сделать резервную копию?**
«Export Vault» в сайдбаре собирает ZIP со всеми `.eml` — или просто скопируйте папку `vault/`, это и есть вся база.

**Почему `.eml`, а не база данных?**
`.eml` — открытый стандарт, который старше многих NoSQL-мод: любой почтовый клиент его прочтёт, git его продиффит, миграции не нужны никогда. База данных умирает вместе с приложением, письма — нет.

## 🤝 Участие в разработке

Issues и PR приветствуются — см. [CONTRIBUTING.md](CONTRIBUTING.md). Изменения отслеживаются в [CHANGELOG.md](CHANGELOG.md).

<div align="center">

**CapsuleCraft** — ваши мысли, хранящиеся как почта.

[Скачать](https://github.com/kostyk348/CapsuleCraft/releases/latest) · [Changelog](CHANGELOG.md) · [Сообщить о баге](https://github.com/kostyk348/CapsuleCraft/issues) · [Лицензия MIT](LICENSE)

</div>
