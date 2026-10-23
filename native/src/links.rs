//! `[[Wiki links]]`: parsing, resolution, backlinks and the ranges the editor
//! uses to paint links differently from prose.
//!
//! The syntax is deliberately tiny and lives in the page text itself — no extra
//! header, no side table — so a link survives any editor that keeps the body
//! text intact. A link target is the page *subject* (case-insensitive, trimmed)
//! or, when the author needs to be exact, the Message-ID in angle brackets:
//! `[[<alpha@vault.local>]]`.

use serde_json::Value;

use crate::mime::Capsule;
use crate::theme;

/// One `[[…]]` occurrence: byte range of the whole marker plus its target.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LinkSpan {
    pub start: usize,
    pub end: usize,
    pub target: String,
}

/// Find every `[[target]]` span in `text`.
///
/// Unclosed `[[`, empty `[[ ]]` and nested brackets are ignored: a half-typed
/// link must not make the editor highlight everything after it.
pub fn spans(text: &str) -> Vec<LinkSpan> {
    let bytes = text.as_bytes();
    let mut out = Vec::new();
    let mut cursor = 0;
    while let Some(open) = text[cursor..].find("[[") {
        let start = cursor + open;
        let inner_start = start + 2;
        let Some(close) = text[inner_start..].find("]]") else {
            break;
        };
        let end = inner_start + close + 2;
        let raw = &text[inner_start..inner_start + close];
        if !raw.contains('[') && !raw.contains(']') {
            let target = raw.trim();
            if !target.is_empty() {
                out.push(LinkSpan {
                    start,
                    end,
                    target: target.to_string(),
                });
            }
        }
        cursor = end;
        if cursor >= bytes.len() {
            break;
        }
    }
    out
}

/// Unique targets in order of first appearance.
pub fn targets(text: &str) -> Vec<String> {
    let mut seen = Vec::new();
    for span in spans(text) {
        if !seen.iter().any(|existing: &String| existing.eq_ignore_ascii_case(&span.target)) {
            seen.push(span.target);
        }
    }
    seen
}

/// Everything a page says, as one string, for link scanning.
///
/// Structural keys (`id`, `type`) are skipped; every other string in a block's
/// `data` counts, including todo item text and callout bodies. Keeping this in
/// one place means a new block type is link-aware without touching the parser.
pub fn page_text(capsule: &Capsule) -> String {
    let mut text = String::new();
    text.push_str(&capsule.subject);
    text.push('\n');
    for block in &capsule.blocks {
        if let Some(data) = block.get("data") {
            collect_strings(data, &mut text);
        }
    }
    text
}

fn collect_strings(value: &Value, out: &mut String) {
    match value {
        Value::String(text) => {
            out.push_str(text);
            out.push('\n');
        }
        Value::Array(items) => {
            for item in items {
                collect_strings(item, out);
            }
        }
        Value::Object(map) => {
            for (key, value) in map {
                if key == "id" || key == "type" {
                    continue;
                }
                collect_strings(value, out);
            }
        }
        _ => {}
    }
}

/// Links written on a page, in document order.
pub fn page_targets(capsule: &Capsule) -> Vec<String> {
    targets(&page_text(capsule))
}

/// Compare titles the way a human would: case- and whitespace-insensitive.
pub fn normalise(title: &str) -> String {
    title
        .trim()
        .trim_matches(|ch| ch == '<' || ch == '>')
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Resolve a link target to a page index. Message-ID links win over titles,
/// because a title can be renamed while the id cannot.
pub fn resolve(target: &str, capsules: &[Capsule]) -> Option<usize> {
    let wanted = normalise(target);
    if wanted.is_empty() {
        return None;
    }
    if let Some(index) = capsules.iter().position(|capsule| {
        normalise(&capsule.message_id) == wanted
    }) {
        return Some(index);
    }
    capsules
        .iter()
        .position(|capsule| normalise(&capsule.subject) == wanted)
}

/// Pages that link to `index`, excluding the page itself. Sorted by subject so
/// the list does not shuffle when a page is edited.
pub fn backlinks(capsules: &[Capsule], index: usize) -> Vec<usize> {
    let Some(target) = capsules.get(index) else {
        return Vec::new();
    };
    let subject = normalise(&target.subject);
    let id = normalise(&target.message_id);
    let mut found: Vec<usize> = capsules
        .iter()
        .enumerate()
        .filter(|(other, capsule)| {
            *other != index
                && page_targets(capsule)
                    .iter()
                    .any(|link| normalise(link) == subject || normalise(link) == id)
        })
        .map(|(other, _)| other)
        .collect();
    found.sort_by(|a, b| {
        capsules[*a]
            .subject
            .to_lowercase()
            .cmp(&capsules[*b].subject.to_lowercase())
    });
    found
}

/// Lay out paragraph text with every `[[link]]` painted in the accent colour
/// and underlined, so the syntax is visible before it is clicked. Used as the
/// `TextEdit` layouter: the bytes stay plain text and only the glyph run
/// changes.
pub fn layout(ui: &egui::Ui, text: &str, size: f32, wrap: f32) -> std::sync::Arc<egui::Galley> {
    let font = egui::FontId::new(size, egui::FontFamily::Proportional);
    let mut job = egui::text::LayoutJob::default();
    job.wrap.max_width = wrap;
    let mut cursor = 0usize;
    for span in spans(text) {
        if span.start > cursor {
            job.append(&text[cursor..span.start], 0.0, plain(&font));
        }
        job.append(
            &text[span.start..span.end],
            0.0,
            egui::TextFormat {
                font_id: font.clone(),
                color: theme::ACCENT_INK,
                underline: egui::Stroke::new(1.0, theme::ACCENT),
                ..Default::default()
            },
        );
        cursor = span.end;
    }
    if cursor < text.len() || text.is_empty() {
        job.append(&text[cursor.min(text.len())..], 0.0, plain(&font));
    }
    ui.painter().layout_job(job)
}

fn plain(font: &egui::FontId) -> egui::TextFormat {
    egui::TextFormat {
        font_id: font.clone(),
        color: theme::INK,
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_simple_spans() {
        let found = spans("see [[Alpha]] and [[ Beta ]].");
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].target, "Alpha");
        assert_eq!(found[1].target, "Beta");
        assert_eq!(&"see [[Alpha]] and [[ Beta ]]."[found[1].start..found[1].end], "[[ Beta ]]");
    }

    #[test]
    fn ignores_unfinished_and_empty_links() {
        assert!(spans("[[ unclosed").is_empty());
        assert!(spans("[[   ]]").is_empty());
        assert!(spans("[[a[b]]").is_empty());
        assert_eq!(spans("[[ok]] [[x]]").len(), 2);
    }

    #[test]
    fn targets_are_unique_and_ordered() {
        assert_eq!(
            targets("[[b]] then [[A]] then [[b]]"),
            vec!["b".to_string(), "A".to_string()]
        );
    }

    fn capsule(id: &str, subject: &str, body: &str) -> Capsule {
        let mut capsule = Capsule::blank(id.to_string(), format!("{id}.eml"), subject.to_string());
        capsule.blocks = vec![serde_json::json!({
            "id": "paragraph-1",
            "type": "paragraph",
            "data": { "text": body }
        })];
        capsule
    }

    #[test]
    fn resolves_titles_case_insensitively() {
        let capsules = vec![
            capsule("<a@v>", "Memory map", ""),
            capsule("<b@v>", "Zero DB", ""),
        ];
        assert_eq!(resolve("  memory MAP ", &capsules), Some(0));
        assert_eq!(resolve("zero db", &capsules), Some(1));
        assert_eq!(resolve("missing", &capsules), None);
    }

    #[test]
    fn resolves_message_ids_exactly() {
        let capsules = vec![capsule("<a@v>", "Renamed page", "")];
        assert_eq!(resolve("<a@v>", &capsules), Some(0));
        assert_eq!(resolve("a@v", &capsules), Some(0));
    }

    #[test]
    fn backlinks_point_at_the_linking_pages() {
        let capsules = vec![
            capsule("<a@v>", "Alpha", "links to [[Gamma]]"),
            capsule("<b@v>", "Beta", "also [[gamma]] and [[Alpha]]"),
            capsule("<c@v>", "Gamma", "self [[Gamma]]"),
        ];
        // Alpha is linked from Beta only; Gamma is linked from Alpha, Beta and
        // never from itself.
        assert_eq!(backlinks(&capsules, 0), vec![1]);
        assert_eq!(backlinks(&capsules, 2), vec![0, 1]);
    }

    #[test]
    fn page_text_covers_nested_block_data() {
        let mut capsule = Capsule::blank("<x@v>".into(), "x.eml".into(), "Notes".into());
        capsule.blocks = vec![serde_json::json!({
            "id": "todo-1",
            "type": "todo_list",
            "data": {
                "title": "Work",
                "items": [{ "id": "item-1", "text": "read [[Alpha]]" }]
            }
        })];
        assert_eq!(page_targets(&capsule), vec!["Alpha".to_string()]);
    }
}
