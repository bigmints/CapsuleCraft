/**
 * Planning layer — tasks collected out of every capsule's todo blocks.
 *
 * Everything here is pure and deterministic so it can be tested without a DOM.
 * Dates are stored as local calendar days (`YYYY-MM-DD`), not UTC instants:
 * "due Friday" must survive a timezone or DST change unchanged.
 */

import { CapsuleNode, TaskStatus, TodoItem, TodoPriority } from '../types';

export type TaskPriority = TodoPriority;

export interface PlannedTask {
  /** Capsule that owns the todo block. */
  capsuleId: string;
  capsuleSubject: string;
  capsuleTags: string[];
  blockId: string;
  blockTitle?: string;
  item: TodoItem;
}

export type BucketId = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none' | 'done';

export interface TaskSection {
  id: BucketId;
  title: string;
  /** Tasks that belong to this bucket, sorted by due date then priority. */
  tasks: PlannedTask[];
}

export interface TaskStats {
  total: number;
  done: number;
  open: number;
  overdue: number;
  today: number;
  completionRate: number;
}

export const BUCKET_TITLES: Record<BucketId, string> = {
  overdue: 'Просрочено',
  today: 'Сегодня',
  tomorrow: 'Завтра',
  week: 'На этой неделе',
  later: 'Позже',
  none: 'Без даты',
  done: 'Выполнено',
};

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Local calendar day key, e.g. `2026-10-22`. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Parse `YYYY-MM-DD` as a local midnight; returns null for malformed input. */
export function parseDateKey(key: string | undefined): Date | null {
  if (!key) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function isDateKey(value: string | undefined): boolean {
  return parseDateKey(value) !== null;
}

/** Add (or subtract) whole calendar days, immune to DST hour shifts. */
export function addDays(key: string, days: number): string {
  const base = parseDateKey(key);
  if (!base) return key;
  return toDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

/** Whole days from `from` to `to` (negative when `to` is in the past). */
export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) return 0;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

/** Six-week (42-cell) month grid starting on Monday. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  // getDay(): 0 = Sunday. Shift so Monday is 0.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i += 1) {
    cells.push(toDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }
  return cells;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

export function humanDate(key: string): string {
  const date = parseDateKey(key);
  if (!date) return key;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Every todo item across the vault, with its owning capsule. */
export function collectTasks(capsules: CapsuleNode[]): PlannedTask[] {
  const tasks: PlannedTask[] = [];
  for (const capsule of capsules) {
    for (const block of capsule.blocks) {
      if (block.type !== 'todo_list') continue;
      for (const item of block.data.items || []) {
        tasks.push({
          capsuleId: capsule.messageId,
          capsuleSubject: capsule.subject,
          capsuleTags: capsule.tags || [],
          blockId: block.id,
          blockTitle: block.data.title,
          item,
        });
      }
    }
  }
  return tasks;
}

export function bucketOf(task: PlannedTask, today: string): BucketId {
  if (taskStatus(task.item) === 'done') return 'done';
  const due = task.item.due;
  if (!isDateKey(due)) return 'none';
  const delta = daysBetween(today, due!);
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  if (delta === 1) return 'tomorrow';
  if (delta <= 7) return 'week';
  return 'later';
}

/** Explicit status when present; legacy items only carry the `done` flag. */
export function taskStatus(item: TodoItem): TaskStatus {
  if (item.status) return item.status;
  return item.done ? 'done' : 'todo';
}

/** Kanban columns: fixed order, every task in exactly one column. */
export function groupByStatus(tasks: PlannedTask[]): Record<TaskStatus, PlannedTask[]> {
  const columns: Record<TaskStatus, PlannedTask[]> = { todo: [], doing: [], done: [] };
  for (const task of tasks) {
    columns[taskStatus(task.item)].push(task);
  }
  for (const id of KANBAN_ORDER) columns[id] = sortTasks(columns[id]);
  return columns;
}

export const KANBAN_ORDER: TaskStatus[] = ['todo', 'doing', 'done'];

function compareTasks(a: PlannedTask, b: PlannedTask): number {
  const dueA = isDateKey(a.item.due) ? a.item.due! : '9999-12-31';
  const dueB = isDateKey(b.item.due) ? b.item.due! : '9999-12-31';
  if (dueA !== dueB) return dueA < dueB ? -1 : 1;
  const pa = PRIORITY_WEIGHT[(a.item.priority || 'normal') as TaskPriority] ?? 1;
  const pb = PRIORITY_WEIGHT[(b.item.priority || 'normal') as TaskPriority] ?? 1;
  if (pa !== pb) return pa - pb;
  return a.item.text.localeCompare(b.item.text, 'ru');
}

export function sortTasks(tasks: PlannedTask[]): PlannedTask[] {
  return [...tasks].sort(compareTasks);
}

/** Group tasks into the fixed agenda buckets, skipping empty sections. */
export function groupTasks(tasks: PlannedTask[], today: string): TaskSection[] {
  const order: BucketId[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none', 'done'];
  const buckets = new Map<BucketId, PlannedTask[]>(order.map((id) => [id, []]));
  for (const task of tasks) {
    buckets.get(bucketOf(task, today))!.push(task);
  }
  return order
    .map((id) => ({ id, title: BUCKET_TITLES[id], tasks: sortTasks(buckets.get(id)!) }))
    .filter((section) => section.tasks.length > 0);
}

export function taskStats(tasks: PlannedTask[], today: string): TaskStats {
  let done = 0;
  let overdue = 0;
  let dueToday = 0;
  for (const task of tasks) {
    if (task.item.done) {
      done += 1;
      continue;
    }
    const bucket = bucketOf(task, today);
    if (bucket === 'overdue') overdue += 1;
    if (bucket === 'today') dueToday += 1;
  }
  const total = tasks.length;
  return {
    total,
    done,
    open: total - done,
    overdue,
    today: dueToday,
    completionRate: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/** Tasks due on one specific calendar day (open only, unless asked otherwise). */
export function tasksOnDay(tasks: PlannedTask[], day: string, includeDone = false): PlannedTask[] {
  return sortTasks(tasks.filter((t) => t.item.due === day && (includeDone || !t.item.done)));
}

// ── ICS (RFC 5545) export ─────────────────────────────────────────────────────

const ICS_UID_DOMAIN = 'capsuleos.local';

/** RFC 5545 §3.3.11 TEXT escaping: backslash, semicolon, comma, newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/**
 * RFC 5545 §3.1 line folding: no line may exceed 75 octets (excluding CRLF),
 * continuation lines start with a single space. Multi-byte characters are
 * never split across folds.
 */
export function foldIcsLine(line: string): string[] {
  if (encoder.encode(line).length <= 75) return [line];
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      chunks.push(current);
      current = char;
      bytes = size;
      limit = 74; // continuation lines: 1 octet is consumed by the leading space
    } else {
      current += char;
      bytes += size;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`));
}

const formatUtcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T` +
  `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;

const sanitizeUid = (value: string): string => value.replace(/[^A-Za-z0-9._-]+/g, '-');

export interface IcsOptions {
  /** Injectable clock for deterministic tests. */
  now?: Date;
  calendarName?: string;
  /** Include already completed tasks (STATUS:COMPLETED). Default: false. */
  includeCompleted?: boolean;
}

function icsPriority(priority: TaskPriority | undefined): number {
  switch (priority) {
    case 'high':
      return 1;
    case 'low':
      return 9;
    default:
      return 5;
  }
}

/** Build a VCALENDAR with one VTODO per task. */
export function buildIcs(tasks: PlannedTask[], options: IcsOptions = {}): string {
  const now = options.now || new Date();
  const stamp = formatUtcStamp(now);
  const calendarName = options.calendarName || 'CapsuleOS Planning';
  const selected = options.includeCompleted
    ? tasks
    : tasks.filter((t) => taskStatus(t.item) !== 'done');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CapsuleOS//Planning//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  for (const task of selected) {
    const uid = `${sanitizeUid(task.blockId)}.${sanitizeUid(task.item.id)}@${ICS_UID_DOMAIN}`;
    const summary = task.item.text.trim() || '(без названия)';
    const descriptionParts = [`Капсула: ${task.capsuleSubject}`];
    if (task.blockTitle) descriptionParts.push(`Список: ${task.blockTitle}`);
    if (task.capsuleTags.length) descriptionParts.push(`Теги: ${task.capsuleTags.join(' ')}`);

    lines.push('BEGIN:VTODO');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (isDateKey(task.item.due)) {
      lines.push(`DUE;VALUE=DATE:${task.item.due!.replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`);
    const status = taskStatus(task.item);
    lines.push(`STATUS:${status === 'done' ? 'COMPLETED' : status === 'doing' ? 'IN-PROCESS' : 'NEEDS-ACTION'}`);
    lines.push(`PRIORITY:${icsPriority(task.item.priority as TaskPriority | undefined)}`);
    if (task.capsuleTags.length) {
      lines.push(`CATEGORIES:${task.capsuleTags.map((tag) => escapeIcsText(tag)).join(',')}`);
    }
    if (status === 'done') {
      lines.push('PERCENT-COMPLETE:100');
    }
    lines.push('END:VTODO');
  }

  lines.push('END:VCALENDAR');
  return lines.flatMap(foldIcsLine).join('\r\n') + '\r\n';
}

export function icsFileName(now = new Date()): string {
  return `capsuleos-planning-${toDateKey(now)}.ics`;
}
