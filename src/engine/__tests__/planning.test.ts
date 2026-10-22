import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildIcs,
  bucketOf,
  collectTasks,
  daysBetween,
  escapeIcsText,
  foldIcsLine,
  groupTasks,
  isDateKey,
  monthGrid,
  parseDateKey,
  taskStats,
  tasksOnDay,
  toDateKey,
} from '../planning';
import type { CapsuleNode, TodoItem } from '../../types';
import type { PlannedTask } from '../planning';

const capsule = (id: string, items: TodoItem[], tags: string[] = ['#work']): CapsuleNode => ({
  messageId: id,
  subject: `Capsule ${id}`,
  from: 'a@local',
  to: 'b@local',
  date: 'Thu, 22 Oct 2026 10:00:00 GMT',
  timestamp: 0,
  references: [],
  tags,
  status: 'Active',
  fileName: `${id}.eml`,
  blocks: [
    { id: `blk_${id}`, type: 'todo_list', data: { title: 'Tasks', items } },
    { id: `blk_${id}_p`, type: 'paragraph', data: { text: 'ignore me' } },
  ],
  attachments: [],
});

const task = (id: string, text: string, done = false, due?: string): PlannedTask => ({
  capsuleId: 'c1',
  capsuleSubject: 'Capsule c1',
  capsuleTags: ['#work'],
  blockId: 'blk_c1',
  blockTitle: 'Tasks',
  item: { id, text, done, due },
});

describe('calendar day keys', () => {
  it('formats local dates without timezone drift', () => {
    expect(toDateKey(new Date(2026, 9, 22, 23, 30))).toBe('2026-10-22');
    expect(toDateKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });

  it('rejects malformed or impossible dates', () => {
    expect(isDateKey('2026-10-22')).toBe(true);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(isDateKey('2026-02-31')).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
    expect(parseDateKey('nope')).toBeNull();
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29'); // EU DST switch
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts whole days between keys', () => {
    expect(daysBetween('2026-10-22', '2026-10-22')).toBe(0);
    expect(daysBetween('2026-10-22', '2026-10-25')).toBe(3);
    expect(daysBetween('2026-10-22', '2026-10-21')).toBe(-1);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // DST-safe
  });
});

describe('month grid', () => {
  it('returns 42 Monday-first cells covering the month', () => {
    const cells = monthGrid(2026, 9); // October 2026 starts on Thursday
    expect(cells).toHaveLength(42);
    expect(cells[0]).toBe('2026-09-28'); // Monday before Oct 1
    expect(cells).toContain('2026-10-01');
    expect(cells).toContain('2026-10-31');
    expect(new Set(cells).size).toBe(42);
  });
});

describe('collectTasks', () => {
  it('walks every todo block and ignores other blocks', () => {
    const tasks = collectTasks([
      capsule('c1', [
        { id: 'i1', text: 'One', done: false },
        { id: 'i2', text: 'Two', done: true },
      ]),
      capsule('c2', [{ id: 'i3', text: 'Three', done: false }]),
    ]);
    expect(tasks.map((t) => t.item.id)).toEqual(['i1', 'i2', 'i3']);
    expect(tasks[0].capsuleId).toBe('c1');
    expect(tasks[0].blockTitle).toBe('Tasks');
  });

  it('survives capsules without todo blocks', () => {
    const empty: CapsuleNode = {
      ...capsule('c9', []),
      blocks: [{ id: 'p', type: 'paragraph', data: { text: 'x' } }],
    };
    expect(collectTasks([empty])).toEqual([]);
  });
});

describe('bucketing', () => {
  const today = '2026-10-22';

  it('maps due dates to agenda buckets', () => {
    expect(bucketOf(task('a', 'a', false, '2026-10-21'), today)).toBe('overdue');
    expect(bucketOf(task('b', 'b', false, '2026-10-22'), today)).toBe('today');
    expect(bucketOf(task('c', 'c', false, '2026-10-23'), today)).toBe('tomorrow');
    expect(bucketOf(task('d', 'd', false, '2026-10-25'), today)).toBe('week');
    expect(bucketOf(task('e', 'e', false, '2026-10-29'), today)).toBe('week');
    expect(bucketOf(task('f', 'f', false, '2026-10-30'), today)).toBe('later');
    expect(bucketOf(task('g', 'g', false), today)).toBe('none');
    expect(bucketOf(task('h', 'h', false, 'not-a-date'), today)).toBe('none');
  });

  it('completed tasks always land in done', () => {
    expect(bucketOf(task('a', 'a', true, '2020-01-01'), today)).toBe('done');
    expect(bucketOf(task('b', 'b', true), today)).toBe('done');
  });

  it('groups, sorts by due then priority, and drops empty sections', () => {
    const sections = groupTasks(
      [
        task('later', 'later', false, '2026-12-01'),
        task('todayLow', 'today low', false, '2026-10-22'),
        task('todayHigh', 'today high', false, '2026-10-22'),
        task('done', 'done', true),
      ],
      today,
    );
    expect(sections.map((s) => s.id)).toEqual(['today', 'later', 'done']);
    const todayIds = sections[0].tasks.map((t) => t.item.id);
    expect(todayIds).toContain('todayHigh');
    expect(todayIds).toContain('todayLow');
  });

  it('orders same-day tasks by priority', () => {
    const high = task('h', 'high', false, today);
    high.item.priority = 'high';
    const normal = task('n', 'normal', false, today);
    const low = task('l', 'low', false, today);
    low.item.priority = 'low';
    const [section] = groupTasks([low, normal, high], today);
    expect(section.tasks.map((t) => t.item.id)).toEqual(['h', 'n', 'l']);
  });
});

describe('stats and day filter', () => {
  const today = '2026-10-22';
  const tasks = [
    task('a', 'a', false, '2026-10-20'),
    task('b', 'b', false, today),
    task('c', 'c', true, today),
    task('d', 'd', false, '2026-11-30'),
  ];

  it('counts open, done, overdue and due today', () => {
    expect(taskStats(tasks, today)).toEqual({
      total: 4,
      done: 1,
      open: 3,
      overdue: 1,
      today: 1,
      completionRate: 25,
    });
  });

  it('handles an empty vault without dividing by zero', () => {
    expect(taskStats([], today)).toEqual({
      total: 0,
      done: 0,
      open: 0,
      overdue: 0,
      today: 0,
      completionRate: 0,
    });
  });

  it('filters one day, hiding completed tasks by default', () => {
    expect(tasksOnDay(tasks, today).map((t) => t.item.id)).toEqual(['b']);
    expect(tasksOnDay(tasks, today, true).map((t) => t.item.id)).toEqual(['b', 'c']);
  });
});

describe('ICS export (RFC 5545)', () => {
  it('escapes TEXT special characters', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('folds long lines to 75 octets, never splitting UTF-8', () => {
    const long = 'Задача ' + 'я'.repeat(60) + ' end';
    const folded = foldIcsLine(long);
    expect(folded.length).toBeGreaterThan(1);
    for (const line of folded) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(folded.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    // Joining must restore the original text exactly.
    expect(folded[0] + folded.slice(1).map((l) => l.slice(1)).join('')).toBe(long);
  });

  it('keeps short lines untouched', () => {
    expect(foldIcsLine('SUMMARY:short')).toEqual(['SUMMARY:short']);
  });

  it('emits one VTODO per open task with DUE, STATUS, PRIORITY', () => {
    const high = task('a', 'Ship it', false, '2026-10-22');
    high.item.priority = 'high';
    const ics = buildIcs([high, task('b', 'Done already', true)], {
      now: new Date(Date.UTC(2026, 9, 22, 8, 30, 0)),
    });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTAMP:20261022T083000Z');
    expect(ics).toContain('DUE;VALUE=DATE:20261022');
    expect(ics).toContain('SUMMARY:Ship it');
    expect(ics).toContain('STATUS:NEEDS-ACTION');
    expect(ics).toContain('PRIORITY:1');
    expect(ics.match(/BEGIN:VTODO/g)).toHaveLength(1); // completed excluded
    expect(ics.includes('\n') && !ics.includes('\r\n')).toBe(false);
  });

  it('can include completed tasks', () => {
    const ics = buildIcs([task('b', 'Done already', true, '2026-10-20')], {
      includeCompleted: true,
    });
    expect(ics).toContain('STATUS:COMPLETED');
    expect(ics).toContain('PERCENT-COMPLETE:100');
    expect(ics).toContain('DUE;VALUE=DATE:20261020');
  });

  it('escapes summary text and sanitises UIDs', () => {
    const ics = buildIcs([task('id with spaces', 'a,b; c\nnew line', false, '2026-10-22')]);
    expect(ics).toContain('SUMMARY:a\\,b\\; c\\nnew line');
    expect(ics).toContain('UID:blk_c1.id-with-spaces@capsuleos.local');
  });

  it('omits DUE for undated tasks', () => {
    const ics = buildIcs([task('x', 'someday', false)]);
    expect(ics).not.toContain('DUE');
    expect(ics).toContain('STATUS:NEEDS-ACTION');
  });
});
