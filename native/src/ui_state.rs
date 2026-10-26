//! Persistent UI state (zoom, sidebar geometry, canvas layout).
//!
//! Stored in `%APPDATA%\com.capsuleos.app\ui_state.json` (Windows) or
//! `~/.local/share/com.capsuleos.app/ui_state.json` (Linux) outside the vault
//! so personal display ergonomics do not pollute the git/vault repo.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::vault;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UiState {
    /// Global UI scale factor (e.g. 1.1 = 110%).
    pub zoom_factor: f32,
    /// Sidebar width in pixels (bounded 220.0..=480.0).
    pub sidebar_width: f32,
    /// Whether the sidebar is currently hidden.
    pub sidebar_collapsed: bool,
    /// Wide canvas mode for documents (1120 px max vs 780 px standard).
    pub wide_canvas: bool,
}

impl Default for UiState {
    fn default() -> Self {
        Self {
            zoom_factor: 1.1,
            sidebar_width: 280.0,
            sidebar_collapsed: false,
            wide_canvas: false,
        }
    }
}

impl UiState {
    pub fn file_path() -> PathBuf {
        vault::app_data_dir().join("ui_state.json")
    }

    pub fn load() -> Self {
        let path = Self::file_path();
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(state) = serde_json::from_str::<UiState>(&content) {
                return state;
            }
        }
        Self::default()
    }

    pub fn save(&self) {
        let path = Self::file_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = fs::write(&path, json);
        }
    }

    pub fn zoom_in(&mut self) -> f32 {
        self.zoom_factor = ((self.zoom_factor + 0.1) * 10.0).round() / 10.0;
        self.zoom_factor = self.zoom_factor.min(2.5);
        self.zoom_factor
    }

    pub fn zoom_out(&mut self) -> f32 {
        self.zoom_factor = ((self.zoom_factor - 0.1) * 10.0).round() / 10.0;
        self.zoom_factor = self.zoom_factor.max(0.75);
        self.zoom_factor
    }

    pub fn reset_zoom(&mut self) -> f32 {
        self.zoom_factor = 1.1;
        self.zoom_factor
    }

    pub fn toggle_sidebar(&mut self) -> bool {
        self.sidebar_collapsed = !self.sidebar_collapsed;
        self.sidebar_collapsed
    }

    pub fn toggle_wide_canvas(&mut self) -> bool {
        self.wide_canvas = !self.wide_canvas;
        self.wide_canvas
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_ui_state() {
        let state = UiState::default();
        assert!((state.zoom_factor - 1.1).abs() < 1e-4);
        assert_eq!(state.sidebar_width, 280.0);
        assert!(!state.sidebar_collapsed);
        assert!(!state.wide_canvas);
    }

    #[test]
    fn test_zoom_clamps() {
        let mut state = UiState::default();
        for _ in 0..30 {
            state.zoom_in();
        }
        assert_eq!(state.zoom_factor, 2.5);

        for _ in 0..40 {
            state.zoom_out();
        }
        assert_eq!(state.zoom_factor, 0.75);

        state.reset_zoom();
        assert!((state.zoom_factor - 1.1).abs() < 1e-4);
    }

    #[test]
    fn test_serialization_roundtrip() {
        let state = UiState {
            zoom_factor: 1.3,
            sidebar_width: 320.0,
            sidebar_collapsed: true,
            wide_canvas: true,
        };
        let json = serde_json::to_string(&state).unwrap();
        let decoded: UiState = serde_json::from_str(&json).unwrap();
        assert_eq!(state, decoded);
    }
}
