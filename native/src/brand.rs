//! Brand assets shared by the window and the title bar.
//!
//! Two brand artwork styles ship inside the binary so a single executable
//! stays self-contained and allows switching between the mascot and minimal document style.

use egui::{ColorImage, Context, TextureHandle, TextureOptions};
use serde::{Deserialize, Serialize};

const ICON_DOC_PNG: &[u8] = include_bytes!("../assets/icon.png");
const ICON_MASCOT_PNG: &[u8] = include_bytes!("../assets/icon_mascot.png");

/// Brand icon style preference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum BrandIconStyle {
    Mascot,
    #[default]
    Document,
}

impl BrandIconStyle {
    pub fn toggle(self) -> Self {
        match self {
            Self::Mascot => Self::Document,
            Self::Document => Self::Mascot,
        }
    }

    pub fn key(self) -> &'static str {
        match self {
            Self::Mascot => "mascot",
            Self::Document => "document",
        }
    }
}

/// Decode the embedded PNG into an egui image for the chosen style.
pub fn decode(style: BrandIconStyle) -> Option<ColorImage> {
    let bytes = match style {
        BrandIconStyle::Mascot => ICON_MASCOT_PNG,
        BrandIconStyle::Document => ICON_DOC_PNG,
    };
    let decoder = png::Decoder::new(std::io::Cursor::new(bytes));
    let mut reader = decoder.read_info().ok()?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buffer).ok()?;
    let size = [info.width as usize, info.height as usize];
    let raw = &buffer[..info.buffer_size()];
    match info.color_type {
        png::ColorType::Rgba => Some(ColorImage::from_rgba_unmultiplied(size, raw)),
        png::ColorType::Rgb => Some(ColorImage::from_rgb(size, raw)),
        _ => None,
    }
}

/// The icon the operating system shows in the taskbar and window switcher.
pub fn window_icon(style: BrandIconStyle) -> Option<egui::IconData> {
    let image = decode(style)?;
    Some(egui::IconData {
        rgba: image.as_raw().to_vec(),
        width: image.size[0] as u32,
        height: image.size[1] as u32,
    })
}

/// The brand mark as a cached texture for the title bar.
pub fn texture(ctx: &Context, style: BrandIconStyle) -> Option<TextureHandle> {
    let id = match style {
        BrandIconStyle::Mascot => egui::Id::new("brand-mascot-texture"),
        BrandIconStyle::Document => egui::Id::new("brand-document-texture"),
    };
    if let Some(handle) = ctx.data(|data| data.get_temp::<TextureHandle>(id)) {
        return Some(handle);
    }
    let image = decode(style)?;
    let name = match style {
        BrandIconStyle::Mascot => "brand-mascot",
        BrandIconStyle::Document => "brand-document",
    };
    let handle = ctx.load_texture(name, image, TextureOptions::LINEAR);
    ctx.data_mut(|data| data.insert_temp(id, handle.clone()));
    Some(handle)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_icons_decode() {
        for style in [BrandIconStyle::Mascot, BrandIconStyle::Document] {
            let image = decode(style).expect("icon decodes");
            assert_eq!(image.size, [256, 256]);
            assert_eq!(image.pixels.len(), 256 * 256);
        }
    }

    #[test]
    fn window_icon_has_rgba_bytes() {
        for style in [BrandIconStyle::Mascot, BrandIconStyle::Document] {
            let icon = window_icon(style).expect("icon");
            assert_eq!(icon.width, 256);
            assert_eq!(icon.rgba.len(), (icon.width * icon.height * 4) as usize);
        }
    }

    #[test]
    fn brand_icon_style_toggles() {
        assert_eq!(BrandIconStyle::Mascot.toggle(), BrandIconStyle::Document);
        assert_eq!(BrandIconStyle::Document.toggle(), BrandIconStyle::Mascot);
    }
}
