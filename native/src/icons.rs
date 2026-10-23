//! Small line icons painted with egui's painter, so the shell does not depend
//! on a default widget font for glyphs.

use egui::{pos2, Color32, Painter, Pos2, Rect, Shape, Stroke};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Icon {
    Doc,
    Folder,
    Search,
    Plus,
    ChevronRight,
    ChevronDown,
    Check,
    ArrowUp,
    ArrowDown,
    Trash,
    Grip,
    Info,
    Save,
    Reload,
    Lock,
}

fn at(rect: Rect, x: f32, y: f32) -> Pos2 {
    pos2(
        rect.left() + rect.width() * x,
        rect.top() + rect.height() * y,
    )
}

/// Paint `icon` inside `rect` with a 1.25 px line.
pub fn paint(painter: &Painter, rect: Rect, icon: Icon, color: Color32) {
    let stroke = Stroke::new(1.25, color);
    let p = painter;
    let line = |points: &[(f32, f32)]| {
        let pts: Vec<Pos2> = points.iter().map(|(x, y)| at(rect, *x, *y)).collect();
        p.add(Shape::line(pts, stroke));
    };
    let dot = |x: f32, y: f32, r: f32| {
        p.circle_filled(at(rect, x, y), rect.width().min(rect.height()) * r, color);
    };

    match icon {
        Icon::Doc => {
            p.rect_stroke(
                Rect::from_min_max(at(rect, 0.24, 0.13), at(rect, 0.76, 0.87)),
                1.5,
                stroke,
                egui::StrokeKind::Inside,
            );
            line(&[(0.38, 0.36), (0.62, 0.36)]);
            line(&[(0.38, 0.5), (0.62, 0.5)]);
            line(&[(0.38, 0.64), (0.55, 0.64)]);
        }
        Icon::Folder => {
            line(&[
                (0.13, 0.34),
                (0.13, 0.79),
                (0.87, 0.79),
                (0.87, 0.3),
                (0.46, 0.3),
                (0.38, 0.21),
                (0.13, 0.21),
                (0.13, 0.34),
            ]);
        }
        Icon::Search => {
            p.circle_stroke(at(rect, 0.43, 0.43), rect.width() * 0.25, stroke);
            line(&[(0.61, 0.61), (0.84, 0.84)]);
        }
        Icon::Plus => {
            line(&[(0.5, 0.18), (0.5, 0.82)]);
            line(&[(0.18, 0.5), (0.82, 0.5)]);
        }
        Icon::ChevronRight => line(&[(0.4, 0.25), (0.62, 0.5), (0.4, 0.75)]),
        Icon::ChevronDown => line(&[(0.25, 0.4), (0.5, 0.62), (0.75, 0.4)]),
        Icon::Check => line(&[(0.18, 0.52), (0.4, 0.73), (0.82, 0.27)]),
        Icon::ArrowUp => {
            line(&[(0.5, 0.82), (0.5, 0.2)]);
            line(&[(0.27, 0.43), (0.5, 0.2), (0.73, 0.43)]);
        }
        Icon::ArrowDown => {
            line(&[(0.5, 0.18), (0.5, 0.8)]);
            line(&[(0.27, 0.57), (0.5, 0.8), (0.73, 0.57)]);
        }
        Icon::Trash => {
            line(&[(0.18, 0.27), (0.82, 0.27)]);
            line(&[(0.4, 0.18), (0.6, 0.18)]);
            line(&[(0.28, 0.3), (0.33, 0.84), (0.67, 0.84), (0.72, 0.3)]);
            line(&[(0.44, 0.42), (0.44, 0.72)]);
            line(&[(0.56, 0.42), (0.56, 0.72)]);
        }
        Icon::Grip => {
            for y in [0.28, 0.5, 0.72] {
                dot(0.38, y, 0.055);
                dot(0.62, y, 0.055);
            }
        }
        Icon::Info => {
            p.circle_stroke(at(rect, 0.5, 0.5), rect.width() * 0.32, stroke);
            dot(0.5, 0.32, 0.05);
            line(&[(0.5, 0.45), (0.5, 0.7)]);
        }
        Icon::Save => {
            p.rect_stroke(
                Rect::from_min_max(at(rect, 0.2, 0.18), at(rect, 0.8, 0.82)),
                1.5,
                stroke,
                egui::StrokeKind::Inside,
            );
            line(&[(0.35, 0.18), (0.35, 0.42), (0.65, 0.42), (0.65, 0.18)]);
            p.rect_filled(
                Rect::from_min_max(at(rect, 0.35, 0.6), at(rect, 0.65, 0.82)),
                1.0,
                color,
            );
        }
        Icon::Reload => {
            let mut pts = Vec::new();
            let start = std::f32::consts::PI * 0.35;
            let end = std::f32::consts::PI * 1.95;
            for i in 0..=16 {
                let a = start + (end - start) * (i as f32 / 16.0);
                pts.push(pos2(
                    rect.center().x + rect.width() * 0.34 * a.cos(),
                    rect.center().y + rect.height() * 0.34 * a.sin(),
                ));
            }
            p.add(Shape::line(pts, stroke));
            let tip = at(rect, 0.78, 0.52);
            line(&[(0.64, 0.4), (0.78, 0.52), (0.66, 0.66)]);
            let _ = tip;
        }
        Icon::Lock => {
            p.rect_stroke(
                Rect::from_min_max(at(rect, 0.25, 0.45), at(rect, 0.75, 0.85)),
                1.0,
                stroke,
                egui::StrokeKind::Inside,
            );
            let mut pts = Vec::new();
            for i in 0..=10 {
                let a = std::f32::consts::PI * (1.0 + i as f32 / 10.0);
                pts.push(pos2(
                    rect.center().x + rect.width() * 0.18 * a.cos(),
                    rect.center().y + rect.height() * 0.08 + rect.height() * 0.18 * a.sin(),
                ));
            }
            p.add(Shape::line(pts, stroke));
            dot(0.5, 0.63, 0.05);
        }
    }
}
