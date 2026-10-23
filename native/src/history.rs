//! Undo / redo snapshots for capsule edits.
//!
//! Same contract as the web engine: snapshots are taken *before* a mutation,
//! duplicates are ignored, a new edit clears the redo branch. The native app
//! keeps one history per page, keyed by message id.

use std::collections::HashMap;

#[derive(Default)]
pub struct UndoHistory {
    past: Vec<String>,
    future: Vec<String>,
    limit: usize,
}

impl UndoHistory {
    pub fn new(limit: usize) -> Self {
        Self {
            past: Vec::new(),
            future: Vec::new(),
            limit: limit.max(1),
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.past.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.future.is_empty()
    }

    pub fn depth(&self) -> usize {
        self.past.len()
    }

    /// Record the state *before* an edit.
    pub fn push(&mut self, snapshot: String) {
        if self.past.last() == Some(&snapshot) {
            return;
        }
        self.past.push(snapshot);
        if self.past.len() > self.limit {
            let excess = self.past.len() - self.limit;
            self.past.drain(0..excess);
        }
        self.future.clear();
    }

    pub fn undo(&mut self, current: &str) -> Option<String> {
        let previous = self.past.pop()?;
        self.future.push(current.to_string());
        Some(previous)
    }

    pub fn redo(&mut self, current: &str) -> Option<String> {
        let next = self.future.pop()?;
        self.past.push(current.to_string());
        Some(next)
    }

    pub fn clear(&mut self) {
        self.past.clear();
        self.future.clear();
    }
}

/// Per-page history with typing coalescing: one undo step per 700 ms burst,
/// so a single sentence is not thirty separate undo steps.
#[derive(Default)]
pub struct HistoryStore {
    histories: HashMap<String, UndoHistory>,
    last_push: HashMap<String, u128>,
}

impl HistoryStore {
    pub fn for_page(&mut self, id: &str) -> &mut UndoHistory {
        self.histories
            .entry(id.to_string())
            .or_insert_with(|| UndoHistory::new(60))
    }

    pub fn maybe_push(&mut self, id: &str, snapshot: String, now_ms: u128) {
        let last = self.last_push.get(id).copied().unwrap_or(0);
        if now_ms.saturating_sub(last) > 700 {
            self.for_page(id).push(snapshot);
        }
        self.last_push.insert(id.to_string(), now_ms);
    }

    pub fn undo(&mut self, id: &str, current: &str) -> Option<String> {
        self.last_push.remove(id);
        self.for_page(id).undo(current)
    }

    pub fn redo(&mut self, id: &str, current: &str) -> Option<String> {
        self.last_push.remove(id);
        self.for_page(id).redo(current)
    }

    pub fn can_undo(&mut self, id: &str) -> bool {
        self.for_page(id).can_undo()
    }

    pub fn can_redo(&mut self, id: &str) -> bool {
        self.for_page(id).can_redo()
    }

    pub fn forget(&mut self, id: &str) {
        self.histories.remove(id);
        self.last_push.remove(id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn undo_and_redo_round_trip() {
        let mut h = UndoHistory::new(60);
        h.push("a".into());
        h.push("b".into());
        assert_eq!(h.undo("c").as_deref(), Some("b"));
        assert_eq!(h.undo("b").as_deref(), Some("a"));
        assert_eq!(h.undo("a"), None);
        assert_eq!(h.redo("a").as_deref(), Some("b"));
    }

    #[test]
    fn duplicate_snapshots_are_ignored() {
        let mut h = UndoHistory::new(60);
        h.push("a".into());
        h.push("a".into());
        assert_eq!(h.depth(), 1);
    }

    #[test]
    fn new_edit_clears_redo() {
        let mut h = UndoHistory::new(60);
        h.push("a".into());
        h.undo("b");
        assert!(h.can_redo());
        h.push("b".into());
        assert!(!h.can_redo());
    }

    #[test]
    fn history_is_capped() {
        let mut h = UndoHistory::new(3);
        for n in 0..10 {
            h.push(format!("{n}"));
        }
        assert_eq!(h.depth(), 3);
    }

    #[test]
    fn typing_bursts_are_coalesced() {
        let mut store = HistoryStore::default();
        store.maybe_push("p", "v1".into(), 1_000);
        store.maybe_push("p", "v2".into(), 1_100);
        store.maybe_push("p", "v3".into(), 1_900);
        assert_eq!(store.for_page("p").depth(), 2);
    }
}
