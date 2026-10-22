import { describe, it, expect } from 'vitest';
import { shouldOpenSlashMenu, blockPlainText, makeSnippet } from '../textUtils';

describe('shouldOpenSlashMenu', () => {
  it('opens at the start of the text', () => {
    expect(shouldOpenSlashMenu('', 0)).toBe(true);
  });

  it('opens after whitespace or newline', () => {
    expect(shouldOpenSlashMenu('say ', 4)).toBe(true);
    expect(shouldOpenSlashMenu('line\n', 5)).toBe(true);
    expect(shouldOpenSlashMenu('tab\t', 4)).toBe(true);
  });

  it('never opens mid-word (and/or, dates, urls)', () => {
    expect(shouldOpenSlashMenu('and', 3)).toBe(false);
    expect(shouldOpenSlashMenu('10', 2)).toBe(false);
    expect(shouldOpenSlashMenu('https://', 8)).toBe(false);
  });
});

describe('blockPlainText', () => {
  it('flattens every text-bearing block and strips wikilink brackets', () => {
    const text = blockPlainText([
      { id: '1', type: 'heading', data: { level: 1, text: 'Title' } },
      { id: '2', type: 'paragraph', data: { text: 'См. [[CapsuleOS Genesis]]' } },
      { id: '3', type: 'callout', data: { title: 'Note', content: 'Body', tone: 'blue' } },
      { id: '4', type: 'todo_list', data: { items: [{ id: 't', text: 'Ship it', done: false }] } },
    ] as any);
    expect(text).toContain('Title');
    expect(text).toContain('См. CapsuleOS Genesis');
    expect(text).toContain('Note');
    expect(text).toContain('Body');
    expect(text).toContain('Ship it');
    expect(text).not.toContain('[[');
  });

  it('returns an empty string for missing blocks', () => {
    expect(blockPlainText(undefined)).toBe('');
  });
});

describe('makeSnippet', () => {
  const long =
    'Модель показывает устойчивый рост LTV/CAC при масштабировании каналов. ' +
    'Проводим стресс-тестирование с когортами Q4 и фиксируем инвариант протокола.';

  it('centres the excerpt on the first match and marks it', () => {
    const segs = makeSnippet(long, ['стресс']);
    const hit = segs.find((s) => s.hit);
    expect(hit?.text.toLowerCase()).toBe('стресс');
    expect(segs.map((s) => s.text).join('')).toContain('стресс');
  });

  it('adds an ellipsis when the text is cut', () => {
    const segs = makeSnippet(long, ['Q4'], 20);
    expect(segs[0].text === '…' || segs[segs.length - 1].text === '…').toBe(true);
  });

  it('falls back to the beginning when nothing matches', () => {
    const segs = makeSnippet(long, ['zzz'], 30);
    expect(segs.every((s) => !s.hit)).toBe(true);
    expect(segs.map((s) => s.text).join('').length).toBeGreaterThan(0);
  });

  it('returns no segments for empty text', () => {
    expect(makeSnippet('   ', ['x'])).toEqual([]);
  });
});
