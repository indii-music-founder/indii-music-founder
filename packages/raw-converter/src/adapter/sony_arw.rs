use crate::adapter::RawAdapter;
use crate::compression::ljpeg::decode_lossless_jpeg;
use crate::model::cfa::CfaPattern;
use crate::model::metadata::RawMetadata;
use crate::model::raw_image::NormalizedRawImage;
use byteorder::{ByteOrder, LittleEndian};

pub struct SonyArwAdapter;

impl SonyArwAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl RawAdapter for SonyArwAdapter {
    fn name(&self) -> &'static str {
        "Sony ARW Adapter"
    }

    fn can_parse(&self, bytes: &[u8]) -> bool {
        if bytes.len() < 16 {
            return false;
        }
        // Little-endian TIFF header: II (0x4949) + 42 (0x002A)
        if bytes[0] != 0x49 || bytes[1] != 0x49 || bytes[2] != 0x2A || bytes[3] != 0x00 {
            return false;
        }
        // Verify Sony Make in IFD0
        if let Some((make, _)) = self.identify(bytes) {
            make.to_uppercase().contains("SONY")
        } else {
            false
        }
    }

    fn identify(&self, bytes: &[u8]) -> Option<(String, String)> {
        if bytes.len() < 16 || bytes[0] != 0x49 || bytes[1] != 0x49 {
            return None;
        }

        let ifd0_offset = LittleEndian::read_u32(&bytes[4..8]) as usize;
        let tags = read_ifd_tags(bytes, ifd0_offset).ok()?;

        let mut make = "SONY".to_string();
        let mut model = "Unknown Sony".to_string();

        for tag in tags {
            if tag.tag_id == 271 {
                // Make
                if let Ok(s) = read_ascii_string(bytes, &tag) {
                    make = s.trim().to_string();
                }
            } else if tag.tag_id == 272 {
                // Model
                if let Ok(s) = read_ascii_string(bytes, &tag) {
                    model = s.trim().to_string();
                }
            }
        }

        Some((make, model))
    }

    fn parse(&self, bytes: &[u8]) -> Result<NormalizedRawImage, String> {
        if bytes.len() < 16 {
            return Err("Input file too small for Sony ARW".to_string());
        }

        let ifd0_offset = LittleEndian::read_u32(&bytes[4..8]) as usize;
        let ifd0_tags = read_ifd_tags(bytes, ifd0_offset)?;

        let mut make = "SONY".to_string();
        let mut model = "ILCE-7M3".to_string();
        let mut orientation = 1u16;
        let mut subifd_offset: Option<usize> = None;
        let mut exif_offset: Option<usize> = None;
        let mut ifd0_strip_offset = 0usize;
        let mut ifd0_strip_bytes = 0usize;

        for tag in &ifd0_tags {
            match tag.tag_id {
                271 => {
                    if let Ok(s) = read_ascii_string(bytes, tag) {
                        make = s.trim().to_string();
                    }
                }
                272 => {
                    if let Ok(s) = read_ascii_string(bytes, tag) {
                        model = s.trim().to_string();
                    }
                }
                274 => {
                    orientation = tag.value_or_offset as u16;
                }
                330 => {
                    // SubIFDs tag
                    if tag.count >= 1 {
                        if tag.count == 1 {
                            subifd_offset = Some(tag.value_or_offset as usize);
                        } else {
                            // Multiple SubIFD offsets stored at offset
                            let off = tag.value_or_offset as usize;
                            if off + 4 <= bytes.len() {
                                subifd_offset = Some(LittleEndian::read_u32(&bytes[off..off + 4]) as usize);
                            }
                        }
                    }
                }
                34665 => {
                    exif_offset = Some(tag.value_or_offset as usize);
                }
                273 => {
                    ifd0_strip_offset = tag.value_or_offset as usize;
                }
                279 => {
                    ifd0_strip_bytes = tag.value_or_offset as usize;
                }
                _ => {}
            }
        }

        // Preview extraction from IFD0 if JPEG
        let mut preview_jpeg: Option<Vec<u8>> = None;
        if ifd0_strip_offset > 0 && ifd0_strip_bytes > 0 && ifd0_strip_offset + ifd0_strip_bytes <= bytes.len() {
            let slice = &bytes[ifd0_strip_offset..ifd0_strip_offset + ifd0_strip_bytes];
            if slice.len() > 4 && slice[0] == 0xFF && slice[1] == 0xD8 {
                preview_jpeg = Some(slice.to_vec());
            }
        }

        // Read Raw SubIFD (or IFD0 if no SubIFD)
        let raw_ifd_offset = subifd_offset.unwrap_or(ifd0_offset);
        let raw_tags = read_ifd_tags(bytes, raw_ifd_offset)?;

        let mut width = 0u32;
        let mut height = 0u32;
        let mut bits_per_sample = 14u8;
        let mut compression = 1u16;
        let mut strip_offsets = Vec::new();
        let mut strip_byte_counts = Vec::new();
        let mut cfa_pattern = CfaPattern::RGGB;
        let mut raw_curve: Option<[u16; 4]> = None;
        let mut subifd_wb: Option<[f64; 3]> = None;

        for tag in &raw_tags {
            match tag.tag_id {
                256 => width = tag.value_or_offset,
                257 => height = tag.value_or_offset,
                258 => bits_per_sample = tag.value_or_offset as u8,
                259 => compression = tag.value_or_offset as u16,
                0x7010 => {
                    // SonyCurve 4x u16 points
                    let off = tag.value_or_offset as usize;
                    if off + 8 <= bytes.len() {
                        raw_curve = Some([
                            LittleEndian::read_u16(&bytes[off..off + 2]),
                            LittleEndian::read_u16(&bytes[off + 2..off + 4]),
                            LittleEndian::read_u16(&bytes[off + 4..off + 6]),
                            LittleEndian::read_u16(&bytes[off + 6..off + 8]),
                        ]);
                    }
                }
                0x7313 => {
                    // WB_RGGBLevels in SubIFD
                    let off = tag.value_or_offset as usize;
                    if off + 8 <= bytes.len() {
                        let r = LittleEndian::read_u16(&bytes[off..off + 2]) as f64;
                        let gr = LittleEndian::read_u16(&bytes[off + 2..off + 4]) as f64;
                        let gb = LittleEndian::read_u16(&bytes[off + 4..off + 6]) as f64;
                        let b = LittleEndian::read_u16(&bytes[off + 6..off + 8]) as f64;
                        if r > 0.0 && b > 0.0 {
                            let g = (gr + gb) / 2.0;
                            subifd_wb = Some([g / r, 1.0, g / b]);
                        }
                    }
                }
                273 => {
                    // StripOffsets
                    if tag.count == 1 {
                        strip_offsets.push(tag.value_or_offset as usize);
                    } else {
                        let off = tag.value_or_offset as usize;
                        for i in 0..(tag.count as usize) {
                            let p = off + i * 4;
                            if p + 4 <= bytes.len() {
                                strip_offsets.push(LittleEndian::read_u32(&bytes[p..p + 4]) as usize);
                            }
                        }
                    }
                }
                279 => {
                    // StripByteCounts
                    if tag.count == 1 {
                        strip_byte_counts.push(tag.value_or_offset as usize);
                    } else {
                        let off = tag.value_or_offset as usize;
                        for i in 0..(tag.count as usize) {
                            let p = off + i * 4;
                            if p + 4 <= bytes.len() {
                                strip_byte_counts.push(LittleEndian::read_u32(&bytes[p..p + 4]) as usize);
                            }
                        }
                    }
                }
                33422 => {
                    // CFAPattern
                    if tag.count >= 4 {
                        let off = if tag.count <= 4 {
                            // Packed in value_or_offset
                            tag.value_or_offset.to_le_bytes()
                        } else {
                            let p = tag.value_or_offset as usize;
                            if p + 4 <= bytes.len() {
                                [bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]]
                            } else {
                                [0, 1, 1, 2]
                            }
                        };
                        cfa_pattern = match off {
                            [0, 1, 1, 2] => CfaPattern::RGGB,
                            [2, 1, 1, 0] => CfaPattern::BGGR,
                            [1, 0, 2, 1] => CfaPattern::GRBG,
                            [1, 2, 0, 1] => CfaPattern::GBRG,
                            _ => CfaPattern::RGGB,
                        };
                    }
                }
                _ => {}
            }
        }

        if width == 0 || height == 0 {
            return Err("Failed to resolve RAW image dimensions from ARW".to_string());
        }

        // Parse EXIF and MakerNote for White Balance (0x7313)
        let mut as_shot_neutral = subifd_wb.unwrap_or([0.55, 1.0, 0.65]);
        let mut iso: Option<u32> = None;
        let mut exposure_time: Option<(u32, u32)> = None;
        let mut f_number: Option<(u32, u32)> = None;
        let mut focal_length: Option<(u32, u32)> = None;
        let mut lens_model: Option<String> = None;
        let mut date_time_original: Option<String> = None;

        if let Some(exif_off) = exif_offset {
            if let Ok(exif_tags) = read_ifd_tags(bytes, exif_off) {
                for tag in &exif_tags {
                    match tag.tag_id {
                        34855 => iso = Some(tag.value_or_offset),
                        33434 => {
                            // ExposureTime (RATIONAL: num, den)
                            let off = tag.value_or_offset as usize;
                            if off + 8 <= bytes.len() {
                                exposure_time = Some((
                                    LittleEndian::read_u32(&bytes[off..off + 4]),
                                    LittleEndian::read_u32(&bytes[off + 4..off + 8]),
                                ));
                            }
                        }
                        33437 => {
                            // FNumber
                            let off = tag.value_or_offset as usize;
                            if off + 8 <= bytes.len() {
                                f_number = Some((
                                    LittleEndian::read_u32(&bytes[off..off + 4]),
                                    LittleEndian::read_u32(&bytes[off + 4..off + 8]),
                                ));
                            }
                        }
                        37386 => {
                            // FocalLength
                            let off = tag.value_or_offset as usize;
                            if off + 8 <= bytes.len() {
                                focal_length = Some((
                                    LittleEndian::read_u32(&bytes[off..off + 4]),
                                    LittleEndian::read_u32(&bytes[off + 4..off + 8]),
                                ));
                            }
                        }
                        36867 => {
                            if let Ok(s) = read_ascii_string(bytes, tag) {
                                date_time_original = Some(s.trim().to_string());
                            }
                        }
                        42036 => {
                            if let Ok(s) = read_ascii_string(bytes, tag) {
                                lens_model = Some(s.trim().to_string());
                            }
                        }
                        37500 => {
                            // MakerNote: search for Sony WB_RGGBLevels (0x7313)
                            let mn_off = tag.value_or_offset as usize;
                            let mn_len = tag.count as usize;
                            if mn_off + mn_len <= bytes.len() {
                                let mn_bytes = &bytes[mn_off..mn_off + mn_len];
                                if let Some(wb) = extract_sony_white_balance(mn_bytes) {
                                    as_shot_neutral = wb;
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        // Camera Calibration & Baseline Exposure
        // Sony ILCE-7 series requires +0.35 EV BaselineExposure lift to avoid dark renders
        let baseline_exposure = 0.35;
        let color_matrix1 = [
            0.8638, -0.2974, -0.0403,
            -0.5186, 1.3051, 0.2372,
            -0.0827, 0.1691, 0.6729,
        ];
        let color_matrix2 = [
            0.7323, -0.1983, -0.0617,
            -0.4578, 1.2584, 0.2227,
            -0.0768, 0.1704, 0.6482,
        ];

        let metadata = RawMetadata {
            make,
            model: model.clone(),
            unique_camera_model: format!("Sony {}", model),
            orientation,
            as_shot_neutral,
            color_matrix1,
            color_matrix2,
            calibration_illuminant1: 17,
            calibration_illuminant2: 21,
            baseline_exposure,
            iso,
            exposure_time,
            f_number,
            focal_length,
            lens_model,
            date_time_original,
        };

        // Decode Sensor CFA Samples
        let total_pixels = (width as usize) * (height as usize);
        let mut samples = vec![0u16; total_pixels];

        if compression == 1 {
            // Uncompressed 14-bit CFA: stored as 16-bit LE words
            if let Some(&first_offset) = strip_offsets.first() {
                let required_bytes = total_pixels * 2;
                if first_offset + required_bytes <= bytes.len() {
                    let slice = &bytes[first_offset..first_offset + required_bytes];
                    for i in 0..total_pixels {
                        samples[i] = LittleEndian::read_u16(&slice[i * 2..i * 2 + 2]);
                    }
                } else {
                    // Truncated uncompressed stream: read available samples
                    let avail_words = (bytes.len().saturating_sub(first_offset)) / 2;
                    let count = avail_words.min(total_pixels);
                    let slice = &bytes[first_offset..first_offset + count * 2];
                    for i in 0..count {
                        samples[i] = LittleEndian::read_u16(&slice[i * 2..i * 2 + 2]);
                    }
                }
            }
        } else if compression == 6 {
            // Lossless JPEG segments
            if let Some(&first_offset) = strip_offsets.first() {
                let total_bytes = strip_byte_counts.first().cloned().unwrap_or(bytes.len() - first_offset);
                if first_offset + total_bytes <= bytes.len() {
                    let ljpeg_bytes = &bytes[first_offset..first_offset + total_bytes];
                    if let Ok((decoded_samples, _dec_w, _dec_h, _, _)) = decode_lossless_jpeg(ljpeg_bytes) {
                        let count = decoded_samples.len().min(samples.len());
                        samples[..count].copy_from_slice(&decoded_samples[..count]);
                    }
                }
            }
        } else if compression == 32767 {
            // Sony cRAW (ARW 2.x lossy compressed raw)
            samples = decode_sony_craw(
                bytes,
                &strip_offsets,
                width as usize,
                height as usize,
                raw_curve,
            )?;
        } else {
            return Err(format!(
                "Unsupported Sony ARW compression tag: {}. Only Lossless JPEG (6), cRAW (32767), and Uncompressed (1) are supported.",
                compression
            ));
        }

        let active_area = [0, 0, height, width];

        Ok(NormalizedRawImage {
            width,
            height,
            active_area,
            bit_depth: bits_per_sample,
            cfa_pattern,
            black_level: 512,
            white_level: 16383,
            samples,
            preview_jpeg,
            original_raw_bytes: Some(bytes.to_vec()),
            metadata,
        })
    }
}

/// Decodes Sony ARW 2.x lossy compressed raw (cRAW, compression = 32767).
fn decode_sony_craw(
    bytes: &[u8],
    strip_offsets: &[usize],
    width: usize,
    height: usize,
    raw_curve: Option<[u16; 4]>,
) -> Result<Vec<u16>, String> {
    let first_offset = *strip_offsets.first().ok_or_else(|| "Missing strip offset for cRAW".to_string())?;
    let mut image = vec![0u16; width * height];

    // Build curve table (0..4095) from Tag 0x7010
    let mut sony_curve = [0usize, 0, 0, 0, 0, 4095];
    if let Some(c) = raw_curve {
        for i in 0..4 {
            sony_curve[i + 1] = ((c[i] >> 2) & 0xfff) as usize;
        }
    } else {
        sony_curve = [0, 2000, 2600, 3225, 3525, 4095]; // Standard Sony default
    }

    let mut curve = [0u16; 4096];
    for i in 0..5 {
        for j in (sony_curve[i] + 1)..=sony_curve[i + 1] {
            curve[j] = curve[j - 1] + (1 << i);
        }
    }

    for row in 0..height {
        let row_offset = first_offset + row * width;
        if row_offset + width > bytes.len() {
            break;
        }
        let row_bytes = &bytes[row_offset..row_offset + width];

        let mut col = 0usize;
        let mut data_idx = 0usize;

        while col < width.saturating_sub(30) && data_idx + 16 <= row_bytes.len() {
            let data_val = LittleEndian::read_u32(&row_bytes[data_idx..data_idx + 4]);
            let max_val = (data_val & 0x7ff) as u16;
            let min_val = ((data_val >> 11) & 0x7ff) as u16;
            let max_idx = ((data_val >> 22) & 0x0f) as usize;
            let min_idx = ((data_val >> 26) & 0x0f) as usize;

            let max_minus_min = max_val as i32 - min_val as i32;
            let shift = (0..4).find(|&s| (0x80 << s) > max_minus_min).unwrap_or(4);

            let mut pixels = [0u16; 16];
            let mut bit = 30usize;

            for i in 0..16 {
                if i == max_idx {
                    pixels[i] = max_val;
                } else if i == min_idx {
                    pixels[i] = min_val;
                } else {
                    let byte_off = data_idx + (bit >> 3);
                    let w = if byte_off + 2 <= row_bytes.len() {
                        LittleEndian::read_u16(&row_bytes[byte_off..byte_off + 2])
                    } else if byte_off < row_bytes.len() {
                        row_bytes[byte_off] as u16
                    } else {
                        0u16
                    };
                    let delta = (((w >> (bit & 7)) & 0x7f) << shift) as u16;
                    bit += 7;
                    pixels[i] = (delta + min_val).min(0x7ff);
                }
            }

            for &p in &pixels {
                if col < width {
                    let idx = (p << 1).min(4095) as usize;
                    image[row * width + col] = curve[idx];
                }
                col += 2;
            }

            col = if col & 1 == 0 {
                col.saturating_sub(31)
            } else {
                col.saturating_sub(1)
            };
            data_idx += 16;
        }
    }

    Ok(image)
}

// ----------------------------------------------------------------------------
// Low-level TIFF / IFD Parsing Helpers
// ----------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct IfdEntry {
    pub tag_id: u16,
    pub tag_type: u16,
    pub count: u32,
    pub value_or_offset: u32,
}

pub fn read_ifd_tags(bytes: &[u8], offset: usize) -> Result<Vec<IfdEntry>, String> {
    if offset + 2 > bytes.len() {
        return Err("IFD offset out of bounds".to_string());
    }

    let num_entries = LittleEndian::read_u16(&bytes[offset..offset + 2]) as usize;
    let mut entries = Vec::with_capacity(num_entries);
    let mut curr = offset + 2;

    for _ in 0..num_entries {
        if curr + 12 > bytes.len() {
            break;
        }
        let tag_id = LittleEndian::read_u16(&bytes[curr..curr + 2]);
        let tag_type = LittleEndian::read_u16(&bytes[curr + 2..curr + 4]);
        let count = LittleEndian::read_u32(&bytes[curr + 4..curr + 8]);
        let value_or_offset = LittleEndian::read_u32(&bytes[curr + 8..curr + 12]);

        entries.push(IfdEntry {
            tag_id,
            tag_type,
            count,
            value_or_offset,
        });
        curr += 12;
    }

    Ok(entries)
}

pub fn read_ascii_string(bytes: &[u8], entry: &IfdEntry) -> Result<String, String> {
    if entry.count == 0 {
        return Ok(String::new());
    }
    let count = entry.count as usize;
    if count <= 4 {
        let raw = entry.value_or_offset.to_le_bytes();
        let len = raw.iter().position(|&c| c == 0).unwrap_or(count);
        Ok(String::from_utf8_lossy(&raw[..len]).to_string())
    } else {
        let off = entry.value_or_offset as usize;
        if off + count > bytes.len() {
            return Err("ASCII string offset out of bounds".to_string());
        }
        let slice = &bytes[off..off + count];
        let len = slice.iter().position(|&c| c == 0).unwrap_or(count);
        Ok(String::from_utf8_lossy(&slice[..len]).to_string())
    }
}

/// Extracts Sony white balance neutral multipliers from MakerNote by searching for
/// tag 0x7313 (WB_RGGBLevels).
fn extract_sony_white_balance(bytes: &[u8]) -> Option<[f64; 3]> {
    // Search for 0x7313 in MakerNote tag entries
    if bytes.len() < 12 {
        return None;
    }
    for i in 0..bytes.len().saturating_sub(12) {
        if bytes[i] == 0x13 && bytes[i + 1] == 0x73 {
            // Tag 0x7313
            let count = LittleEndian::read_u32(&bytes[i + 4..i + 8]) as usize;
            let val_off = LittleEndian::read_u32(&bytes[i + 8..i + 12]) as usize;
            if count >= 4 && val_off + 8 <= bytes.len() {
                let r = LittleEndian::read_u16(&bytes[val_off..val_off + 2]) as f64;
                let gr = LittleEndian::read_u16(&bytes[val_off + 2..val_off + 4]) as f64;
                let gb = LittleEndian::read_u16(&bytes[val_off + 4..val_off + 6]) as f64;
                let b = LittleEndian::read_u16(&bytes[val_off + 6..val_off + 8]) as f64;
                if r > 0.0 && b > 0.0 && gr > 0.0 {
                    let g_avg = (gr + gb) / 2.0;
                    return Some([g_avg / r, 1.0, g_avg / b]);
                }
            }
        }
    }
    None
}
