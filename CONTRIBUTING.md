# Contributing to CapsuleCraft

[English](#english) · [Русский](#русский)

---

## English

Thanks for taking the time to help. CapsuleCraft is small on purpose — please keep changes focused.

### Ground rules

1. **The `.eml` format is the contract.** A capsule must stay valid RFC 5322 + MIME. Never introduce a side channel that only CapsuleCraft can read.
2. **No new runtime infrastructure.** No database, no server, no telemetry, no external API calls at runtime.
3. **Local-first.** Offline behaviour is the default path, not a fallback.
4. **Zero-DB, not zero-structure.** If a feature needs state, it goes into the capsule or the vault folder.

### Getting started

```bash
git clone https://github.com/kostyk348/capsuleos.git
cd capsuleos
npm ci
npm run tauri:dev
```

Requirements: Rust 1.77.2+, Node.js 20+, platform WebView (WebView2 / WebKitGTK / WKWebView).

### Before you open a PR

```bash
npm run typecheck                  # TypeScript
npm run build                      # Vite build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

CI runs exactly these checks on Linux plus a Windows release build on tags.

### Style

- TypeScript/React: functional components, hooks, no `any` in new engine code.
- Rust: `cargo fmt` defaults, no `unwrap()` on user-controlled paths.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `chore:`, `ci:`.
- UI copy: English and Russian strings should stay consistent if you touch labels.

### Adding a block type

1. Add the data interface to `src/types.ts` and extend `BlockType`.
2. Add the component in `src/components/blocks/`.
3. Register the renderer in the canvas editor and the slash-command menu.
4. Extend the MIME builder/parser in `src/engine/mime.ts` if the block needs new parts.
5. Check that an exported `.eml` round-trips back into the same capsule.

### Reporting bugs

Use the issue templates. Useful details: OS, CapsuleCraft version, what you expected, what happened, and — if possible — the offending `.eml` with private content removed.

Security issues: please do **not** open a public issue, mail the maintainer instead.

---

## Русский

Спасибо, что помогаете. Проект намеренно небольшой — держите изменения сфокусированными.

### Основные правила

1. **Формат `.eml` — это контракт.** Капсула должна оставаться валидным RFC 5322 + MIME. Никаких побочных каналов, читаемых только CapsuleCraft.
2. **Никакой новой инфраструктуры.** Ни БД, ни сервера, ни телеметрии, ни внешних API в рантайме.
3. **Local-first.** Офлайновое поведение — основной путь, а не запасной.
4. **Zero-DB, но не zero-structure.** Нужно состояние — оно едет в капсуле или в папке хранилища.

### Начало работы

```bash
git clone https://github.com/kostyk348/capsuleos.git
cd capsuleos
npm ci
npm run tauri:dev
```

Требования: Rust 1.77.2+, Node.js 20+, WebView платформы (WebView2 / WebKitGTK / WKWebView).

### Перед PR

```bash
npm run typecheck
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

CI гоняет ровно эти проверки на Linux, плюс релизную сборку под Windows на тегах.

### Стиль

- TypeScript/React: функциональные компоненты, хуки, без `any` в новом коде движка.
- Rust: дефолты `cargo fmt`, без `unwrap()` на путях, приходящих от пользователя.
- Коммиты: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `chore:`, `ci:`.
- Тексты интерфейса: если трогаете подписи, держите английский и русский варианты согласованными.

### Новый тип блока

1. Добавьте интерфейс данных в `src/types.ts` и расширьте `BlockType`.
2. Добавьте компонент в `src/components/blocks/`.
3. Зарегистрируйте рендер в канвас-редакторе и в меню слэш-команд.
4. Расширьте сборщик/парсер MIME в `src/engine/mime.ts`, если блоку нужны новые части.
5. Проверьте, что экспортированный `.eml` читается обратно в ту же капсулу.

### Баг-репорты

Используйте шаблоны issue. Полезно указать: ОС, версию CapsuleCraft, ожидаемое и фактическое поведение, а по возможности — проблемный `.eml` без приватных данных.

Об уязвимостях: **не** открывайте публичный issue, напишите мейнтейнеру.
