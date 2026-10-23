// FAQ & onboarding — shown when the vault is empty (fresh install) and
// available anytime from the navbar help button. Replaces the old demo seed:
// a new vault now starts empty, and the FAQ explains the workflow instead.
import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Mic,
  PackageOpen,
  Waypoints,
  X,
} from 'lucide-react';

/** Inline code chip inside FAQ answers. */
const C: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="font-mono text-[11.5px] bg-slate-800/80 text-cyan-300 px-1.5 py-0.5 rounded">
    {children}
  </code>
);

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

// NOTE: [[ / ]] placeholders are replaced with real double square
// brackets at build time by scripts/fix-wikilink-brackets.mjs — the dev
// toolchain eats "["+letter sequences in file writes, so they are written
// indirectly on purpose.
export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Что такое CapsuleCraft — в двух словах?',
    a: (
      <>
        Локальный «рабочий стол для мышления». Каждая мысль — настоящее письмо
        RFC 5322 (файл .eml): блочный редактор вместо Markdown, треды как в
        почте, граф связей и офлайн Co-Thinker. Никакой базы данных — папка
        .eml файлов и есть вся ваша база знаний.
      </>
    ),
  },
  {
    q: 'Где физически хранятся мои заметки?',
    a: (
      <>
        В десктоп-версии — папка <C>vault</C> внутри каталога данных приложения:
        по одному .eml на капсулу, <C>vault.json</C> — только кэш. В браузере —
        localStorage. Положили чужой .eml в папку — он появится в хранилище;
        удалили файл — капсула исчезла. Формат читается Apple Mail и Thunderbird.
      </>
    ),
  },
  {
    q: 'С чего начать, если хранилище пусто?',
    a: (
      <>
        Нажмите «Новая .eml» — и пишите блоками: текст, таблицы, холст, код,
        аудио. Есть письма уже где-то ещё — «Импорт .eml». Хотите сначала
        посмотреть, как всё выглядит, — «Загрузить демо-хранилище» создаст пять
        связанных капсул со всеми типами блоков; удалить каждую можно в один
        клик, когда наиграетесь.
      </>
    ),
  },
  {
    q: 'Как работают треды и связи между мыслями?',
    a: (
      <>
        Ответ на мысль — это дочерняя .eml с заголовками <C>In-Reply-To</C> и{' '}
        <C>References</C>, ровно как в email-переписке. [[Викилинки]]
        дают обратные ссылки (backlinks), а Graph DAG и Thought Threads
        показывают структуру размышления целиком — от корня до последнего
        контраргумента.
      </>
    ),
  },
  {
    q: 'Как записать голосовую заметку?',
    a: (
      <>
        В редакторе наберите <C>/</C> и выберите Audio note, затем нажмите
        кнопку записи: звук пишется с микрофона прямо в приложение
        (MediaRecorder), сохраняется как MIME-вложение webm/opus с реальной
        длительностью и волной. Всё офлайн — внешний диктофон не нужен.
      </>
    ),
  },
  {
    q: 'Куда отправляются мои данные?',
    a: (
      <>
        Никуда. Разбор MIME, поиск, бенчмарк и Co-Thinker работают локально —
        ни сети, ни телеметрии, ни API-ключей. Можете отключить интернет: всё
        продолжит работать как работало.
      </>
    ),
  },
  {
    q: 'Как сделать резервную копию?',
    a: (
      <>
        «Export Vault» в сайдбаре собирает ZIP со всеми .eml, либо просто
        скопируйте папку <C>vault</C> — это и есть вся база. Файлы открываются
        в почтовых клиентах, дружат с git и проживут дольше самого приложения.
      </>
    ),
  },
  {
    q: 'Почему .eml, а не база данных?',
    a: (
      <>
        .eml — открытый стандарт, который старше многих NoSQL-мод: он читается
        любым почтовым клиентом, диффится в git и не требует миграций. База
        данных умирает вместе с приложением, а письма — остаются.
      </>
    ),
  },
];

/** Accordion list of FAQ_ITEMS (shared by the empty state and the modal). */
export const FaqList: React.FC = () => {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      {FAQ_ITEMS.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpenIdx(open ? -1 : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-slate-800/40 transition-colors"
            >
              <span
                className={`text-sm font-medium transition-colors ${
                  open ? 'text-cyan-300' : 'text-slate-200'
                }`}
              >
                {item.q}
              </span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 transition-transform ${
                  open ? 'rotate-180 text-cyan-400' : 'text-slate-500'
                }`}
              />
            </button>
            {open && (
              <div className="px-5 pb-4 text-[13px] leading-relaxed text-slate-400">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface EmptyVaultProps {
  onCreateNew: () => void;
  onImportEml: (file: File) => void;
}

const QUICK_STEPS = [
  {
    icon: FilePlus2,
    title: '1. Создайте капсулу',
    text: 'Кнопка «Новая .eml» — и пишите блоками: / открывает таблицы, холст, код и аудио.',
  },
  {
    icon: Waypoints,
    title: '2. Свяжите мысли',
    text: 'Create Re: .eml порождает дочернюю капсулу с In-Reply-To; [[викилинки]] дают backlinks.',
  },
  {
    icon: Mic,
    title: '3. Добавьте голос',
    text: 'Audio note пишет с микрофона и сохраняет звук как настоящее MIME-вложение.',
  },
];

/** Full-page onboarding shown instead of the editor while the vault is empty. */
export const EmptyVaultState: React.FC<EmptyVaultProps> = ({
  onCreateNew,
  onImportEml,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10 pb-16 select-text">
        {/* Hero */}
        <div className="text-center mb-9">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)] mb-5">
            <PackageOpen className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Хранилище пусто — и это нормально
          </h1>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">
            CapsuleCraft не создаёт демо-заметок: ваша база знаний начинается с
            чистого vault. Каждая мысль здесь — настоящий .eml файл (RFC 5322),
            который всегда можно открыть в почтовом клиенте, отдать другому
            человеку или положить в git. Вместо свалки примеров — короткий FAQ.
          </p>
        </div>

        {/* Primary actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <button
            type="button"
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow-[0_0_14px_rgba(6,182,212,0.35)] transition-all active:scale-95"
          >
            <FilePlus2 className="w-4 h-4" />
            Новая .eml
          </button>
          <button
            type="button"
            onClick={() => {
              const el = fileRef.current;
              if (el) el.click();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 text-sm font-medium transition-all active:scale-95"
          >
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            Импорт .eml
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".eml,message/rfc822"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              const f = files ? files.item(0) : null;
              if (f) onImportEml(f);
              e.target.value = '';
            }}
          />
        </div>

        {/* Quick start steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {QUICK_STEPS.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <s.icon className="w-4 h-4 text-cyan-400 mb-2.5" />
              <h3 className="text-xs font-bold text-slate-200 mb-1.5">{s.title}</h3>
              <p className="text-[12px] leading-relaxed text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold tracking-[0.2em] text-slate-300 font-mono uppercase">
            FAQ — частые вопросы
          </h2>
        </div>
        <FaqList />
      </div>
    </div>
  );
};

/** Help modal — FAQ is reachable from the navbar at any time. */
export const FaqModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="FAQ"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white">FAQ — частые вопросы</h2>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                CapsuleCraft knowledge vault
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <FaqList />
          <p className="mt-5 text-[11px] text-slate-600 font-mono text-center">
            Больше деталей — в README и CONTRIBUTING на GitHub.
          </p>
        </div>
      </div>
    </div>
  );
};
