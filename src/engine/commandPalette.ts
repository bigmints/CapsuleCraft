/**
 * Command-palette ranking — deterministic, dependency-free.
 *
 * The palette mixes three kinds of entries: navigation (views), actions
 * (new capsule, export, benchmark…) and capsules (BM25-ranked by the vault
 * store). This module ranks the static commands; capsules keep their BM25
 * order and are simply appended after a non-empty query.
 */

export interface PaletteCommand {
  id: string;
  title: string;
  /** Secondary line shown under the title. */
  hint?: string;
  /** Section header in the UI. */
  group: string;
  /** Extra searchable words (English/Russian synonyms, aliases). */
  keywords?: string[];
  /** Displayed key binding, e.g. "⌘K". */
  shortcut?: string;
}

export interface RankedCommand<T extends PaletteCommand = PaletteCommand> {
  command: T;
  score: number;
}

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[⌘⌥⇧⌃]/g, '')
    .trim();

/** "Graph DAG" → "gd" — lets users type the initials of a command. */
export function acronym(title: string): string {
  return normalize(title)
    .split(/[\s\-_/·—()]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('');
}

/**
 * Score one command against a query. 0 means "does not match".
 * Every query token must be present somewhere — no partial-noise results.
 */
export function scoreCommand(query: string, command: PaletteCommand): number {
  const q = normalize(query);
  if (!q) return 1;

  const title = normalize(command.title);
  const keywords = normalize((command.keywords || []).join(' '));
  const group = normalize(command.group);
  const hint = normalize(command.hint || '');
  const haystack = `${title} ${keywords} ${group} ${hint}`;
  const tokens = q.split(/\s+/).filter(Boolean);
  const compactQuery = q.replace(/\s+/g, '');
  const acr = acronym(command.title);
  const acronymHit = compactQuery.length > 0 && acr.startsWith(compactQuery);
  if (!tokens.every((t) => haystack.includes(t)) && !acronymHit) return 0;

  let score = 0;
  for (const token of tokens) {
    if (title === token) score += 70;
    else if (title.startsWith(token)) score += 55;
    else if (new RegExp(`(^|[\\s\\-_/·—])${escapeRegExp(token)}`).test(title)) score += 40;
    else if (title.includes(token)) score += 25;
    else if (keywords.startsWith(token)) score += 22;
    else if (keywords.includes(token)) score += 14;
    else if (group.includes(token)) score += 8;
    else score += 4;
  }

  // Whole-query bonuses.
  if (title.startsWith(q)) score += 30;
  if (acronymHit) score += 35;

  return score;
}

/** Rank commands by score (desc), ties broken by title for determinism. */
export function rankCommands<T extends PaletteCommand>(
  query: string,
  commands: T[],
  limit = 50,
): Array<RankedCommand<T>> {
  return commands
    .map((command) => ({ command, score: scoreCommand(query, command) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
    .slice(0, limit);
}

export interface HighlightSegment {
  text: string;
  hit: boolean;
}

/** Split text into highlighted/normal segments for every query token. */
export function highlightMatches(text: string, query: string): HighlightSegment[] {
  const tokens = normalize(query)
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (!text || tokens.length === 0) return [{ text, hit: false }];

  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(token, from);
      if (idx === -1) break;
      ranges.push([idx, idx + token.length]);
      from = idx + token.length;
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r] as [number, number]);
  }

  const out: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) out.push({ text: text.slice(cursor, start), hit: false });
    out.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
