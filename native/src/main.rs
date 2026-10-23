//! CapsuleOS native egui prototype.
//!
//! A separate binary, not a rewrite of the React app. It opens the same `.eml`
//! vault folder, edits a small honest subset of the block model and writes the
//! same MIME shape back. Unsupported blocks are preserved in
//! `canvas_state.json`; external HTML emails are read-only.
//!
//! The shell follows ArtCraft's native visual system: undecorated window, a
//! custom title bar, a flush sidebar, a centred document panel and intentional
//! typography. The product remains CapsuleOS: local folder, one `.eml` per
//! page, no telemetry.

mod chrome;
mod icons;
mod mime;
mod theme;
mod vault;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use eframe::egui::{
    self, pos2, vec2, Align, Align2, Color32, FontFamily, FontId, Frame, Galley, Label, Layout,
    Margin, Pos2, Rect, Response, RichText, ScrollArea, Sense, Stroke, TextEdit, Ui, UiBuilder,
    Vec2,
};
use icons::Icon;
use mime::{block_type, new_block_id, Capsule};
use serde_json::{json, Value};
use vault::{default_vault_dir, PageTree, Vault};

const CONTENT_MAX_WIDTH: f32 = 752.0;
const SIDEBAR_WIDTH: f32 = 262.0;
const GUTTER: f32 = 26.0;

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1380.0, 880.0])
            .with_min_inner_size([980.0, 640.0])
            .with_decorations(false)
            .with_resizable(true)
            .with_title("CapsuleOS"),
        renderer: eframe::Renderer::Glow,
        ..Default::default()
    };

    eframe::run_native(
        "CapsuleOS",
        options,
        Box::new(|cc| {
            theme::apply(&cc.egui_ctx);
            Ok(Box::new(NativeApp::new()))
        }),
    )
}

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

struct NativeApp {
    vault: Vault,
    selected: Option<usize>,
    collapsed: HashSet<String>,
    search: String,
    dirty: bool,
    last_edit: Instant,
    status: String,
    status_error: bool,
}

impl NativeApp {
    fn new() -> Self {
        let dir = std::env::args()
            .nth(1)
            .map(PathBuf::from)
            .unwrap_or_else(default_vault_dir);
        let vault = Vault::load(dir);
        let selected = vault.selected_root();
        Self {
            vault,
            selected,
            collapsed: HashSet::new(),
            search: String::new(),
            dirty: false,
            last_edit: Instant::now(),
            status: "Saved".to_string(),
            status_error: false,
        }
    }

    fn mark_dirty(&mut self) {
        self.dirty = true;
        self.last_edit = Instant::now();
    }

    /// Returns `false` when a dirty page could not be saved. Callers must not
    /// navigate away in that case.
    fn save_selected(&mut self) -> bool {
        let Some(index) = self.selected else {
            return true;
        };
        if !self.dirty {
            return true;
        }
        match self.vault.save(index) {
            Ok(()) => {
                self.dirty = false;
                self.status = format!("Saved {}", chrono::Local::now().format("%H:%M:%S"));
                self.status_error = false;
                true
            }
            Err(err) => {
                self.status = err;
                self.status_error = true;
                false
            }
        }
    }

    fn select_page(&mut self, index: usize) {
        if self.selected == Some(index) || index >= self.vault.capsules.len() {
            return;
        }
        if !self.save_selected() {
            return;
        }
        self.selected = Some(index);
        self.dirty = false;
    }

    fn new_page(&mut self, parent: Option<String>) {
        if !self.save_selected() {
            return;
        }
        match self.vault.create_page(parent) {
            Ok(index) => {
                self.selected = Some(index);
                self.dirty = false;
                self.status = "New page".to_string();
                self.status_error = false;
            }
            Err(err) => {
                self.status = err;
                self.status_error = true;
            }
        }
    }

    fn reload(&mut self) {
        if !self.save_selected() {
            return;
        }
        let selected_id = self
            .selected
            .and_then(|index| self.vault.capsules.get(index))
            .map(|capsule| capsule.message_id.clone());
        self.vault.reload();
        self.selected = selected_id
            .and_then(|id| {
                self.vault
                    .capsules
                    .iter()
                    .position(|capsule| capsule.message_id == id)
            })
            .or_else(|| self.vault.selected_root());
        self.dirty = false;
        self.status = "Reloaded".to_string();
        self.status_error = false;
    }

    fn open_vault_dialog(&mut self) {
        if !self.save_selected() {
            return;
        }
        if let Some(dir) = rfd::FileDialog::new()
            .set_title("Choose a CapsuleOS .eml vault folder")
            .set_directory(&self.vault.dir)
            .pick_folder()
        {
            self.vault = Vault::load(dir);
            self.selected = self.vault.selected_root();
            self.collapsed.clear();
            self.search.clear();
            self.dirty = false;
            self.status = "Vault opened".to_string();
            self.status_error = false;
        }
    }
}

#[derive(Default)]
struct ShellAction {
    select: Option<usize>,
    open_vault: bool,
    new_page: bool,
    reload: bool,
    save: bool,
}

impl ShellAction {
    fn absorb(&mut self, other: ShellAction) {
        self.select = other.select.or(self.select);
        self.open_vault |= other.open_vault;
        self.new_page |= other.new_page;
        self.reload |= other.reload;
        self.save |= other.save;
    }
}

#[derive(Default)]
struct EditorAction {
    changed: bool,
    select: Option<usize>,
    new_subpage: bool,
    new_page: bool,
    open_vault: bool,
}

impl EditorAction {
    fn absorb(&mut self, other: EditorAction) {
        self.changed |= other.changed;
        self.select = other.select.or(self.select);
        self.new_subpage |= other.new_subpage;
        self.new_page |= other.new_page;
        self.open_vault |= other.open_vault;
    }
}

impl eframe::App for NativeApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();

        if ctx.input(|i| i.modifiers.command && i.key_pressed(egui::Key::S)) {
            self.save_selected();
        }
        if ctx.input(|i| i.modifiers.command && i.key_pressed(egui::Key::N)) {
            self.new_page(None);
        }
        if ctx.input(|i| i.viewport().close_requested()) && !self.save_selected() {
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
        }

        let tree = PageTree::build(&self.vault.capsules);
        let mut shell = ShellAction::default();

        egui::Panel::top("titlebar")
            .exact_size(chrome::TITLEBAR_HEIGHT)
            .frame(
                Frame::new()
                    .fill(theme::CHROME)
                    .inner_margin(Margin::same(0)),
            )
            .show(ui, |ui| {
                shell.absorb(draw_titlebar(
                    ui,
                    &self.vault,
                    self.dirty,
                    &self.status,
                    self.status_error,
                ));
            });

        let sidebar_action = {
            egui::Panel::left("sidebar")
                .exact_size(SIDEBAR_WIDTH)
                .resizable(false)
                .frame(
                    Frame::new()
                        .fill(theme::CHROME)
                        .inner_margin(Margin::same(0)),
                )
                .show(ui, |ui| {
                    draw_sidebar(
                        ui,
                        &self.vault,
                        &tree,
                        self.selected,
                        &mut self.search,
                        &mut self.collapsed,
                    )
                })
                .inner
        };
        shell.absorb(sidebar_action);

        let mut editor = EditorAction::default();
        egui::CentralPanel::default()
            .frame(
                Frame::new()
                    .fill(theme::CHROME)
                    .inner_margin(Margin::same(8)),
            )
            .show(ui, |ui| {
                Frame::new()
                    .fill(theme::BG)
                    .corner_radius(8)
                    .stroke(theme::hairline())
                    .inner_margin(Margin::same(0))
                    .show(ui, |ui| {
                        editor.absorb(draw_content_header(
                            ui,
                            self.selected,
                            &self.vault.capsules,
                            &tree,
                        ));
                        match self.selected {
                            Some(index) if index < self.vault.capsules.len() => {
                                editor.absorb(draw_document(
                                    ui,
                                    &mut self.vault.capsules[index],
                                ));
                            }
                            _ => draw_empty_state(ui, &mut editor),
                        }
                    });
            });

        if editor.changed {
            self.mark_dirty();
        }
        if editor.new_page {
            self.new_page(None);
        }
        if editor.open_vault {
            self.open_vault_dialog();
        }
        if editor.new_subpage {
            let parent = self
                .selected
                .and_then(|index| self.vault.capsules.get(index))
                .map(|capsule| capsule.message_id.clone());
            self.new_page(parent);
        }
        if let Some(index) = editor.select.or(shell.select) {
            self.select_page(index);
        }
        if shell.save {
            self.save_selected();
        }
        if shell.new_page {
            self.new_page(None);
        }
        if shell.reload {
            self.reload();
        }
        if shell.open_vault {
            self.open_vault_dialog();
        }

        if self.dirty && self.last_edit.elapsed() > Duration::from_millis(750) {
            self.save_selected();
        }

        chrome::window_edges(&ctx);
        ctx.request_repaint_after(Duration::from_millis(200));
    }
}

// ---------------------------------------------------------------------------
// Shell: title bar
// ---------------------------------------------------------------------------

fn draw_titlebar(
    ui: &mut Ui,
    vault: &Vault,
    dirty: bool,
    status: &str,
    status_error: bool,
) -> ShellAction {
    let mut action = ShellAction::default();
    chrome::title_bar_drag(ui);

    let rect = ui.max_rect();
    let mut bar = ui.new_child(
        UiBuilder::new()
            .max_rect(rect)
            .layout(Layout::left_to_right(Align::Center)),
    );
    let ui = &mut bar;
    ui.spacing_mut().item_spacing.x = 6.0;
    ui.add_space(chrome::leading_inset() + 12.0);

    // Mark: a capsule outline with one filled end.
    let (mark, _) = ui.allocate_exact_size(vec2(24.0, 24.0), Sense::hover());
    let mark_rect = Rect::from_center_size(mark.center(), vec2(20.0, 20.0));
    ui.painter().rect_stroke(
        mark_rect,
        egui::CornerRadius::same(6),
        Stroke::new(1.5, theme::ACCENT),
        egui::StrokeKind::Inside,
    );
    ui.painter().circle_filled(
        mark_rect.center() + vec2(-3.2, 0.0),
        2.0,
        theme::ACCENT,
    );
    ui.painter().circle_filled(
        mark_rect.center() + vec2(3.2, 0.0),
        2.0,
        theme::fade(theme::ACCENT, 0.35),
    );

    ui.label(
        RichText::new("CapsuleOS")
            .family(theme::display())
            .size(15.0)
            .color(theme::INK),
    );

    let (badge_rect, _) = ui.allocate_exact_size(vec2(45.0, 16.0), Sense::hover());
    ui.painter().rect(
        badge_rect,
        theme::RADIUS,
        theme::WASH,
        Stroke::new(1.0, theme::LINE),
        egui::StrokeKind::Inside,
    );
    let badge = caps(
        ui,
        "NATIVE",
        8.0,
        theme::mono_bold(),
        1.0,
        theme::FAINT,
    );
    ui.painter()
        .galley(badge_rect.center() - badge.size() / 2.0, badge, theme::FAINT);

    ui.add_space(8.0);
    let (divider, _) = ui.allocate_exact_size(vec2(1.0, 18.0), Sense::hover());
    ui.painter()
        .vline(divider.center().x, divider.y_range(), theme::hairline());
    ui.add_space(6.0);

    if vault_switcher(ui, vault).clicked() {
        action.open_vault = true;
    }

    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
        ui.spacing_mut().item_spacing.x = 2.0;
        if chrome::custom_caption_buttons() {
            chrome::caption_buttons(ui, chrome::TITLEBAR_HEIGHT);
        }
        ui.add_space(8.0);

        if icon_button(ui, Icon::Reload, "Reload from disk", true, false).clicked() {
            action.reload = true;
        }
        if icon_button(
            ui,
            Icon::Save,
            if dirty { "Save now (Ctrl+S)" } else { "All changes saved" },
            dirty,
            false,
        )
        .clicked()
        {
            action.save = true;
        }

        ui.add_space(6.0);
        let (dot_color, text) = if status_error {
            (theme::BAD, "Save failed")
        } else if dirty {
            (theme::BADGE_BETA, "Unsaved")
        } else {
            (theme::ACCENT, status)
        };
        ui.horizontal(|ui| {
            let (dot, _) = ui.allocate_exact_size(vec2(6.0, 6.0), Sense::hover());
            ui.painter().circle_filled(dot.center(), 2.5, dot_color);
            let label = ui.label(
                RichText::new(text)
                    .family(theme::mono())
                    .size(9.5)
                    .color(if status_error {
                        theme::BAD
                    } else if dirty {
                        theme::BADGE_BETA
                    } else {
                        theme::FAINT
                    }),
            );
            if status_error {
                label.on_hover_text(status);
            }
        });
    });

    action
}

fn vault_switcher(ui: &mut Ui, vault: &Vault) -> Response {
    let name = folder_name(&vault.dir);
    let name = truncate_chars(&name, 30);
    let font = FontId::new(12.5, theme::medium());
    let galley = ui
        .painter()
        .layout_no_wrap(name.clone(), font, theme::INK);
    let width = 12.0 + 14.0 + 8.0 + galley.size().x + 10.0 + 12.0;
    let (rect, response) = ui.allocate_exact_size(vec2(width, 28.0), Sense::click());
    if response.hovered() {
        ui.painter().rect_filled(rect, theme::RADIUS, theme::WASH);
    }
    let ink = if response.hovered() {
        theme::INK
    } else {
        theme::MUTED
    };
    icons::paint(
        ui.painter(),
        Rect::from_center_size(pos2(rect.left() + 12.0 + 7.0, rect.center().y), vec2(14.0, 14.0)),
        Icon::Folder,
        ink,
    );
    let text_pos = pos2(
        rect.left() + 12.0 + 14.0 + 8.0,
        rect.center().y - galley.size().y / 2.0,
    );
    ui.painter()
        .galley_with_override_text_color(text_pos, galley, ink);
    icons::paint(
        ui.painter(),
        Rect::from_center_size(pos2(rect.right() - 12.0, rect.center().y), vec2(10.0, 10.0)),
        Icon::ChevronDown,
        theme::FAINT,
    );
    response
        .on_hover_text(vault.dir.display().to_string())
        .on_hover_cursor(egui::CursorIcon::PointingHand)
}

// ---------------------------------------------------------------------------
// Shell: sidebar
// ---------------------------------------------------------------------------

fn draw_sidebar(
    ui: &mut Ui,
    vault: &Vault,
    tree: &PageTree,
    selected: Option<usize>,
    search: &mut String,
    collapsed: &mut HashSet<String>,
) -> ShellAction {
    let mut action = ShellAction::default();
    let outer = ui.max_rect();
    let inner = outer.shrink2(vec2(14.0, 8.0));
    let header_h = 122.0;
    let footer_h = 82.0;

    let header_rect = Rect::from_min_max(inner.min, pos2(inner.right(), inner.top() + header_h));
    let footer_rect = Rect::from_min_max(
        pos2(inner.left(), inner.bottom() - footer_h),
        inner.max,
    );
    let list_rect = Rect::from_min_max(
        pos2(inner.left(), header_rect.bottom()),
        pos2(inner.right(), footer_rect.top()),
    );

    let mut header = ui.new_child(
        UiBuilder::new()
            .max_rect(header_rect)
            .layout(Layout::top_down(Align::Min)),
    );
    header.spacing_mut().item_spacing = vec2(0.0, 0.0);

    if vault_card(&mut header, vault).clicked() {
        action.open_vault = true;
    }
    header.add_space(10.0);
    if search_box(&mut header, search).changed() {
        // The list is rebuilt from `search` below; no extra state is needed.
    }
    header.add_space(14.0);

    let mut new_page_clicked = false;
    let section_rect = {
        let (rect, _) = header.allocate_exact_size(
            vec2(header.available_width(), 26.0),
            Sense::hover(),
        );
        let label = caps(
            &header,
            "Pages",
            theme::HUD_SIZE,
            theme::mono_bold(),
            theme::LABEL_SPACING,
            theme::SIDEBAR_INK,
        );
        header.painter().galley(
            pos2(rect.left() + 2.0, rect.center().y - label.size().y / 2.0),
            label.clone(),
            theme::SIDEBAR_INK,
        );
        header.painter().text(
            pos2(rect.left() + 2.0 + label.size().x + 8.0, rect.center().y),
            Align2::LEFT_CENTER,
            vault.capsules.len().to_string(),
            FontId::new(9.0, theme::mono()),
            theme::FAINT,
        );

        let plus_rect = Rect::from_center_size(
            pos2(rect.right() - 11.0, rect.center().y),
            vec2(22.0, 22.0),
        );
        let plus = header
            .interact(plus_rect, header.scope_id().with("new-page"), Sense::click())
            .on_hover_text("New top-level page")
            .on_hover_cursor(egui::CursorIcon::PointingHand);
        if plus.hovered() {
            header
                .painter()
                .rect_filled(plus_rect, theme::RADIUS, theme::WASH);
        }
        icons::paint(
            header.painter(),
            Rect::from_center_size(plus_rect.center(), vec2(12.0, 12.0)),
            Icon::Plus,
            if plus.hovered() {
                theme::INK
            } else {
                theme::FAINT
            },
        );
        if plus.clicked() {
            new_page_clicked = true;
        }
        rect
    };
    let _ = section_rect;
    action.new_page |= new_page_clicked;

    let mut list = ui.new_child(
        UiBuilder::new()
            .max_rect(list_rect)
            .layout(Layout::top_down(Align::Min)),
    );
    ScrollArea::vertical()
        .id_salt("page-list")
        .auto_shrink([false, false])
        .show(&mut list, |ui| {
            ui.spacing_mut().item_spacing.y = 1.0;
            let query = search.trim().to_lowercase();
            if query.is_empty() {
                if tree.roots().is_empty() {
                    empty_pages(ui, &mut action, vault.capsules.is_empty());
                } else if let Some(index) = draw_page_nodes(
                    ui,
                    &vault.capsules,
                    tree,
                    None,
                    0,
                    selected,
                    collapsed,
                ) {
                    action.select = Some(index);
                }
            } else {
                let mut matches = 0usize;
                for (index, capsule) in vault.capsules.iter().enumerate() {
                    if capsule.subject.to_lowercase().contains(&query)
                        || capsule
                            .tags
                            .iter()
                            .any(|tag| tag.to_lowercase().contains(&query))
                    {
                        matches += 1;
                        if draw_search_row(ui, &vault.capsules, tree, index, selected) {
                            action.select = Some(index);
                        }
                    }
                }
                if matches == 0 {
                    ui.add_space(18.0);
                    ui.label(
                        RichText::new(format!("No pages match “{}”.", search.trim()))
                            .size(12.0)
                            .color(theme::MUTED),
                    );
                    ui.add_space(6.0);
                    if text_button(ui, None, "Clear search", false).clicked() {
                        search.clear();
                    }
                }
            }
        });

    let mut footer = ui.new_child(
        UiBuilder::new()
            .max_rect(footer_rect)
            .layout(Layout::top_down(Align::Min)),
    );
    footer
        .painter()
        .hline(footer_rect.x_range(), footer_rect.top(), theme::hairline());
    footer.add_space(12.0);
    let _ = hud(&mut footer, "Zero-DB vault", theme::FAINT);
    footer.add_space(5.0);
    let counts = if vault.load_errors.is_empty() {
        format!(
            "{} .eml {}",
            vault.capsules.len(),
            if vault.capsules.len() == 1 {
                "page"
            } else {
                "pages"
            }
        )
    } else {
        format!(
            "{} .eml pages · {} read-only",
            vault.capsules.len(),
            vault.load_errors.len()
        )
    };
    let counts_label = footer.label(
        RichText::new(counts)
            .family(theme::mono())
            .size(9.5)
            .color(theme::MUTED),
    );
    if !vault.load_errors.is_empty() {
        counts_label.on_hover_text(vault.load_errors.join("\n"));
    }
    footer.add_space(7.0);
    if text_button(&mut footer, Some(Icon::Folder), "Change folder…", false).clicked() {
        action.open_vault = true;
    }

    action
}

fn vault_card(ui: &mut Ui, vault: &Vault) -> Response {
    let (rect, response) = ui.allocate_exact_size(
        vec2(ui.available_width(), 44.0),
        Sense::click(),
    );
    ui.painter().rect(
        rect,
        theme::RADIUS,
        if response.hovered() {
            theme::WASH_HOVER
        } else {
            theme::WASH
        },
        theme::hairline(),
        egui::StrokeKind::Inside,
    );
    let tile = Rect::from_center_size(
        pos2(rect.left() + 22.0, rect.center().y),
        vec2(28.0, 28.0),
    );
    ui.painter()
        .rect_filled(tile, theme::RADIUS, theme::fade(theme::ACCENT, 0.14));
    icons::paint(
        ui.painter(),
        Rect::from_center_size(tile.center(), vec2(15.0, 15.0)),
        Icon::Folder,
        theme::ACCENT_INK,
    );
    let name = truncate_chars(&folder_name(&vault.dir), 24);
    ui.painter().text(
        pos2(tile.right() + 10.0, rect.center().y - 7.0),
        Align2::LEFT_CENTER,
        name,
        FontId::new(12.5, theme::semibold()),
        theme::INK,
    );
    ui.painter().text(
        pos2(tile.right() + 10.0, rect.center().y + 8.0),
        Align2::LEFT_CENTER,
        "Local .eml folder",
        FontId::new(10.0, theme::mono()),
        theme::FAINT,
    );
    response
        .on_hover_text(vault.dir.display().to_string())
        .on_hover_cursor(egui::CursorIcon::PointingHand)
}

fn search_box(ui: &mut Ui, search: &mut String) -> Response {
    let (rect, _) = ui.allocate_exact_size(
        vec2(ui.available_width(), 30.0),
        Sense::hover(),
    );
    ui.painter().rect(
        rect,
        theme::RADIUS,
        theme::WASH,
        theme::hairline(),
        egui::StrokeKind::Inside,
    );
    icons::paint(
        ui.painter(),
        Rect::from_center_size(pos2(rect.left() + 14.0, rect.center().y), vec2(13.0, 13.0)),
        Icon::Search,
        theme::FAINT,
    );
    let text_rect = Rect::from_min_max(
        pos2(rect.left() + 28.0, rect.top() + 4.0),
        pos2(rect.right() - 8.0, rect.bottom() - 4.0),
    );
    let mut child = ui.new_child(
        UiBuilder::new()
            .max_rect(text_rect)
            .layout(Layout::left_to_right(Align::Center)),
    );
    let response = child.add(
        TextEdit::singleline(search)
            .frame(Frame::NONE)
            .margin(Margin::same(0))
            .hint_text("Search pages")
            .desired_width(f32::INFINITY)
            .align(egui::Align2::LEFT_CENTER),
    );
    if response.has_focus() {
        ui.painter().rect_stroke(
            rect,
            theme::RADIUS,
            Stroke::new(1.0, theme::ACCENT),
            egui::StrokeKind::Inside,
        );
    }
    response
}

fn empty_pages(ui: &mut Ui, action: &mut ShellAction, no_pages: bool) {
    ui.add_space(18.0);
    ui.label(
        RichText::new(if no_pages {
            "No pages yet."
        } else {
            "No native pages in this vault."
        })
        .size(12.0)
        .color(theme::MUTED),
    );
    ui.add_space(8.0);
    if primary_button(ui, "New page", 28.0).clicked() {
        action.new_page = true;
    }
}

#[allow(clippy::too_many_arguments)]
fn draw_page_nodes(
    ui: &mut Ui,
    capsules: &[Capsule],
    tree: &PageTree,
    parent: Option<usize>,
    depth: usize,
    selected: Option<usize>,
    collapsed: &mut HashSet<String>,
) -> Option<usize> {
    let mut clicked = None;
    for &index in tree.children_of(parent) {
        let capsule = &capsules[index];
        let has_children = !tree.children_of(Some(index)).is_empty();
        let key = capsule.message_id.clone();
        let is_collapsed = collapsed.contains(&key);
        let depth = depth.min(4);
        let indent = depth as f32 * 12.0;

        let (rect, response) = ui.allocate_exact_size(
            vec2(ui.available_width(), 30.0),
            Sense::click(),
        );
        let is_selected = selected == Some(index);
        if is_selected {
            ui.painter()
                .rect_filled(rect, theme::RADIUS, theme::WASH_SELECTED);
            ui.painter().rect_filled(
                Rect::from_min_size(
                    pos2(rect.left() - 7.0, rect.top() + 7.0),
                    vec2(2.0, 16.0),
                ),
                0.0,
                Color32::WHITE,
            );
        } else if response.hovered() {
            ui.painter()
                .rect_filled(rect, theme::RADIUS, theme::WASH);
        }

        let chevron_rect = Rect::from_center_size(
            pos2(rect.left() + indent + 8.0, rect.center().y),
            vec2(14.0, 14.0),
        );
        let mut toggle = false;
        if has_children {
            let chev = ui
                .interact(
                    chevron_rect,
                    ui.scope_id().with(("page-chevron", index)),
                    Sense::click(),
                )
                .on_hover_cursor(egui::CursorIcon::PointingHand);
            icons::paint(
                ui.painter(),
                Rect::from_center_size(chevron_rect.center(), vec2(10.0, 10.0)),
                if is_collapsed {
                    Icon::ChevronRight
                } else {
                    Icon::ChevronDown
                },
                theme::FAINT,
            );
            toggle = chev.clicked();
        }

        let ink = if is_selected || response.hovered() {
            Color32::WHITE
        } else {
            theme::SIDEBAR_INK
        };
        icons::paint(
            ui.painter(),
            Rect::from_center_size(
                pos2(rect.left() + indent + 25.0, rect.center().y),
                vec2(13.0, 13.0),
            ),
            Icon::Doc,
            ink,
        );

        let title_x = rect.left() + indent + 40.0;
        let title = truncate_chars(&capsule.subject, 34);
        let font = FontId::new(
            12.5,
            if is_selected {
                theme::medium()
            } else {
                FontFamily::Proportional
            },
        );
        let clip = Rect::from_min_max(
            pos2(title_x, rect.top()),
            pos2(rect.right() - 18.0, rect.bottom()),
        );
        ui.painter()
            .with_clip_rect(clip)
            .text(pos2(title_x, rect.center().y), Align2::LEFT_CENTER, title, font, ink);

        if !capsule.native {
            icons::paint(
                ui.painter(),
                Rect::from_center_size(
                    pos2(rect.right() - 12.0, rect.center().y),
                    vec2(11.0, 11.0),
                ),
                Icon::Lock,
                theme::BADGE_BETA,
            );
        }

        if toggle {
            if is_collapsed {
                collapsed.remove(&key);
            } else {
                collapsed.insert(key.clone());
            }
        } else if response.clicked() {
            clicked = Some(index);
        }

        let response = if capsule.native {
            response
        } else {
            response.on_hover_text("Imported email — read-only in the native prototype")
        };
        let _ = response;

        if has_children && !is_collapsed {
            if let Some(child) = draw_page_nodes(
                ui,
                capsules,
                tree,
                Some(index),
                depth + 1,
                selected,
                collapsed,
            ) {
                clicked = Some(child);
            }
        }
    }
    clicked
}

fn draw_search_row(
    ui: &mut Ui,
    capsules: &[Capsule],
    tree: &PageTree,
    index: usize,
    selected: Option<usize>,
) -> bool {
    let capsule = &capsules[index];
    let (rect, response) = ui.allocate_exact_size(
        vec2(ui.available_width(), 38.0),
        Sense::click(),
    );
    let is_selected = selected == Some(index);
    if is_selected {
        ui.painter()
            .rect_filled(rect, theme::RADIUS, theme::WASH_SELECTED);
        ui.painter().rect_filled(
            Rect::from_min_size(
                pos2(rect.left() - 7.0, rect.top() + 10.0),
                vec2(2.0, 18.0),
            ),
            0.0,
            Color32::WHITE,
        );
    } else if response.hovered() {
        ui.painter()
            .rect_filled(rect, theme::RADIUS, theme::WASH);
    }
    let ink = if is_selected || response.hovered() {
        Color32::WHITE
    } else {
        theme::SIDEBAR_INK
    };
    icons::paint(
        ui.painter(),
        Rect::from_center_size(pos2(rect.left() + 15.0, rect.top() + 14.0), vec2(13.0, 13.0)),
        Icon::Doc,
        ink,
    );
    let title = truncate_chars(&capsule.subject, 32);
    ui.painter().text(
        pos2(rect.left() + 30.0, rect.top() + 13.0),
        Align2::LEFT_CENTER,
        title,
        FontId::new(12.5, theme::medium()),
        ink,
    );
    let parent = tree
        .parent_of(index)
        .and_then(|parent| capsules.get(parent))
        .map(|parent| format!("in {}", truncate_chars(&parent.subject, 30)))
        .unwrap_or_else(|| "Root page".to_string());
    ui.painter().text(
        pos2(rect.left() + 30.0, rect.top() + 27.0),
        Align2::LEFT_CENTER,
        parent,
        FontId::new(9.5, theme::mono()),
        theme::FAINT,
    );
    if !capsule.native {
        icons::paint(
            ui.painter(),
            Rect::from_center_size(pos2(rect.right() - 12.0, rect.center().y), vec2(11.0, 11.0)),
            Icon::Lock,
            theme::BADGE_BETA,
        );
    }
    let response = if capsule.native {
        response
    } else {
        response.on_hover_text("Imported email — read-only in the native prototype")
    };
    response.clicked()
}

// ---------------------------------------------------------------------------
// Content panel: header, empty state, document
// ---------------------------------------------------------------------------

fn draw_content_header(
    ui: &mut Ui,
    selected: Option<usize>,
    capsules: &[Capsule],
    tree: &PageTree,
) -> EditorAction {
    let mut action = EditorAction::default();
    let (rect, _) = ui.allocate_exact_size(
        vec2(ui.available_width(), 48.0),
        Sense::hover(),
    );
    ui.painter()
        .hline(rect.x_range(), rect.bottom() - 0.5, theme::hairline());

    let mut bar = ui.new_child(
        UiBuilder::new()
            .max_rect(rect.shrink2(vec2(22.0, 0.0)))
            .layout(Layout::left_to_right(Align::Center)),
    );
    let ui = &mut bar;
    ui.spacing_mut().item_spacing.x = 7.0;
    let _ = hud(ui, "Vault", theme::MUTED);

    let Some(index) = selected.filter(|index| *index < capsules.len()) else {
        ui.label(RichText::new("No page selected").size(12.0).color(theme::FAINT));
        return action;
    };
    let capsule = &capsules[index];

    let ancestors = tree.ancestors(index);
    let skip = ancestors.len().saturating_sub(2);
    if skip > 0 {
        ui.label(RichText::new("…").size(12.0).color(theme::FAINT));
        let _ = chevron(ui, theme::FAINT);
    }
    for ancestor in &ancestors[skip..] {
        if let Some(parent) = capsules.get(*ancestor) {
            if crumb_button(ui, &truncate_chars(&parent.subject, 22)).clicked() {
                action.select = Some(*ancestor);
            }
            let _ = chevron(ui, theme::FAINT);
        }
    }

    ui.label(
        RichText::new(if capsule.subject.is_empty() {
            "Untitled"
        } else {
            &capsule.subject
        })
        .family(theme::medium())
        .size(12.5)
        .color(theme::INK),
    );
    if !capsule.native {
        ui.add_space(3.0);
        let _ = tag_chip(ui, "READ-ONLY", theme::BADGE_BETA);
    }

    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
        let info = ghost(ui, Icon::Info, Some("Info"), "MIME and page details", true, 30.0);
        if info.clicked() {
            // The popup is opened by `Popup::menu` below.
        }
        egui::Popup::menu(&info)
            .frame(popover_frame())
            .align(egui::RectAlign::BOTTOM_END)
            .show(|ui| info_popover(ui, capsule));

        if ghost(
            ui,
            Icon::Plus,
            Some("Subpage"),
            "Create a page under this one",
            true,
            30.0,
        )
        .clicked()
        {
            action.new_subpage = true;
        }
    });

    action
}

fn draw_document(ui: &mut Ui, capsule: &mut Capsule) -> EditorAction {
    let mut action = EditorAction::default();
    ScrollArea::vertical()
        .id_salt("document")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            let available = ui.available_width();
            let content_w = (available - 96.0).clamp(320.0, CONTENT_MAX_WIDTH);
            let pad = ((available - content_w) / 2.0).max(28.0);
            ui.horizontal(|ui| {
                ui.add_space(pad);
                ui.allocate_ui_with_layout(
                    vec2(content_w, 0.0),
                    Layout::top_down(Align::Min),
                    |ui| {
                        ui.set_width(content_w);
                        ui.add_space(40.0);

                        if capsule.native {
                            let response = ui.add(
                                TextEdit::singleline(&mut capsule.subject)
                                    .font(FontId::new(34.0, theme::display()))
                                    .text_color(theme::INK)
                                    .frame(Frame::NONE)
                                    .margin(Margin::same(0))
                                    .desired_width(f32::INFINITY)
                                    .hint_text("Untitled"),
                            );
                            if response.changed() {
                                action.changed = true;
                            }
                        } else {
                            ui.add(
                                Label::new(
                                    RichText::new(if capsule.subject.is_empty() {
                                        "Untitled"
                                    } else {
                                        &capsule.subject
                                    })
                                    .family(theme::display())
                                    .size(34.0)
                                    .color(theme::INK),
                                )
                                .wrap(),
                            );
                        }

                        ui.add_space(12.0);
                        document_meta(ui, capsule);
                        ui.add_space(28.0);

                        if !capsule.native {
                            read_only_notice(ui, capsule);
                            ui.add_space(80.0);
                        } else {
                            let mut block_op: Option<(usize, BlockOp)> = None;
                            let block_count = capsule.blocks.len();
                            for index in 0..block_count {
                                let mut block = capsule.blocks[index].clone();
                                let kind = block_type(&block).to_string();
                                let (changed, op) =
                                    draw_block_row(ui, &mut block, index, block_count);
                                if changed {
                                    capsule.blocks[index] = block;
                                    action.changed = true;
                                }
                                if op.is_some() {
                                    block_op = op.map(|op| (index, op));
                                }
                                ui.add_space(match kind.as_str() {
                                    "heading" => 20.0,
                                    "todo_list" => 16.0,
                                    "callout" => 16.0,
                                    "unsupported" => 12.0,
                                    _ => 10.0,
                                });
                            }

                            if let Some((index, op)) = block_op {
                                match op {
                                    BlockOp::Delete => {
                                        if index < capsule.blocks.len() {
                                            capsule.blocks.remove(index);
                                            action.changed = true;
                                        }
                                    }
                                    BlockOp::Up if index > 0 => {
                                        capsule.blocks.swap(index, index - 1);
                                        action.changed = true;
                                    }
                                    BlockOp::Down if index + 1 < capsule.blocks.len() => {
                                        capsule.blocks.swap(index, index + 1);
                                        action.changed = true;
                                    }
                                    BlockOp::SetLevel(level) => {
                                        if let Some(block) = capsule.blocks.get_mut(index) {
                                            block["data"]["level"] = json!(level);
                                            action.changed = true;
                                        }
                                    }
                                    _ => {}
                                }
                            }

                            ui.add_space(8.0);
                            ui.horizontal(|ui| {
                                ui.add_space(2.0);
                                if let Some(kind) = add_block_menu(ui) {
                                    capsule.blocks.push(kind.block());
                                    action.changed = true;
                                }
                            });
                            ui.add_space(100.0);
                        }
                    },
                );
            });
        });
    action
}

fn document_meta(ui: &mut Ui, capsule: &Capsule) {
    ui.horizontal_wrapped(|ui| {
        ui.spacing_mut().item_spacing = vec2(7.0, 6.0);
        ui.label(
            RichText::new(format_date(capsule))
                .family(theme::mono())
                .size(9.5)
                .color(theme::FAINT),
        );
        dot_sep(ui);
        if capsule.native {
            ui.label(
                RichText::new(format!(
                    "{} {}",
                    capsule.blocks.len(),
                    if capsule.blocks.len() == 1 {
                        "block"
                    } else {
                        "blocks"
                    }
                ))
                .family(theme::mono())
                .size(9.5)
                .color(theme::FAINT),
            );
        } else {
            ui.label(
                RichText::new("imported email")
                    .family(theme::mono())
                    .size(9.5)
                    .color(theme::BADGE_BETA),
            );
        }
        for tag in &capsule.tags {
            ui.add_space(2.0);
            let _ = tag_chip(ui, tag, theme::MUTED);
        }
        if !capsule.attachments.is_empty() {
            dot_sep(ui);
            let bytes: usize = capsule.attachments.iter().map(|a| a.size_bytes).sum();
            ui.label(
                RichText::new(format!(
                    "{} · {}",
                    if capsule.attachments.len() == 1 {
                        "1 attachment".to_string()
                    } else {
                        format!("{} attachments", capsule.attachments.len())
                    },
                    human_bytes(bytes)
                ))
                .family(theme::mono())
                .size(9.5)
                .color(theme::FAINT),
            );
        }
    });
}

fn read_only_notice(ui: &mut Ui, capsule: &Capsule) {
    let inner = Frame::new()
        .fill(theme::WASH)
        .corner_radius(theme::RADIUS)
        .inner_margin(Margin {
            left: 16,
            right: 14,
            top: 12,
            bottom: 12,
        })
        .show(ui, |ui| {
            let _ = hud(ui, "Imported email · read-only", theme::BADGE_BETA);
            ui.add_space(7.0);
            ui.add(
                Label::new(
                    RichText::new(
                        capsule
                            .parse_note
                            .as_deref()
                            .unwrap_or("This .eml was not written by CapsuleOS."),
                    )
                    .size(13.0)
                    .color(theme::INK),
                )
                .wrap(),
            );
            ui.add_space(5.0);
            ui.add(
                Label::new(
                    RichText::new(
                        "HTML email rendering is not implemented in the native prototype. Open this file in the web app for the full preview. It will not be overwritten here.",
                    )
                    .size(11.5)
                    .color(theme::MUTED),
                )
                .wrap(),
            );
        });
    ui.painter().rect_filled(
        Rect::from_min_size(
            inner.response.rect.min,
            vec2(2.0, inner.response.rect.height()),
        ),
        0.0,
        theme::BADGE_BETA,
    );
}

fn draw_empty_state(ui: &mut Ui, action: &mut EditorAction) {
    ScrollArea::vertical()
        .id_salt("empty")
        .auto_shrink([false, false])
        .show(ui, |ui| {
            ui.add_space(110.0);
            ui.vertical_centered(|ui| {
                ui.label(
                    RichText::new("A folder, not a database.")
                        .family(theme::display())
                        .size(32.0)
                        .color(theme::INK),
                );
                ui.add_space(8.0);
                ui.label(
                    RichText::new(
                        "One .eml per page. Open a CapsuleOS vault or create the first page.",
                    )
                    .size(13.0)
                    .color(theme::MUTED),
                );
                ui.add_space(22.0);
                ui.horizontal(|ui| {
                    let total = 260.0;
                    ui.add_space((ui.available_width() - total) / 2.0);
                    if primary_button(ui, "New page", 34.0).clicked() {
                        action.new_page = true;
                    }
                    ui.add_space(8.0);
                    if secondary_button(ui, Some(Icon::Folder), "Open folder", 34.0).clicked() {
                        action.open_vault = true;
                    }
                });
                ui.add_space(10.0);
                ui.label(
                    RichText::new("No network · no telemetry · no database")
                        .family(theme::mono())
                        .size(9.0)
                        .color(theme::FAINT),
                );
            });
        });
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

#[derive(Clone, Copy)]
enum BlockOp {
    Up,
    Down,
    Delete,
    SetLevel(u8),
}

#[derive(Clone, Copy)]
enum BlockKind {
    Text,
    Heading,
    Tasks,
    Callout,
}

impl BlockKind {
    fn block(self) -> Value {
        match self {
            BlockKind::Text => json!({
                "id": new_block_id("paragraph"),
                "type": "paragraph",
                "data": { "text": "" }
            }),
            BlockKind::Heading => json!({
                "id": new_block_id("heading"),
                "type": "heading",
                "data": { "level": 2, "text": "" }
            }),
            BlockKind::Tasks => json!({
                "id": new_block_id("todo_list"),
                "type": "todo_list",
                "data": { "title": "Tasks", "items": [] }
            }),
            BlockKind::Callout => json!({
                "id": new_block_id("callout"),
                "type": "callout",
                "data": {
                    "title": "Note",
                    "content": "",
                    "icon": "info",
                    "tone": "blue"
                }
            }),
        }
    }
}

fn add_block_menu(ui: &mut Ui) -> Option<BlockKind> {
    let response = ghost(ui, Icon::Plus, Some("Add block"), "Add a block", true, 30.0);
    let mut chosen = None;
    egui::Popup::menu(&response)
        .frame(popover_frame())
        .align(egui::RectAlign::BOTTOM_START)
        .show(|ui| {
            ui.set_min_width(180.0);
            menu_header(ui, "Add block");
            if menu_row(ui, Some(Icon::Doc), "Text", None, false, true, false).clicked() {
                chosen = Some(BlockKind::Text);
            }
            if menu_row(ui, Some(Icon::Doc), "Heading", Some("H2"), false, true, false).clicked() {
                chosen = Some(BlockKind::Heading);
            }
            if menu_row(ui, Some(Icon::Check), "Tasks", None, false, true, false).clicked() {
                chosen = Some(BlockKind::Tasks);
            }
            if menu_row(ui, Some(Icon::Info), "Callout", None, false, true, false).clicked() {
                chosen = Some(BlockKind::Callout);
            }
        });
    chosen
}

fn draw_block_row(
    ui: &mut Ui,
    block: &mut Value,
    index: usize,
    block_count: usize,
) -> (bool, Option<BlockOp>) {
    let kind = block_type(block).to_string();
    let mut changed = false;
    let mut op = None;
    let row_top = ui.cursor().min;

    let response = ui
        .allocate_ui_with_layout(
            vec2(ui.available_width(), 0.0),
            Layout::top_down(Align::Min),
            |ui| {
                ui.horizontal_top(|ui| {
                    ui.add_space(GUTTER);
                    ui.vertical(|ui| {
                        ui.set_max_width(ui.available_width());
                        changed = draw_block_content(ui, block, &kind);
                    });
                });
            },
        )
        .response;

    let row_rect = response.rect;
    let hovered = ui.rect_contains_pointer(row_rect);
    let handle_rect = Rect::from_min_size(
        pos2(row_top.x + 1.0, row_top.y + 3.0),
        vec2(20.0, 18.0),
    );
    let handle = ui
        .interact(
            handle_rect,
            ui.scope_id().with(("block-menu", index)),
            Sense::click(),
        )
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .on_hover_text("Block actions");
    icons::paint(
        ui.painter(),
        Rect::from_center_size(handle_rect.center(), vec2(13.0, 13.0)),
        Icon::Grip,
        if hovered || handle.hovered() {
            theme::MUTED
        } else {
            theme::fade(theme::FAINT, 0.45)
        },
    );

    egui::Popup::menu(&handle)
        .frame(popover_frame())
        .align(egui::RectAlign::BOTTOM_START)
        .show(|ui| {
            ui.set_min_width(178.0);
            if kind == "heading" {
                let level = block
                    .get("data")
                    .and_then(|data| data.get("level"))
                    .and_then(Value::as_u64)
                    .unwrap_or(1)
                    .clamp(1, 3);
                menu_header(ui, "Heading level");
                for candidate in 1..=3 {
                    if menu_row(
                        ui,
                        None,
                        &format!("Heading {candidate}"),
                        None,
                        level == candidate as u64,
                        true,
                        false,
                    )
                    .clicked()
                    {
                        op = Some(BlockOp::SetLevel(candidate));
                    }
                }
                menu_separator(ui);
            } else {
                menu_header(ui, &kind.replace('_', " "));
            }
            if menu_row(
                ui,
                Some(Icon::ArrowUp),
                "Move up",
                None,
                false,
                index > 0,
                false,
            )
            .clicked()
            {
                op = Some(BlockOp::Up);
            }
            if menu_row(
                ui,
                Some(Icon::ArrowDown),
                "Move down",
                None,
                false,
                index + 1 < block_count,
                false,
            )
            .clicked()
            {
                op = Some(BlockOp::Down);
            }
            menu_separator(ui);
            if menu_row(
                ui,
                Some(Icon::Trash),
                "Delete block",
                None,
                false,
                true,
                true,
            )
            .clicked()
            {
                op = Some(BlockOp::Delete);
            }
        });

    (changed, op)
}

fn draw_block_content(ui: &mut Ui, block: &mut Value, kind: &str) -> bool {
    match kind {
        "heading" => {
            let level = block
                .get("data")
                .and_then(|data| data.get("level"))
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .clamp(1, 3);
            let size = match level {
                1 => 26.0,
                2 => 21.0,
                _ => 17.0,
            };
            let mut text = block_data_text(block);
            let response = ui.add(
                TextEdit::multiline(&mut text)
                    .font(FontId::new(size, theme::display()))
                    .text_color(theme::INK)
                    .frame(Frame::NONE)
                    .margin(Margin::same(0))
                    .desired_width(f32::INFINITY)
                    .desired_rows(1)
                    .hint_text("Heading"),
            );
            if response.changed() {
                set_block_text(block, text);
                true
            } else {
                false
            }
        }
        "paragraph" => {
            let mut text = block_data_text(block);
            let rows = text.lines().count().max(1);
            let response = ui.add(
                TextEdit::multiline(&mut text)
                    .font(FontId::new(15.5, FontFamily::Proportional))
                    .text_color(theme::INK)
                    .frame(Frame::NONE)
                    .margin(Margin::same(0))
                    .desired_width(f32::INFINITY)
                    .desired_rows(rows)
                    .hint_text("Write something…"),
            );
            if response.changed() {
                set_block_text(block, text);
                true
            } else {
                false
            }
        }
        "todo_list" => draw_todo_block(ui, block),
        "callout" => draw_callout_block(ui, block),
        _ => {
            let inner = Frame::new()
                .fill(theme::SUNKEN)
                .corner_radius(theme::RADIUS)
                .stroke(theme::hairline())
                .inner_margin(Margin {
                    left: 14,
                    right: 14,
                    top: 11,
                    bottom: 11,
                })
                .show(ui, |ui| {
                    let _ = hud(
                        ui,
                        &format!("Preserved · {}", kind.replace('_', " ")),
                        theme::FAINT,
                    );
                    ui.add_space(6.0);
                    ui.add(
                        Label::new(
                            RichText::new(
                                "This block type is not editable in the native prototype.",
                            )
                            .size(12.0)
                            .color(theme::MUTED),
                        )
                        .wrap(),
                    );
                    ui.add_space(3.0);
                    ui.add(
                        Label::new(
                            RichText::new(
                                "It stays in canvas_state.json and opens in the web app.",
                            )
                            .size(11.0)
                            .color(theme::FAINT),
                        )
                        .wrap(),
                    );
                });
            let _ = inner;
            false
        }
    }
}

fn draw_todo_block(ui: &mut Ui, block: &mut Value) -> bool {
    let mut changed = false;
    let mut title = block
        .get("data")
        .and_then(|data| data.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("Tasks")
        .to_string();
    let title_response = ui.add(
        TextEdit::singleline(&mut title)
            .font(FontId::new(15.0, theme::semibold()))
            .text_color(theme::INK)
            .frame(Frame::NONE)
            .margin(Margin::same(0))
            .desired_width(f32::INFINITY)
            .hint_text("Tasks"),
    );
    if title_response.changed() {
        block["data"]["title"] = json!(title);
        changed = true;
    }
    ui.add_space(7.0);

    let mut items = block
        .get("data")
        .and_then(|data| data.get("items"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut items_changed = false;
    let mut remove_item: Option<usize> = None;

    if items.is_empty() {
        ui.label(
            RichText::new("No tasks yet.")
                .size(11.5)
                .color(theme::FAINT),
        );
    }

    for (item_index, item) in items.iter_mut().enumerate() {
        let mut done = item
            .get("status")
            .and_then(Value::as_str)
            .map(|status| status == "done")
            .or_else(|| item.get("done").and_then(Value::as_bool))
            .unwrap_or(false);
        let due = item
            .get("due")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let mut next_status: Option<String> = None;
        let mut delete = false;

        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 8.0;
            ui.add_space(1.0);
            if checkbox(ui, &mut done).changed() {
                item["done"] = json!(done);
                item["status"] = json!(if done { "done" } else { "todo" });
                items_changed = true;
            }

            let trailing = 56.0
                + if due.is_empty() { 0.0 } else { 66.0 }
                + 8.0;
            let text_w = (ui.available_width() - trailing).max(80.0);
            let mut text = item
                .get("text")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let text_response = ui.add_sized(
                vec2(text_w, 22.0),
                TextEdit::singleline(&mut text)
                    .frame(Frame::NONE)
                    .margin(Margin::same(0))
                    .font(FontId::new(13.5, FontFamily::Proportional))
                    .text_color(if done { theme::MUTED } else { theme::INK }),
            );
            if text_response.changed() {
                item["text"] = json!(text);
                items_changed = true;
            }

            if !due.is_empty() {
                ui.label(
                    RichText::new(due)
                        .family(theme::mono())
                        .size(9.0)
                        .color(theme::FAINT),
                );
            }

            let current = item
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or(if done { "done" } else { "todo" })
                .to_string();
            let status = status_pill(ui, &current);
            egui::Popup::menu(&status)
                .frame(popover_frame())
                .align(egui::RectAlign::BOTTOM_END)
                .show(|ui| {
                    ui.set_min_width(160.0);
                    menu_header(ui, "Task status");
                    for candidate in ["todo", "doing", "done"] {
                        if menu_row(
                            ui,
                            None,
                            status_label(candidate),
                            None,
                            current == candidate,
                            true,
                            false,
                        )
                        .clicked()
                        {
                            next_status = Some(candidate.to_string());
                        }
                    }
                    menu_separator(ui);
                    if menu_row(
                        ui,
                        Some(Icon::Trash),
                        "Delete task",
                        None,
                        false,
                        true,
                        true,
                    )
                    .clicked()
                    {
                        delete = true;
                    }
                });
        });

        if let Some(status) = next_status {
            item["status"] = json!(status);
            item["done"] = json!(status == "done");
            items_changed = true;
        }
        if delete {
            remove_item = Some(item_index);
        }
    }

    if let Some(index) = remove_item {
        if index < items.len() {
            items.remove(index);
            items_changed = true;
        }
    }

    ui.add_space(6.0);
    if text_button(ui, Some(Icon::Plus), "Add task", false).clicked() {
        items.push(json!({
            "id": format!("item_{}", now_nanos()),
            "text": "",
            "done": false,
            "status": "todo",
            "priority": "normal"
        }));
        items_changed = true;
    }

    if items_changed {
        block["data"]["items"] = Value::Array(items);
        changed = true;
    }
    changed
}

fn draw_callout_block(ui: &mut Ui, block: &mut Value) -> bool {
    let mut changed = false;
    let tone = block
        .get("data")
        .and_then(|data| data.get("tone"))
        .and_then(Value::as_str)
        .unwrap_or("blue");
    let tone_color = match tone {
        "emerald" => Color32::from_rgb(52, 211, 153),
        "amber" => theme::BADGE_BETA,
        "purple" => Color32::from_rgb(167, 139, 250),
        "rose" => Color32::from_rgb(251, 113, 133),
        _ => theme::ACCENT,
    };

    let inner = Frame::new()
        .fill(theme::WASH)
        .corner_radius(theme::RADIUS)
        .inner_margin(Margin {
            left: 16,
            right: 14,
            top: 11,
            bottom: 11,
        })
        .show(ui, |ui| {
            let mut title = block
                .get("data")
                .and_then(|data| data.get("title"))
                .and_then(Value::as_str)
                .unwrap_or("Note")
                .to_string();
            let title_response = ui.add(
                TextEdit::singleline(&mut title)
                    .font(FontId::new(13.5, theme::semibold()))
                    .text_color(theme::INK)
                    .frame(Frame::NONE)
                    .margin(Margin::same(0))
                    .desired_width(f32::INFINITY)
                    .hint_text("Note"),
            );
            if title_response.changed() {
                block["data"]["title"] = json!(title);
                changed = true;
            }
            ui.add_space(4.0);

            let mut content = block
                .get("data")
                .and_then(|data| data.get("content"))
                .and_then(Value::as_str)
                .or_else(|| {
                    block
                        .get("data")
                        .and_then(|data| data.get("text"))
                        .and_then(Value::as_str)
                })
                .unwrap_or("")
                .to_string();
            let rows = content.lines().count().max(1);
            let content_response = ui.add(
                TextEdit::multiline(&mut content)
                    .font(FontId::new(13.5, FontFamily::Proportional))
                    .text_color(theme::MUTED)
                    .frame(Frame::NONE)
                    .margin(Margin::same(0))
                    .desired_width(f32::INFINITY)
                    .desired_rows(rows)
                    .hint_text("Write a note…"),
            );
            if content_response.changed() {
                block["data"]["content"] = json!(content);
                changed = true;
            }
        });

    ui.painter().rect_filled(
        Rect::from_min_size(
            inner.response.rect.min,
            vec2(2.0, inner.response.rect.height()),
        ),
        0.0,
        tone_color,
    );
    changed
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

fn caps(
    ui: &Ui,
    text: &str,
    size: f32,
    family: FontFamily,
    spacing: f32,
    color: Color32,
) -> Arc<Galley> {
    let format = egui::TextFormat {
        font_id: FontId::new(size, family),
        color,
        extra_letter_spacing: spacing,
        ..Default::default()
    };
    ui.painter()
        .layout_job(egui::text::LayoutJob::single_section(
            text.to_uppercase(),
            format,
        ))
}

fn hud(ui: &mut Ui, text: &str, color: Color32) -> Response {
    let galley = caps(
        ui,
        text,
        theme::HUD_SIZE,
        theme::mono_bold(),
        theme::HUD_SPACING,
        color,
    );
    let (rect, response) = ui.allocate_exact_size(galley.size(), Sense::hover());
    ui.painter().galley(rect.min, galley, color);
    response
}

fn chevron(ui: &mut Ui, color: Color32) -> Response {
    let (rect, response) = ui.allocate_exact_size(vec2(10.0, 10.0), Sense::hover());
    icons::paint(
        ui.painter(),
        Rect::from_center_size(rect.center(), vec2(9.0, 9.0)),
        Icon::ChevronRight,
        color,
    );
    response
}

fn crumb_button(ui: &mut Ui, text: &str) -> Response {
    let galley = ui.painter().layout_no_wrap(
        text.to_string(),
        FontId::new(12.0, FontFamily::Proportional),
        theme::MUTED,
    );
    let (rect, response) = ui.allocate_exact_size(galley.size() + vec2(4.0, 2.0), Sense::click());
    let ink = if response.hovered() {
        theme::INK
    } else {
        theme::MUTED
    };
    ui.painter().galley_with_override_text_color(
        pos2(rect.left() + 2.0, rect.top() + 1.0),
        galley,
        ink,
    );
    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

fn dot_sep(ui: &mut Ui) {
    let (rect, _) = ui.allocate_exact_size(vec2(4.0, 10.0), Sense::hover());
    ui.painter()
        .circle_filled(rect.center(), 1.2, theme::fade(theme::FAINT, 0.8));
}

fn tag_chip(ui: &mut Ui, text: &str, color: Color32) -> Response {
    let galley = ui.painter().layout_no_wrap(
        text.to_string(),
        FontId::new(9.5, theme::mono()),
        color,
    );
    let size = galley.size() + vec2(14.0, 6.0);
    let (rect, response) = ui.allocate_exact_size(size, Sense::hover());
    ui.painter().rect(
        rect,
        theme::RADIUS,
        theme::fade(color, 0.07),
        Stroke::new(1.0, theme::fade(color, 0.3)),
        egui::StrokeKind::Inside,
    );
    ui.painter()
        .galley(pos2(rect.left() + 7.0, rect.top() + 3.0), galley, color);
    response
}

fn icon_button(
    ui: &mut Ui,
    icon: Icon,
    tip: &str,
    enabled: bool,
    active: bool,
) -> Response {
    let (rect, response) = ui.allocate_exact_size(
        vec2(28.0, 28.0),
        if enabled { Sense::click() } else { Sense::hover() },
    );
    let hovered = response.hovered() && enabled;
    if hovered || active {
        ui.painter()
            .rect_filled(rect, theme::RADIUS, theme::WASH);
    }
    let ink = if !enabled {
        theme::fade(theme::DIM, 0.4)
    } else if hovered || active {
        theme::INK
    } else {
        theme::DIM
    };
    icons::paint(
        ui.painter(),
        Rect::from_center_size(rect.center(), vec2(15.0, 15.0)),
        icon,
        ink,
    );
    let response = response.on_hover_text(tip);
    if enabled {
        response.on_hover_cursor(egui::CursorIcon::PointingHand)
    } else {
        response
    }
}

fn ghost(
    ui: &mut Ui,
    icon: Icon,
    label: Option<&str>,
    tip: &str,
    enabled: bool,
    height: f32,
) -> Response {
    let galley = label.map(|label| {
        ui.painter()
            .layout_no_wrap(label.to_string(), FontId::new(12.0, theme::medium()), theme::INK)
    });
    let width = match &galley {
        Some(galley) => 10.0 + 15.0 + 6.0 + galley.size().x + 10.0,
        None => 30.0,
    };
    let (rect, response) = ui.allocate_exact_size(
        vec2(width, height),
        if enabled { Sense::click() } else { Sense::hover() },
    );
    let hovered = response.hovered() && enabled;
    if hovered {
        ui.painter()
            .rect_filled(rect, theme::RADIUS, theme::WASH);
    }
    let ink = match (enabled, hovered) {
        (false, _) => theme::fade(theme::DIM, 0.4),
        (true, true) => theme::INK,
        (true, false) => theme::DIM,
    };
    match galley {
        Some(galley) => {
            let icon_rect = Rect::from_center_size(
                pos2(rect.left() + 10.0 + 7.5, rect.center().y),
                vec2(14.0, 14.0),
            );
            icons::paint(ui.painter(), icon_rect, icon, ink);
            ui.painter().galley_with_override_text_color(
                pos2(icon_rect.right() + 6.0, rect.center().y - galley.size().y / 2.0),
                galley,
                ink,
            );
        }
        None => {
            icons::paint(
                ui.painter(),
                Rect::from_center_size(rect.center(), vec2(15.0, 15.0)),
                icon,
                ink,
            );
        }
    }
    let response = response.on_hover_text(tip);
    if enabled {
        response.on_hover_cursor(egui::CursorIcon::PointingHand)
    } else {
        response
    }
}

fn text_button(ui: &mut Ui, icon: Option<Icon>, label: &str, active: bool) -> Response {
    let galley = ui.painter().layout_no_wrap(
        label.to_string(),
        FontId::new(11.5, theme::medium()),
        theme::MUTED,
    );
    let width = 8.0 + if icon.is_some() { 14.0 + 6.0 } else { 0.0 } + galley.size().x + 8.0;
    let (rect, response) = ui.allocate_exact_size(vec2(width, 24.0), Sense::click());
    let hovered = response.hovered();
    if hovered || active {
        ui.painter()
            .rect_filled(rect, theme::RADIUS, theme::WASH);
    }
    let ink = if hovered { theme::INK } else { theme::MUTED };
    let mut x = rect.left() + 8.0;
    if let Some(icon) = icon {
        icons::paint(
            ui.painter(),
            Rect::from_center_size(pos2(x + 7.0, rect.center().y), vec2(13.0, 13.0)),
            icon,
            ink,
        );
        x += 20.0;
    }
    ui.painter().galley_with_override_text_color(
        pos2(x, rect.center().y - galley.size().y / 2.0),
        galley,
        ink,
    );
    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

fn primary_button(ui: &mut Ui, label: &str, height: f32) -> Response {
    let galley = caps(
        ui,
        label,
        10.0,
        theme::mono_bold(),
        1.2,
        theme::INVERT_FG,
    );
    let width = galley.size().x + 36.0;
    let (rect, response) = ui.allocate_exact_size(vec2(width, height), Sense::click());
    let hovered = response.hovered();
    ui.painter().rect_filled(
        rect,
        theme::RADIUS,
        if hovered {
            theme::fade(theme::INVERT_BG, 0.9)
        } else {
            theme::INVERT_BG
        },
    );
    ui.painter().galley(
        rect.center() - galley.size() / 2.0,
        galley,
        theme::INVERT_FG,
    );
    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

fn secondary_button(
    ui: &mut Ui,
    icon: Option<Icon>,
    label: &str,
    height: f32,
) -> Response {
    let galley = caps(ui, label, 10.0, theme::mono_bold(), 1.2, theme::INK);
    let icon_w = if icon.is_some() { 13.0 + 8.0 } else { 0.0 };
    let width = galley.size().x + icon_w + 36.0;
    let (rect, response) = ui.allocate_exact_size(vec2(width, height), Sense::click());
    let hovered = response.hovered();
    let (fill, stroke, ink) = if hovered {
        (theme::INVERT_BG, Stroke::NONE, theme::INVERT_FG)
    } else {
        (
            Color32::TRANSPARENT,
            Stroke::new(1.0, theme::LINE_STRONG),
            theme::INK,
        )
    };
    ui.painter().rect(
        rect,
        theme::RADIUS,
        fill,
        stroke,
        egui::StrokeKind::Inside,
    );
    let content_w = icon_w + galley.size().x;
    let mut x = rect.center().x - content_w / 2.0;
    if let Some(icon) = icon {
        icons::paint(
            ui.painter(),
            Rect::from_center_size(pos2(x + 6.5, rect.center().y), vec2(13.0, 13.0)),
            icon,
            ink,
        );
        x += icon_w;
    }
    ui.painter().galley_with_override_text_color(
        pos2(x, rect.center().y - galley.size().y / 2.0),
        galley,
        ink,
    );
    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

fn checkbox(ui: &mut Ui, done: &mut bool) -> Response {
    let (rect, response) = ui.allocate_exact_size(vec2(16.0, 16.0), Sense::click());
    let hovered = response.hovered();
    let fill = if *done {
        theme::ACCENT
    } else if hovered {
        theme::WASH_HOVER
    } else {
        Color32::TRANSPARENT
    };
    let stroke = if *done {
        Stroke::NONE
    } else {
        Stroke::new(1.0, if hovered { theme::INK } else { theme::LINE_STRONG })
    };
    ui.painter()
        .rect(rect, theme::RADIUS, fill, stroke, egui::StrokeKind::Inside);
    if *done {
        icons::paint(
            ui.painter(),
            Rect::from_center_size(rect.center(), vec2(11.0, 11.0)),
            Icon::Check,
            Color32::WHITE,
        );
    }
    if response.clicked() {
        *done = !*done;
    }
    response.on_hover_cursor(egui::CursorIcon::PointingHand)
}

fn status_pill(ui: &mut Ui, status: &str) -> Response {
    let (label, color) = match status {
        "doing" => ("DOING", theme::ACCENT_INK),
        "done" => ("DONE", theme::FAINT),
        _ => ("TO DO", theme::MUTED),
    };
    let galley = caps(ui, label, 8.0, theme::mono_bold(), 0.9, color);
    let width = 8.0 + 5.0 + 5.0 + galley.size().x + 8.0;
    let (rect, response) = ui.allocate_exact_size(vec2(width, 20.0), Sense::click());
    let hovered = response.hovered();
    ui.painter().rect(
        rect,
        theme::RADIUS,
        if hovered {
            theme::WASH_HOVER
        } else {
            theme::WASH
        },
        Stroke::new(1.0, theme::fade(color, if hovered { 0.5 } else { 0.25 })),
        egui::StrokeKind::Inside,
    );
    ui.painter().circle_filled(
        pos2(rect.left() + 9.0, rect.center().y),
        2.0,
        color,
    );
    ui.painter().galley(
        pos2(
            rect.left() + 17.0,
            rect.center().y - galley.size().y / 2.0,
        ),
        galley,
        color,
    );
    response
        .on_hover_text("Task status and actions")
        .on_hover_cursor(egui::CursorIcon::PointingHand)
}

fn popover_frame() -> Frame {
    Frame::new()
        .fill(theme::CONTROLS)
        .stroke(theme::hairline())
        .corner_radius(theme::RADIUS)
        .shadow(theme::shadow())
        .inner_margin(Margin::same(4))
}

fn menu_header(ui: &mut Ui, text: &str) {
    let galley = caps(
        ui,
        text,
        theme::HUD_SIZE,
        theme::mono_bold(),
        theme::LABEL_SPACING,
        theme::fade(theme::INK, 0.5),
    );
    let (rect, _) = ui.allocate_exact_size(vec2(ui.available_width(), 26.0), Sense::hover());
    ui.painter().galley(
        pos2(rect.left() + 7.0, rect.center().y - galley.size().y / 2.0),
        galley,
        theme::INK,
    );
}

fn menu_separator(ui: &mut Ui) {
    let (rect, _) = ui.allocate_exact_size(vec2(ui.available_width(), 9.0), Sense::hover());
    ui.painter()
        .hline(rect.x_range(), rect.center().y, theme::hairline());
}

#[allow(clippy::too_many_arguments)]
fn menu_row(
    ui: &mut Ui,
    icon: Option<Icon>,
    label: &str,
    shortcut: Option<&str>,
    selected: bool,
    enabled: bool,
    danger: bool,
) -> Response {
    let (rect, response) = ui.allocate_exact_size(
        vec2(ui.available_width(), 30.0),
        if enabled { Sense::click() } else { Sense::hover() },
    );
    if response.hovered() && enabled {
        ui.painter()
            .rect_filled(rect, theme::RADIUS, theme::WASH_HOVER);
    }
    let ink = if !enabled {
        theme::FAINT
    } else if danger {
        theme::BAD
    } else {
        theme::INK
    };
    let mut x = rect.left() + 8.0;
    if let Some(icon) = icon {
        icons::paint(
            ui.painter(),
            Rect::from_center_size(pos2(x + 7.0, rect.center().y), vec2(14.0, 14.0)),
            icon,
            ink,
        );
        x += 22.0;
    }
    ui.painter().text(
        pos2(x, rect.center().y),
        Align2::LEFT_CENTER,
        label,
        FontId::new(12.5, theme::medium()),
        ink,
    );
    if let Some(shortcut) = shortcut {
        ui.painter().text(
            pos2(rect.right() - 8.0, rect.center().y),
            Align2::RIGHT_CENTER,
            shortcut,
            FontId::new(9.0, theme::mono()),
            theme::FAINT,
        );
    }
    if selected {
        icons::paint(
            ui.painter(),
            Rect::from_center_size(pos2(rect.right() - 14.0, rect.center().y), vec2(12.0, 12.0)),
            Icon::Check,
            theme::INK,
        );
    }
    if enabled {
        response.on_hover_cursor(egui::CursorIcon::PointingHand)
    } else {
        response
    }
}

fn info_popover(ui: &mut Ui, capsule: &Capsule) {
    ui.set_width(342.0);
    ui.add_space(2.0);
    menu_header(ui, "Page info");
    info_row(ui, "Message-ID", &capsule.message_id, true);
    info_row(ui, "File", &capsule.file_name, true);
    info_row(ui, "Date", &format_date_long(capsule), false);
    info_row(ui, "From", &capsule.from, false);
    info_row(ui, "To", &capsule.to, false);
    info_row(
        ui,
        "Format",
        if capsule.native {
            "CapsuleOS canvas · writable"
        } else {
            "Imported email · read-only"
        },
        false,
    );
    if !capsule.tags.is_empty() {
        info_row(ui, "Tags", &capsule.tags.join(" · "), false);
    }
    if capsule.attachments.is_empty() {
        info_row(ui, "Attachments", "None", false);
    } else {
        info_row(
            ui,
            "Attachments",
            &format!("{} files", capsule.attachments.len()),
            false,
        );
        for attachment in &capsule.attachments {
            ui.label(
                RichText::new(format!(
                    "{}  {}",
                    attachment.name,
                    human_bytes(attachment.size_bytes)
                ))
                .family(theme::mono())
                .size(9.5)
                .color(theme::MUTED),
            );
        }
    }
    ui.add_space(6.0);
}

fn info_row(ui: &mut Ui, label: &str, value: &str, mono: bool) {
    ui.add_space(8.0);
    let _ = hud(ui, label, theme::FAINT);
    ui.add_space(3.0);
    let rich = if mono {
        RichText::new(value)
            .family(theme::mono())
            .size(10.5)
            .color(theme::INK)
    } else {
        RichText::new(value)
            .size(11.5)
            .color(theme::INK)
    };
    ui.add(Label::new(rich).wrap().selectable(true));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn folder_name(dir: &Path) -> String {
    dir.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "Vault".to_string())
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    let mut chars = text.chars();
    let mut out: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        out.push('…');
    }
    out
}

fn format_date(capsule: &Capsule) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(capsule.timestamp)
        .map(|date| {
            date.with_timezone(&chrono::Local)
                .format("%b %e, %Y · %H:%M")
                .to_string()
        })
        .unwrap_or_else(|| capsule.date.clone())
}

fn format_date_long(capsule: &Capsule) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(capsule.timestamp)
        .map(|date| {
            date.with_timezone(&chrono::Local)
                .format("%A, %b %e, %Y at %H:%M")
                .to_string()
        })
        .unwrap_or_else(|| capsule.date.clone())
}

fn human_bytes(bytes: usize) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    }
}

fn status_label(status: &str) -> &'static str {
    match status {
        "doing" => "Doing",
        "done" => "Done",
        _ => "To do",
    }
}

fn now_nanos() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}

// Re-exported from mime for block content helpers.
fn block_data_text(block: &Value) -> String {
    mime::block_data_text(block)
}

fn set_block_text(block: &mut Value, text: String) {
    mime::set_block_text(block, text)
}

// Keep unused-import warnings honest while the prototype is small.
#[allow(dead_code)]
fn _vec2(_: Vec2, _: Pos2) {}
