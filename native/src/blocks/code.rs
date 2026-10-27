//! Code snippet / REPL block renderer.

use egui::{Align, FontId, Frame, Label, Layout, Margin, RichText, TextEdit, Ui};
use serde_json::{json, Value};

use crate::i18n::{t, Key, Locale};
use crate::icons::Icon;
use crate::theme;
use crate::{ghost, hud, menu_header, menu_row, popover_frame};

pub fn draw_code_block(ui: &mut Ui, block: &mut Value, locale: Locale) -> bool {
    let mut changed = false;
    Frame::new()
        .fill(theme::SUNKEN)
        .corner_radius(theme::RADIUS)
        .stroke(theme::hairline())
        .inner_margin(Margin {
            left: 14,
            right: 14,
            top: 10,
            bottom: 12,
        })
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                let language = block
                    .get("data")
                    .and_then(|data| data.get("language"))
                    .and_then(Value::as_str)
                    .unwrap_or("javascript")
                    .to_string();
                let response = ghost(
                    ui,
                    Icon::Code,
                    Some(language.as_str()),
                    t(locale, Key::Language),
                    true,
                    24.0,
                );
                egui::Popup::menu(&response)
                    .frame(popover_frame())
                    .align(egui::RectAlign::BOTTOM_START)
                    .show(|ui| {
                        ui.set_min_width(150.0);
                        menu_header(ui, t(locale, Key::Language));
                        for candidate in ["javascript", "typescript", "python", "rust", "sql", "json"]
                        {
                            if menu_row(
                                ui,
                                None,
                                candidate,
                                None,
                                language == candidate,
                                true,
                                false,
                            )
                            .clicked()
                            {
                                block["data"]["language"] = json!(candidate);
                                changed = true;
                            }
                        }
                    });
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    let _ = hud(ui, t(locale, Key::NotExecuted), theme::FAINT);
                });
            });
            ui.add_space(8.0);

            let mut code = block
                .get("data")
                .and_then(|data| data.get("code"))
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let rows = code.lines().count().max(4);
            let response = ui.add(
                TextEdit::multiline(&mut code)
                    .font(FontId::new(12.5, theme::mono()))
                    .text_color(theme::INK)
                    .frame(Frame::NONE)
                    .margin(Margin::same(0))
                    .desired_width(f32::INFINITY)
                    .desired_rows(rows)
                    .code_editor()
                    .hint_text(t(locale, Key::PlaceholderCode)),
            );
            if response.changed() {
                block["data"]["code"] = json!(code);
                changed = true;
            }

            if let Some(output) = block
                .get("data")
                .and_then(|data| data.get("output"))
                .and_then(Value::as_str)
                .filter(|output| !output.trim().is_empty())
            {
                ui.add_space(10.0);
                let _ = hud(ui, t(locale, Key::CodeOutput), theme::FAINT);
                ui.add_space(3.0);
                ui.add(
                    Label::new(
                        RichText::new(output)
                            .family(theme::mono())
                            .size(11.5)
                            .color(theme::MUTED),
                    )
                    .wrap(),
                );
            }
            ui.add_space(6.0);
            let _ = hud(ui, t(locale, Key::RunUnavailable), theme::fade(theme::FAINT, 0.85));
        });
    changed
}
