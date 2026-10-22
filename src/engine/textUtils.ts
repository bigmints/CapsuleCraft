/**
 * Shared text/caret helpers used by the block editor, the sidebar search
 * results and the command palette.
 */

import type { CapsuleBlock } from '../types';
import { highlightMatches, type HighlightSegment } from './commandPalette';

/**
 * Decide whether pressing "/" should open the slash-command menu.
 * Notion-style discipline: only when the caret sits at the start of a line
 * or right after whitespace — typing "and/or", "10/5" or URLs never opens it.
 */
export function shouldOpenSlashMenu(text: string, caretIndex: number): boolean {
  if (caretIndex < 0 || caretIndex > text.length) return false;
  const prev = caretIndex === 0 ? '' : text[caretIndex - 1];
  // The "/" itself hasn't been typed yet when we evaluate the previous char,
  // so we accept: start of text, after newline, space or tab.
  if (prev === '') return true;
  return /[\s]/.test(prev);
}

/** Flatten a capsule's blocks to searchable, human-readable text. */
export function blockPlainText(blocks: CapsuleBlock[] | undefined): string {
  if (!blocks) return '';
  const parts: string[] = [];
  for (const b of blocks) {
    const d: any = (b as any).data || {};
    switch (b.type) {
      case 'heading':
      case 'paragraph':
        if (typeof d.text === 'string') parts.push(d.text);
        break;
      case 'callout':
        if (d.title) parts.push(String(d.title));
        if (d.content) parts.push(String(d.content));
        break;
      case 'ai_opponent_block':
        if (d.criticism) parts.push(String(d.criticism));
        break;
      case 'todo_list':
        if (Array.isArray(d.items)) {
          for (const it of d.items) if (it?.text) parts.push(String(it.text));
        }
        break;
      case 'audio_note':
        if (d.transcript) parts.push(String(d.transcript));
        break;
      case 'code_repl':
        if (d.code) parts.push(String(d.code));
        break;
      default:
        break;
    }
  }
  return parts.join('\n').replace(/\[\[([^\]]+)\]\]/g, '$1');
}

/**
 * Build a short excerpt around the first match of any term, with match
 * ranges marked for highlighting. Returns ellipses where text was cut.
 */
export function makeSnippet(
  text: string,
  terms: string[],
  radius = 90,
): HighlightSegment[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const lower = clean.toLowerCase();
  const needles = terms
    .map((t) => t.toLowerCase().replace(/^#/, '').trim())
    .filter((t) => t.length > 1);

  let firstHit = -1;
  for (const needle of needles) {
    const idx = lower.indexOf(needle);
    if (idx !== -1 && (firstHit === -1 || idx < firstHit)) firstHit = idx;
  }
  if (firstHit === -1) return highlightMatches(clean.slice(0, radius * 2), '');

  let start = Math.max(0, firstHit - Math.floor(radius / 2));
  let end = Math.min(clean.length, start + radius * 2);
  // Snap to word boundaries so the excerpt does not start mid-word.
  if (start > 0) {
    const space = clean.indexOf(' ', start);
    if (space !== -1 && space < firstHit) start = space + 1;
  }
  if (end < clean.length) {
    const space = clean.lastIndexOf(' ', end);
    if (space > firstHit) end = space;
  }

  const slice = clean.slice(start, end).trim();
  const segments = highlightMatches(slice, needles.join(' '));
  if (start > 0) segments.unshift({ text: '…', hit: false });
  if (end < clean.length) segments.push({ text: '…', hit: false });
  return segments;
}
