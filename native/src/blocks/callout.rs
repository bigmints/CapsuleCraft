//! Callout / note block renderer.

use egui::{vec2, Color32, FontFamily, FontId, Frame, Margin, Rect, TextEdit, Ui};
use serde_json::{json, Value};

use crate::i18n::{t, Key, Locale};
use crate::theme;

pub fn draw_callout_block(ui: &mut Ui, block: &mut Value, locale: Locale) -> bool {
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
                .unwrap_or("")
                .to_string();
            let title_response = ui.add(
                TextEdit::singleline(&mut title)
                    .font(FontId::new(13.5, theme::semibold()))
                    .text_color(theme::INK)
                    .frame(Frame::NONE)
                    .margin(Margin::same(0))
                    .desired_width(f32::INFINITY)
                    .hint_text(t(locale, Key::BlockCallout)),
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
