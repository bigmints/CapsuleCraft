import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  Flag,
  ListTodo,
  Plus,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { CapsuleNode, TodoItem, TodoPriority } from '../types';
import {
  bucketOf,
  buildIcs,
  collectTasks,
  groupTasks,
  humanDate,
  icsFileName,
  monthGrid,
  monthLabel,
  parseDateKey,
  PlannedTask,
  taskStats,
  tasksOnDay,
  toDateKey,
  type BucketId,
} from '../engine/planning';
import { useI18n, type TranslationKey } from '../i18n';

interface Props {
  nodes: CapsuleNode[];
  onOpenCapsule: (messageId: string) => void;
  onToggleTask: (capsuleId: string, blockId: string, itemId: string) => void;
  onUpdateTask: (capsuleId: string, blockId: string, itemId: string, patch: Partial<TodoItem>) => void;
  /** Adds the task to the vault's inbox capsule (created on demand). */
  onAddTask: (text: string, due?: string, priority?: TodoPriority) => void;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const PRIORITY_KEY: Record<TodoPriority, TranslationKey> = {
  high: 'priority.high',
  normal: 'priority.normal',
  low: 'priority.low',
};

const BUCKET_KEY: Record<BucketId, TranslationKey> = {
  overdue: 'bucket.overdue',
  today: 'bucket.today',
  tomorrow: 'bucket.tomorrow',
  week: 'bucket.week',
  later: 'bucket.later',
  none: 'bucket.none',
  done: 'bucket.done',
};

const PRIORITY_CLASS: Record<TodoPriority, string> = {
  high: 'text-rose-300 bg-rose-950/60 border-rose-800/60',
  normal: 'text-slate-400 bg-slate-900 border-slate-700',
  low: 'text-slate-500 bg-slate-900 border-slate-800',
};

const BUCKET_ACCENT: Record<string, string> = {
  overdue: 'text-rose-400',
  today: 'text-cyan-300',
  tomorrow: 'text-sky-300',
  week: 'text-indigo-300',
  later: 'text-slate-400',
  none: 'text-slate-500',
  done: 'text-emerald-400',
};

function downloadText(fileName: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const PlanningView: React.FC<Props> = ({
  nodes,
  onOpenCapsule,
  onToggleTask,
  onUpdateTask,
  onAddTask,
}) => {
  const { t } = useI18n();
  const today = useMemo(() => toDateKey(new Date()), []);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickDue, setQuickDue] = useState(today);
  const [quickPriority, setQuickPriority] = useState<TodoPriority>('normal');

  const tasks = useMemo(() => collectTasks(nodes), [nodes]);
  const stats = useMemo(() => taskStats(tasks, today), [tasks, today]);
  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const currentMonth = useMemo(
    () => new Date(cursor.year, cursor.month, 1).getMonth(),
    [cursor],
  );

  /** Open tasks per day, for the calendar dots. */
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.item.done || !task.item.due) continue;
      map.set(task.item.due, (map.get(task.item.due) || 0) + 1);
    }
    return map;
  }, [tasks]);

  const sections = useMemo(() => {
    const visible = showDone ? tasks : tasks.filter((t) => !t.item.done);
    return groupTasks(visible, today);
  }, [tasks, today, showDone]);

  const focusTasks = focusDay ? tasksOnDay(tasks, focusDay, showDone) : [];

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setFocusDay(today);
  };

  const submitQuickAdd = (event?: React.FormEvent) => {
    event?.preventDefault();
    const text = quickText.trim();
    if (!text) return;
    onAddTask(text, quickDue || undefined, quickPriority);
    setQuickText('');
  };

  const exportIcs = () => {
    const ics = buildIcs(tasks, { includeCompleted: showDone, calendarName: 'CapsuleOS Planning' });
    downloadText(icsFileName(), ics, 'text/calendar;charset=utf-8');
  };

  const renderTask = (task: PlannedTask) => {
    const overdue = !task.item.done && bucketOf(task, today) === 'overdue';
    return (
      <div
        key={`${task.blockId}:${task.item.id}`}
        className="group flex items-start gap-2.5 px-3 py-2 rounded-lg border border-transparent hover:border-slate-700/70 hover:bg-slate-900/60 transition-colors"
      >
        <button
          type="button"
          onClick={() => onToggleTask(task.capsuleId, task.blockId, task.item.id)}
          className="mt-0.5 shrink-0 text-slate-500 hover:text-cyan-300 transition-colors"
          title={task.item.done ? t('planning.markUndone') : t('planning.markDone')}
        >
          {task.item.done ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div
            className={`text-sm leading-snug break-words ${
              task.item.done ? 'text-slate-500 line-through' : 'text-slate-200'
            }`}
          >
            {task.item.text}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => onOpenCapsule(task.capsuleId)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-800/60 max-w-[240px]"
              title={t('planning.openCapsule', { subject: task.capsuleSubject })}
            >
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{task.capsuleSubject}</span>
            </button>
            {task.item.due && (
              <span
                className={`px-1.5 py-0.5 rounded border ${
                  overdue
                    ? 'text-rose-300 bg-rose-950/50 border-rose-900/60'
                    : 'text-slate-400 bg-slate-900 border-slate-800'
                }`}
              >
                {humanDate(task.item.due)}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                PRIORITY_CLASS[(task.item.priority || 'normal') as TodoPriority]
              }`}
              title={`${t('planning.priorityTitle')}: ${t(PRIORITY_KEY[(task.item.priority || 'normal') as TodoPriority])}`}
            >
              <Flag className="w-2.5 h-2.5" />
              {task.item.priority === 'high' ? 'high' : task.item.priority === 'low' ? 'low' : 'norm'}
            </span>
          </div>
        </div>

        <input
          type="date"
          value={task.item.due || ''}
          onChange={(event) =>
            onUpdateTask(task.capsuleId, task.blockId, task.item.id, {
              due: event.target.value || undefined,
            })
          }
          className="shrink-0 w-[118px] text-[10px] font-mono bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity [color-scheme:dark]"
          title={t('planning.dueTitle')}
        />

        <select
          value={task.item.priority || 'normal'}
          onChange={(event) =>
            onUpdateTask(task.capsuleId, task.blockId, task.item.id, {
              priority: event.target.value as TodoPriority,
            })
          }
          className="shrink-0 text-[10px] font-mono bg-slate-900 border border-slate-800 rounded px-1 py-1 text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          title={t('planning.priorityTitle')}
        >
          {(Object.keys(PRIORITY_KEY) as TodoPriority[]).map((value) => (
            <option key={value} value={value}>
              {t(PRIORITY_KEY[value])}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-950">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-cyan-400" />
              {t('planning.title')}
            </h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              {t('planning.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className={`text-[11px] font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${
                showDone
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-700/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {showDone ? t('planning.hideDone') : t('planning.showDone')}
            </button>
            <button
              type="button"
              onClick={exportIcs}
              disabled={tasks.length === 0}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-cyan-300 hover:border-cyan-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={t('planning.exportTitle')}
            >
              <Download className="w-3.5 h-3.5" />
              {t('planning.export')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { label: t('planning.stat.open'), value: stats.open, icon: ListTodo, tone: 'text-slate-200' },
            { label: t('planning.stat.overdue'), value: stats.overdue, icon: AlertTriangle, tone: stats.overdue ? 'text-rose-400' : 'text-slate-200' },
            { label: t('planning.stat.today'), value: stats.today, icon: Sun, tone: stats.today ? 'text-cyan-300' : 'text-slate-200' },
            { label: t('planning.stat.done'), value: `${stats.completionRate}%`, icon: Check, tone: 'text-emerald-400' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 flex items-center gap-3"
            >
              <Icon className={`w-4 h-4 ${tone}`} />
              <div>
                <div className={`text-lg font-bold leading-none font-mono ${tone}`}>{value}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_1fr] gap-4 items-start">
          {/* Month calendar */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
                title={t('planning.prevMonth')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200 capitalize">
                  {monthLabel(cursor.year, cursor.month)}
                </span>
                <button
                  type="button"
                  onClick={goToday}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-700/60"
                  title={t('planning.goToday')}
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
                title={t('planning.nextMonth')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-[10px] font-mono text-slate-600 pb-1">
                  {day}
                </div>
              ))}
              {cells.map((key) => {
                const date = Number(key.slice(8, 10));
                const inMonth = parseDateKey(key)?.getMonth() === currentMonth;
                const count = countByDay.get(key) || 0;
                const isToday = key === today;
                const selected = key === focusDay;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFocusDay((prev) => (prev === key ? null : key))}
                    className={`relative h-9 rounded-md text-[11px] font-mono border transition-colors ${
                      selected
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                        : isToday
                          ? 'border-cyan-700/60 text-cyan-300 hover:bg-slate-800'
                          : inMonth
                            ? 'border-transparent text-slate-300 hover:bg-slate-800'
                            : 'border-transparent text-slate-700 hover:bg-slate-800/50'
                    }`}
                    title={count ? t('planning.dayTitle', { day: key, count }) : key}
                  >
                    {date}
                    {count > 0 && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {Array.from({ length: Math.min(count, 3) }).map((_, index) => (
                          <span
                            key={index}
                            className={`w-1 h-1 rounded-full ${
                              key < today ? 'bg-rose-400' : key === today ? 'bg-cyan-300' : 'bg-slate-400'
                            }`}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" /> {t('planning.legendToday')}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> {t('planning.legendOverdue')}
              </span>
            </div>
          </div>

          {/* Quick add + agenda */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 min-h-[420px]">
            <form onSubmit={submitQuickAdd} className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Plus className="w-4 h-4 text-cyan-400 shrink-0" />
                <input
                  value={quickText}
                  onChange={(event) => setQuickText(event.target.value)}
                  placeholder={t('planning.quickPlaceholder')}
                  className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                />
              </div>
              <input
                type="date"
                value={quickDue}
                onChange={(event) => setQuickDue(event.target.value)}
                className="text-[11px] font-mono bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 [color-scheme:dark]"
                title={t('planning.dueTitle')}
              />
              <select
                value={quickPriority}
                onChange={(event) => setQuickPriority(event.target.value as TodoPriority)}
                className="text-[11px] font-mono bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300"
                title={t('planning.priorityTitle')}
              >
                {(Object.keys(PRIORITY_KEY) as TodoPriority[]).map((value) => (
                  <option key={value} value={value}>
                    {t(PRIORITY_KEY[value])}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!quickText.trim()}
                className="text-[11px] font-mono px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('planning.add')}
              </button>
            </form>

            {focusDay ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {humanDate(focusDay)}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setFocusDay(null)}
                    className="text-[10px] font-mono text-slate-500 hover:text-cyan-300"
                  >
                    {t('planning.showAll')}
                  </button>
                </div>
                {focusTasks.length === 0 ? (
                  <p className="text-xs text-slate-600 font-mono py-6 text-center">
                    {t('planning.dayEmpty')}
                  </p>
                ) : (
                  <div className="space-y-0.5">{focusTasks.map(renderTask)}</div>
                )}
              </div>
            ) : sections.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <ListTodo className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="text-sm text-slate-400">{t('planning.emptyTitle')}</p>
                <p className="text-[11px] text-slate-600 font-mono max-w-sm mx-auto">
                  {t('planning.emptyHint', { command: '/todo' })}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sections.map((section) => (
                  <div key={section.id}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <h3
                        className={`text-[11px] font-semibold uppercase tracking-wider ${
                          BUCKET_ACCENT[section.id] || 'text-slate-400'
                        }`}
                      >
                        {t(BUCKET_KEY[section.id])}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-600">
                        {section.tasks.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">{section.tasks.map(renderTask)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
