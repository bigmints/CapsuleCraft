/**
 * Undo / redo history for capsule edits.
 *
 * Stores snapshots (JSON strings) taken BEFORE each mutation. The store is
 * deliberately small and framework-free: the UI pushes the previous capsule
 * state, and asks for the previous/next snapshot on Ctrl+Z / Ctrl+Shift+Z.
 *
 * Design notes:
 * - snapshots are serialized, so later mutations of the same object cannot
 *   corrupt the history (the app mutates capsule objects in place in places);
 * - duplicate pushes (same snapshot as the last one) are ignored, so merely
 *   focusing a field does not create a no-op undo step;
 * - a new edit after undo clears the redo branch (linear history, like editors).
 */
export class UndoHistory {
  private past: string[] = [];
  private future: string[] = [];

  constructor(private readonly limit = 60) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get depth(): number {
    return this.past.length;
  }

  /** Record a snapshot of the state *before* an edit. */
  push(snapshot: string): void {
    if (this.past[this.past.length - 1] === snapshot) return;
    this.past.push(snapshot);
    if (this.past.length > this.limit) this.past.splice(0, this.past.length - this.limit);
    // A fresh edit invalidates the redo branch.
    this.future = [];
  }

  /** Returns the previous snapshot, or null when there is nothing to undo. */
  undo(currentSnapshot: string): string | null {
    const previous = this.past.pop();
    if (previous === undefined) return null;
    this.future.push(currentSnapshot);
    return previous;
  }

  /** Returns the next snapshot, or null when there is nothing to redo. */
  redo(currentSnapshot: string): string | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(currentSnapshot);
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
