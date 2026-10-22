import { describe, it, expect } from 'vitest';
import { UndoHistory } from '../history';

describe('UndoHistory', () => {
  it('starts empty', () => {
    const h = new UndoHistory();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo('a')).toBeNull();
    expect(h.redo('a')).toBeNull();
  });

  it('undoes back through snapshots', () => {
    const h = new UndoHistory();
    h.push('v0');
    h.push('v1');
    expect(h.canUndo).toBe(true);
    expect(h.undo('v2')).toBe('v1');
    expect(h.undo('v1')).toBe('v0');
    expect(h.undo('v0')).toBeNull();
  });

  it('redoes forward and keeps ordering', () => {
    const h = new UndoHistory();
    h.push('v0');
    h.push('v1');
    expect(h.undo('v2')).toBe('v1');
    expect(h.undo('v1')).toBe('v0');
    expect(h.redo('v0')).toBe('v1');
    expect(h.redo('v1')).toBe('v2');
    expect(h.redo('v2')).toBeNull();
  });

  it('clears the redo branch after a new edit', () => {
    const h = new UndoHistory();
    h.push('v0');
    h.push('v1');
    h.undo('v2');
    expect(h.canRedo).toBe(true);
    h.push('v1');
    expect(h.canRedo).toBe(false);
  });

  it('ignores duplicate pushes (no no-op undo steps)', () => {
    const h = new UndoHistory();
    h.push('v0');
    h.push('v0');
    expect(h.depth).toBe(1);
  });

  it('respects the limit by dropping the oldest snapshots', () => {
    const h = new UndoHistory(3);
    for (const s of ['v0', 'v1', 'v2', 'v3', 'v4']) h.push(s);
    expect(h.depth).toBe(3);
    expect(h.undo('v5')).toBe('v4');
    expect(h.undo('v4')).toBe('v3');
    expect(h.undo('v3')).toBe('v2');
    expect(h.undo('v2')).toBeNull();
  });

  it('clear() drops both branches', () => {
    const h = new UndoHistory();
    h.push('v0');
    h.undo('v1');
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});
