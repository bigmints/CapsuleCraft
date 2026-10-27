//! Data grid / table block renderer and CSV helpers.

use egui::{vec2, Align, FontId, Frame, Layout, Margin, ScrollArea, Stroke, TextEdit, Ui};
use serde_json::{json, Value};

use crate::i18n::{t, Key, Locale};
use crate::mime::Attachment;
use crate::theme;
use crate::{hud, text_button};

/// Split CSV into rows. Deliberately simple: no quoted fields, no embedded
/// commas — the same limitation the web grid has.
pub fn parse_csv(raw: &str) -> Vec<Vec<String>> {
    raw.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            line.split(',')
                .map(|cell| cell.trim().to_string())
                .collect::<Vec<_>>()
        })
        .collect()
}

pub fn to_csv(table: &[Vec<String>]) -> String {
    table
        .iter()
        .map(|row| row.join(","))
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn draw_grid_block(
    ui: &mut Ui,
    block: &mut Value,
    attachments: &mut [Attachment],
    locale: Locale,
) -> bool {
    let source = block
        .get("data")
        .and_then(|data| data.get("source_cid"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let clean = source
        .trim_start_matches("cid:")
        .trim_matches(|ch| ch == '<' || ch == '>')
        .to_string();
    let found = attachments.iter().position(|attachment| {
        attachment.cid == clean
            || format!("cid:{}", attachment.cid) == source
            || attachment.name == clean
    });

    let mut changed = false;
    Frame::new()
        .fill(theme::SUNKEN)
        .corner_radius(theme::RADIUS)
        .stroke(theme::hairline())
        .inner_margin(Margin {
            left: 12,
            right: 12,
            top: 10,
            bottom: 12,
        })
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                let name = found
                    .map(|index| attachments[index].name.clone())
                    .unwrap_or_else(|| t(locale, Key::BlockGrid).to_string());
                let _ = hud(ui, &name, theme::FAINT);
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if found.is_some() {
                        if text_button(ui, None, t(locale, Key::AddRow), false).clicked() {
                            block["data"]["__add_row"] = json!(true);
                        }
                        if text_button(ui, None, t(locale, Key::AddColumn), false).clicked() {
                            block["data"]["__add_col"] = json!(true);
                        }
                    }
                });
            });
            ui.add_space(8.0);

            let Some(index) = found else {
                let _ = hud(ui, t(locale, Key::DataGridMissing), theme::MUTED);
                return;
            };

            let mut table = parse_csv(&attachments[index].content);
            if table.is_empty() {
                table.push(vec![t(locale, Key::RenameField).to_string()]);
                table.push(vec![String::new()]);
            }
            let add_row = block["data"]
                .get("__add_row")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let add_col = block["data"]
                .get("__add_col")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if let Some(data) = block.get_mut("data").and_then(Value::as_object_mut) {
                data.remove("__add_row");
                data.remove("__add_col");
            }
            if add_row {
                let width = table[0].len();
                table.push(vec![String::new(); width]);
            }
            if add_col {
                for row in table.iter_mut() {
                    row.push(String::new());
                }
            }

            let columns = table.iter().map(Vec::len).max().unwrap_or(0).max(1);
            let cell_width = ((ui.available_width() - 24.0) / columns as f32 - 8.0).max(70.0);
            let mut table_changed = false;

            ScrollArea::horizontal()
                .id_salt((
                    "grid-scroll",
                    block.get("id").and_then(Value::as_str).unwrap_or(""),
                ))
                .auto_shrink([false, true])
                .show(ui, |ui| {
                    for (row_index, row) in table.iter_mut().enumerate() {
                        ui.horizontal(|ui| {
                            ui.spacing_mut().item_spacing.x = 6.0;
                            for column in 0..columns {
                                if row.len() <= column {
                                    row.push(String::new());
                                }
                                let mut cell = row[column].clone();
                                let font = if row_index == 0 {
                                    FontId::new(11.0, theme::mono_bold())
                                } else {
                                    FontId::new(11.5, theme::mono())
                                };
                                let response = ui.add_sized(
                                    vec2(cell_width, 22.0),
                                    TextEdit::singleline(&mut cell)
                                        .font(font)
                                        .text_color(if row_index == 0 {
                                            theme::MUTED
                                        } else {
                                            theme::INK
                                        })
                                        .frame(Frame::NONE)
                                        .margin(Margin::symmetric(4, 2))
                                        .desired_width(cell_width),
                                );
                                if response.changed() {
                                    row[column] = cell;
                                    table_changed = true;
                                }
                            }
                        });
                        let line_y = ui.cursor().min.y;
                        let line_x = ui.cursor().min.x;
                        ui.painter().hline(
                            egui::Rangef::new(line_x, line_x + cell_width * columns as f32),
                            line_y,
                            Stroke::new(1.0, theme::fade(theme::LINE, 0.55)),
                        );
                        ui.add_space(2.0);
                    }
                });

            if table_changed || add_row || add_col {
                attachments[index].content = to_csv(&table);
                attachments[index].size_bytes = attachments[index].content.len();
                changed = true;
            }
        });
    changed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_csv_parse_and_serialize() {
        let raw = "a, b, c\n1, 2, 3";
        let table = parse_csv(raw);
        assert_eq!(table.len(), 2);
        assert_eq!(table[0], vec!["a", "b", "c"]);
        assert_eq!(table[1], vec!["1", "2", "3"]);
        let serialized = to_csv(&table);
        assert_eq!(serialized, "a,b,c\n1,2,3");
    }
}
