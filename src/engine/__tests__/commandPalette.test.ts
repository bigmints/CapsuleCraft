import { describe, it, expect } from 'vitest';
import {
  acronym,
  scoreCommand,
  rankCommands,
  highlightMatches,
  type PaletteCommand,
} from '../commandPalette';

const cmd = (over: Partial<PaletteCommand>): PaletteCommand => ({
  id: 'x',
  title: 'Something',
  group: 'Actions',
  ...over,
});

describe('command palette ranking', () => {
  it('builds acronyms from titles', () => {
    expect(acronym('Graph DAG')).toBe('gd');
    expect(acronym('Open MIME Source')).toBe('oms');
  });

  it('matches everything on an empty query', () => {
    expect(scoreCommand('', cmd({ title: 'Anything' }))).toBeGreaterThan(0);
  });

  it('ranks exact and prefix title matches above loose ones', () => {
    const exact = scoreCommand('graph', cmd({ title: 'Graph DAG' }));
    const loose = scoreCommand('graph', cmd({ title: 'Open capsule', hint: 'graph view' }));
    expect(exact).toBeGreaterThan(loose);
    expect(loose).toBeGreaterThan(0);
  });

  it('requires every token to be present', () => {
    expect(scoreCommand('graph tunnel', cmd({ title: 'Graph DAG' }))).toBe(0);
  });

  it('supports acronyms and keywords', () => {
    expect(scoreCommand('gd', cmd({ title: 'Graph DAG' }))).toBeGreaterThan(0);
    expect(scoreCommand('bm25', cmd({ title: 'Search', keywords: ['bm25', 'поиск'] }))).toBeGreaterThan(0);
  });

  it('is deterministic on ties', () => {
    const commands = [
      cmd({ id: 'b', title: 'Beta view', group: 'Views' }),
      cmd({ id: 'a', title: 'Alpha view', group: 'Views' }),
    ];
    const ranked = rankCommands('view', commands);
    expect(ranked.map((r) => r.command.id)).toEqual(['a', 'b']);
  });

  it('drops entries with no match and respects the limit', () => {
    const commands = [
      cmd({ id: 'a', title: 'Alpha' }),
      cmd({ id: 'b', title: 'Beta' }),
      cmd({ id: 'c', title: 'Alphabet' }),
    ];
    const ranked = rankCommands('alpha', commands, 1);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].command.title === 'Alpha' || ranked[0].command.title === 'Alphabet').toBe(true);
  });
});

describe('highlightMatches', () => {
  it('returns one plain segment when the query is empty', () => {
    expect(highlightMatches('hello', '')).toEqual([{ text: 'hello', hit: false }]);
  });

  it('marks matched ranges case-insensitively', () => {
    const segs = highlightMatches('Capsule graph', 'GRAPH');
    expect(segs).toEqual([
      { text: 'Capsule ', hit: false },
      { text: 'graph', hit: true },
    ]);
  });

  it('merges overlapping ranges', () => {
    const segs = highlightMatches('abcdef', 'abc bcd');
    expect(segs.map((s) => s.text).join('')).toBe('abcdef');
    expect(segs.filter((s) => s.hit)).toHaveLength(1);
    expect(segs.find((s) => s.hit)?.text).toBe('abcd');
  });
});
