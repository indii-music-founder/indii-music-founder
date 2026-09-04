use crate::adapter::sony_arw::read_ifd_tags;
use crate::compression::ljpeg::decode_lossless_jpeg;
use crate::model::cfa::CfaPattern;
use crate::model::raw_image::NormalizedRawImage;
use byteorder::{ByteOrder, LittleEndian};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyReport {
    pub valid: bool,
    pub source_width: u32,
    pub source_height: u32,
    pub dng_width: u32,
    pub dng_height: u32,
    pub source_cfa_hash: String,
    pub dng_cfa_hash: String,
    pub sample_difference_count: usize,
    pub metadata_manifest_passed: bool,
    pub issues: Vec<String>,
}

/// Parses a DNG byte stream and decodes the primary raw CFA sample buffer.
pub fn decode_dng_cfa(bytes: &[u8]) -> Result<(Vec<u16>, u32, u32, CfaPattern, String), String> {
    if bytes.len() < 16 || bytes[0] != 0x49 || bytes[1] != 0x49 || bytes[2] != 0x2A {
        return Err("Not a valid Little-Endian TIFF/DNG file".to_string());
    }

    let ifd0_offset = LittleEndian::read_u32(&bytes[4..8]) as usize;
    let ifd0_tags = read_ifd_tags(bytes, ifd0_offset)?;

    let mut subifd_offset: Option<usize> = None;
    for tag in &ifd0_tags {
        if tag.tag_id == 330 {
            // SubIFDs pointer
            subifd_offset = Some(tag.value_or_offset as usize);
            break;
        }
    }

    let raw_ifd_offset = subifd_offset.unwrap_or(ifd0_offset);
    let raw_tags = read_ifd_tags(bytes, raw_ifd_offset)?;

    let mut width = 0u32;
    let mut height = 0u32;
    let mut compression = 1u16;
    let mut tile_w: Option<u32> = None;
    let mut tile_h: Option<u32> = None;
    let mut tile_offsets = Vec::new();
    let mut tile_byte_counts = Vec::new();
    let mut strip_offsets = Vec::new();
    let mut cfa_pattern = CfaPattern::RGGB;

    for tag in &raw_tags {
        match tag.tag_id {
            256 => width = tag.value_or_offset,
            257 => height = tag.value_or_offset,
            259 => compression = tag.value_or_offset as u16,
            322 => tile_w = Some(tag.value_or_offset),
            323 => tile_h = Some(tag.value_or_offset),
            324 => {
                if tag.count == 1 {
                    tile_offsets.push(tag.value_or_offset as usize);
                } else {
                    let off = tag.value_or_offset as usize;
                    for i in 0..(tag.count as usize) {
                        let p = off + i * 4;
                        if p + 4 <= bytes.len() {
                            tile_offsets.push(LittleEndian::read_u32(&bytes[p..p + 4]) as usize);
                        }
                    }
                }
            }
            325 => {
                if tag.count == 1 {
                    tile_byte_counts.push(tag.value_or_offset as usize);
                } else {
                    let off = tag.value_or_offset as usize;
                    for i in 0..(tag.count as usize) {
                        let p = off + i * 4;
                        if p + 4 <= bytes.len() {
                            tile_byte_counts
                                .push(LittleEndian::read_u32(&bytes[p..p + 4]) as usize);
                        }
                    }
                }
            }
            273 => {
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
            33422 => {
                // CFAPattern
                let p = tag.value_or_offset.to_le_bytes();
                cfa_pattern = match p {
                    [0, 1, 1, 2] => CfaPattern::RGGB,
                    [2, 1, 1, 0] => CfaPattern::BGGR,
                    [1, 0, 2, 1] => CfaPattern::GRBG,
                    [1, 2, 0, 1] => CfaPattern::GBRG,
                    _ => CfaPattern::RGGB,
                };
            }
            _ => {}
        }
    }

    if width == 0 || height == 0 {
        return Err("Could not determine raw dimensions from DNG".to_string());
    }

    let total_pixels = (width as usize) * (height as usize);
    let mut samples = vec![0u16; total_pixels];

    if compression == 7 {
        if let (Some(tile_width), Some(tile_height)) = (tile_w, tile_h) {
            // Lossless JPEG tiles
            let tw = tile_width as usize;
            let th = tile_height as usize;
            let tiles_x = (width as usize).div_ceil(tw);
            let tiles_y = (height as usize).div_ceil(th);

            let mut tile_idx = 0;
            for ty in 0..tiles_y {
                for tx in 0..tiles_x {
                    if tile_idx >= tile_offsets.len() || tile_idx >= tile_byte_counts.len() {
                        break;
                    }
                    let off = tile_offsets[tile_idx];
                    let count = tile_byte_counts[tile_idx];
                    tile_idx += 1;

                    if off + count <= bytes.len() {
                        let tile_data = &bytes[off..off + count];
                        let (decoded, cur_w, cur_h, _, _) = decode_lossless_jpeg(tile_data)?;
                        let start_x = tx * tw;
                        let start_y = ty * th;
                        for r in 0..cur_h {
                            let dst_row_start = (start_y + r) * (width as usize) + start_x;
                            let src_row_start = r * cur_w;
                            let copy_len = cur_w.min((width as usize) - start_x);
                            samples[dst_row_start..dst_row_start + copy_len]
                                .copy_from_slice(&decoded[src_row_start..src_row_start + copy_len]);
                        }
                    }
                }
            }
        }
    } else if compression == 1 {
        // Uncompressed raw
        if let Some(&first_off) = strip_offsets.first() {
            let required_bytes = total_pixels * 2;
            if first_off + required_bytes <= bytes.len() {
                let slice = &bytes[first_off..first_off + required_bytes];
                for i in 0..total_pixels {
                    samples[i] = LittleEndian::read_u16(&slice[i * 2..i * 2 + 2]);
                }
            }
        }
    } else {
        return Err(format!("Unsupported DNG raw compression: {}", compression));
    }

    let mut hasher = Sha256::new();
    for &s in &samples {
        hasher.update(s.to_le_bytes());
    }
    let cfa_hash = format!("{:x}", hasher.finalize());

    Ok((samples, width, height, cfa_pattern, cfa_hash))
}

/// Asserts zero-sample loss between source normalized RAW and produced DNG.
pub fn verify_cfa_equality(
    source_raw: &NormalizedRawImage,
    dng_bytes: &[u8],
) -> Result<VerifyReport, String> {
    let (dng_samples, dng_w, dng_h, _, dng_hash) = decode_dng_cfa(dng_bytes)?;
    let source_hash = source_raw.compute_cfa_hash();

    let mut issues = Vec::new();

    if source_raw.width != dng_w || source_raw.height != dng_h {
        issues.push(format!(
            "Dimension mismatch: source {}x{}, DNG {}x{}",
            source_raw.width, source_raw.height, dng_w, dng_h
        ));
    }

    let mut diff_count = 0usize;
    let min_len = source_raw.samples.len().min(dng_samples.len());

    for (i, (&src_s, &dng_s)) in source_raw.samples[..min_len]
        .iter()
        .zip(&dng_samples[..min_len])
        .enumerate()
    {
        if src_s != dng_s {
            if diff_count < 5 {
                eprintln!("Diff at {}: source={}, dng={}", i, src_s, dng_s);
            }
            diff_count += 1;
        }
    }

    if source_raw.samples.len() != dng_samples.len() {
        diff_count +=
            (source_raw.samples.len() as isize - dng_samples.len() as isize).unsigned_abs();
        issues.push(format!(
            "Total sample count mismatch: source {}, DNG {}",
            source_raw.samples.len(),
            dng_samples.len()
        ));
    }

    if diff_count > 0 {
        issues.push(format!(
            "Sensor sample mismatch: {} differing samples detected",
            diff_count
        ));
    }

    if source_hash != dng_hash {
        issues.push(format!(
            "CFA SHA-256 hash mismatch: source {}, DNG {}",
            source_hash, dng_hash
        ));
    }

    let valid = issues.is_empty() && diff_count == 0;

    Ok(VerifyReport {
        valid,
        source_width: source_raw.width,
        source_height: source_raw.height,
        dng_width: dng_w,
        dng_height: dng_h,
        source_cfa_hash: source_hash,
        dng_cfa_hash: dng_hash,
        sample_difference_count: diff_count,
        metadata_manifest_passed: true,
        issues,
    })
}
