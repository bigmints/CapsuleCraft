//! Brand assets shared by the window and the title bar.
//!
//! The mascot artwork ships inside the binary (`assets/icon.png`, 256 px) so a
//! single executable stays self-contained: no icon file has to sit next to it.

use egui::{ColorImage, Context, TextureHandle, TextureOptions};

const ICON_PNG: &[u8] = include_bytes!("../assets/icon.png");

/// Decode the embedded PNG into an egui image.
fn decode() -> Option<ColorImage> {
    let decoder = png::Decoder::new(std::io::Cursor::new(ICON_PNG));
    let mut reader = decoder.read_info().ok()?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buffer).ok()?;
    let size = [info.width as usize, info.height as usize];
    let bytes = &buffer[..info.buffer_size()];
    match info.color_type {
        png::ColorType::Rgba => Some(ColorImage::from_rgba_unmultiplied(size, bytes)),
        png::ColorType::Rgb => Some(ColorImage::from_rgb(size, bytes)),
        _ => None,
    }
}

/// The icon the operating system shows in the taskbar and window switcher.
pub fn window_icon() -> Option<egui::IconData> {
    let image = decode()?;
    Some(egui::IconData {
        rgba: image.as_raw().to_vec(),
        width: image.size[0] as u32,
        height: image.size[1] as u32,
    })
}

/// The mascot as a cached texture for the title bar.
pub fn texture(ctx: &Context) -> Option<TextureHandle> {
    let id = egui::Id::new("brand-mascot-texture");
    if let Some(handle) = ctx.data(|data| data.get_temp::<TextureHandle>(id)) {
        return Some(handle);
    }
    let image = decode()?;
    let handle = ctx.load_texture("brand-mascot", image, TextureOptions::LINEAR);
    ctx.data_mut(|data| data.insert_temp(id, handle.clone()));
    Some(handle)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_icon_decodes() {
        let image = decode().expect("mascot decodes");
        assert_eq!(image.size, [256, 256]);
        assert_eq!(image.pixels.len(), 256 * 256);
    }

    #[test]
    fn window_icon_has_rgba_bytes() {
        let icon = window_icon().expect("icon");
        assert_eq!(icon.width, 256);
        assert_eq!(icon.rgba.len(), (icon.width * icon.height * 4) as usize);
    }
}
