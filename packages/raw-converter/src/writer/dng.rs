use crate::compression::ljpeg::encode_lossless_jpeg;
use crate::compression::predictor::PredictorSelection;
use crate::model::raw_image::NormalizedRawImage;
use crate::writer::tiff::{TiffDirectory, TiffSerializer, TiffTag};
use byteorder::{ByteOrder, LittleEndian};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DngCompression {
    LosslessJpeg,
    Uncompressed,
}

pub struct DngWriterOptions {
    pub compression: DngCompression,
    pub embed_original_raw: bool,
    pub generate_preview: bool,
    pub baseline_exposure_override: Option<f64>,
}

impl Default for DngWriterOptions {
    fn default() -> Self {
        Self {
            compression: DngCompression::LosslessJpeg,
            embed_original_raw: false,
            generate_preview: true,
            baseline_exposure_override: None,
        }
    }
}

pub struct DngWriter;

impl DngWriter {
    /// Converts a NormalizedRawImage into standards-compliant DNG bytes.
    pub fn write_dng_bytes(
        raw: &NormalizedRawImage,
        options: &DngWriterOptions,
    ) -> Result<Vec<u8>, String> {
        raw.validate()?;

        // Prepare Raw SubIFD payload
        let (raw_payload, raw_compression_tag, tile_offsets, tile_byte_counts, tile_w, tile_h) =
            match options.compression {
                DngCompression::LosslessJpeg => {
                    // Use tile size of 160x160 as discovered in XDA benchmarks for optimal prediction
                    let tile_w = 160usize.min(raw.width as usize);
                    let tile_h = 160usize.min(raw.height as usize);
                    let tiles_x = (raw.width as usize).div_ceil(tile_w);
                    let tiles_y = (raw.height as usize).div_ceil(tile_h);

                    let mut combined_payload = Vec::new();
                    let mut offsets = Vec::new();
                    let mut byte_counts = Vec::new();

                    for ty in 0..tiles_y {
                        for tx in 0..tiles_x {
                            let start_x = tx * tile_w;
                            let start_y = ty * tile_h;
                            let cur_w = tile_w.min((raw.width as usize) - start_x);
                            let cur_h = tile_h.min((raw.height as usize) - start_y);

                            // Extract tile samples
                            let mut tile_samples = vec![0u16; cur_w * cur_h];
                            for r in 0..cur_h {
                                let src_row_start = (start_y + r) * (raw.width as usize) + start_x;
                                let dst_row_start = r * cur_w;
                                tile_samples[dst_row_start..dst_row_start + cur_w].copy_from_slice(
                                    &raw.samples[src_row_start..src_row_start + cur_w],
                                );
                            }

                            // Encode with Lossless JPEG (SOF3) using Predictor 1 and 2-component Bayer layout
                            let tile_bytes = encode_lossless_jpeg(
                                &tile_samples,
                                cur_w,
                                cur_h,
                                raw.bit_depth,
                                PredictorSelection::Ra,
                                true, // 2 components (even/odd columns) for Bayer CFA
                            )?;

                            offsets.push(combined_payload.len() as u32);
                            byte_counts.push(tile_bytes.len() as u32);
                            combined_payload.extend_from_slice(&tile_bytes);
                        }
                    }

                    (
                        combined_payload,
                        7u16, // Compression = 7 (JPEG)
                        Some(offsets),
                        Some(byte_counts),
                        Some(tile_w as u32),
                        Some(tile_h as u32),
                    )
                }
                DngCompression::Uncompressed => {
                    let mut raw_bytes = vec![0u8; raw.samples.len() * 2];
                    for (i, &sample) in raw.samples.iter().enumerate() {
                        LittleEndian::write_u16(&mut raw_bytes[i * 2..i * 2 + 2], sample);
                    }
                    let len = raw_bytes.len() as u32;
                    (raw_bytes, 1u16, Some(vec![0]), Some(vec![len]), None, None)
                }
            };

        // Prepare Preview Thumbnail (IFD 0 payload)
        let (preview_payload, preview_w, preview_h, preview_compression, preview_photometric) =
            if let Some(ref preview) = raw.preview_jpeg {
                (preview.clone(), 1616u32, 1080u32, 7u16, 6u16) // JPEG YCbCr
            } else {
                // Generate a minimal 256x256 RGB thumbnail if preview is missing
                let thumb_w = 256u32.min(raw.width);
                let thumb_h = 256u32.min(raw.height);
                let mut thumb_rgb = vec![128u8; (thumb_w * thumb_h * 3) as usize];
                // Downsample simple gray from CFA
                let step_x = (raw.width / thumb_w).max(1);
                let step_y = (raw.height / thumb_h).max(1);
                for ty in 0..thumb_h {
                    for tx in 0..thumb_w {
                        let sx = (tx * step_x).min(raw.width - 1);
                        let sy = (ty * step_y).min(raw.height - 1);
                        let sample = raw.samples[(sy * raw.width + sx) as usize];
                        let val8 = ((sample.saturating_sub(raw.black_level as u16) as u32 * 255)
                            / (raw.white_level - raw.black_level).max(1))
                        .min(255) as u8;
                        let idx = ((ty * thumb_w + tx) * 3) as usize;
                        thumb_rgb[idx] = val8;
                        thumb_rgb[idx + 1] = val8;
                        thumb_rgb[idx + 2] = val8;
                    }
                }
                (thumb_rgb, thumb_w, thumb_h, 1u16, 2u16) // Uncompressed RGB
            };

        // Construct IFD 0 (Root / Reduced resolution image)
        let mut ifd0 = TiffDirectory::new();
        ifd0.add_tag(TiffTag::long(254, 1)); // NewSubfileType = 1 (Reduced resolution preview)
        ifd0.add_tag(TiffTag::long(256, preview_w));
        ifd0.add_tag(TiffTag::long(257, preview_h));
        ifd0.add_tag(TiffTag::short(259, preview_compression));
        ifd0.add_tag(TiffTag::short(262, preview_photometric));
        if preview_compression == 1 {
            ifd0.add_tag(TiffTag::shorts(258, &[8, 8, 8])); // BitsPerSample
            ifd0.add_tag(TiffTag::short(277, 3)); // SamplesPerPixel = 3 for RGB
            ifd0.add_tag(TiffTag::short(284, 1)); // PlanarConfiguration = 1
            ifd0.add_tag(TiffTag::long(278, preview_h)); // RowsPerStrip
        }
        ifd0.add_tag(TiffTag::ascii(271, &raw.metadata.make));
        ifd0.add_tag(TiffTag::ascii(272, &raw.metadata.model));
        ifd0.add_tag(TiffTag::short(274, raw.metadata.orientation));

        // DNG Specification Tags in IFD 0
        ifd0.add_tag(TiffTag::bytes(50706, &[1, 4, 0, 0])); // DNGVersion [1, 4, 0, 0]
        ifd0.add_tag(TiffTag::bytes(50707, &[1, 3, 0, 0])); // DNGBackwardVersion [1, 3, 0, 0]
        ifd0.add_tag(TiffTag::ascii(50708, &raw.metadata.unique_camera_model));

        // Color Calibration Matrices
        let cm1_rationals: Vec<(i32, i32)> = raw
            .metadata
            .color_matrix1
            .iter()
            .map(|&v| ((v * 10000.0).round() as i32, 10000))
            .collect();
        ifd0.add_tag(TiffTag::srationals(50721, &cm1_rationals)); // ColorMatrix1

        let cm2_rationals: Vec<(i32, i32)> = raw
            .metadata
            .color_matrix2
            .iter()
            .map(|&v| ((v * 10000.0).round() as i32, 10000))
            .collect();
        ifd0.add_tag(TiffTag::srationals(50722, &cm2_rationals)); // ColorMatrix2

        ifd0.add_tag(TiffTag::short(50778, raw.metadata.calibration_illuminant1)); // CalibrationIlluminant1
        ifd0.add_tag(TiffTag::short(50779, raw.metadata.calibration_illuminant2)); // CalibrationIlluminant2

        // AsShotNeutral White Balance
        let neutral_rationals: Vec<(u32, u32)> = raw
            .metadata
            .as_shot_neutral
            .iter()
            .map(|&v| ((v * 1000000.0).round() as u32, 1000000))
            .collect();
        ifd0.add_tag(TiffTag::rationals(50728, &neutral_rationals)); // AsShotNeutral

        // BaselineExposure: Essential to prevent dark renders!
        let baseline_exp = options
            .baseline_exposure_override
            .unwrap_or(raw.metadata.baseline_exposure);
        let baseline_srational = [((baseline_exp * 100.0).round() as i32, 100)];
        ifd0.add_tag(TiffTag::srationals(50730, &baseline_srational)); // BaselineExposure

        // Construct SubIFD 0 (Full-resolution raw CFA image)
        let mut subifd0 = TiffDirectory::new();
        subifd0.add_tag(TiffTag::long(254, 0)); // NewSubfileType = 0 (Full-resolution raw)
        subifd0.add_tag(TiffTag::long(256, raw.width));
        subifd0.add_tag(TiffTag::long(257, raw.height));
        subifd0.add_tag(TiffTag::short(258, raw.bit_depth as u16));
        subifd0.add_tag(TiffTag::short(259, raw_compression_tag));
        subifd0.add_tag(TiffTag::short(262, 32803)); // PhotometricInterpretation = 32803 (CFA)
        subifd0.add_tag(TiffTag::short(277, 1)); // SamplesPerPixel = 1 for CFA
        subifd0.add_tag(TiffTag::short(284, 1)); // PlanarConfiguration = 1

        // CFA Pattern metadata
        subifd0.add_tag(TiffTag::shorts(33421, &[2, 2])); // CFARepeatPatternDim = [2, 2]
        subifd0.add_tag(TiffTag::bytes(
            33422,
            &raw.cfa_pattern.to_dng_pattern_bytes(),
        )); // CFAPattern
        subifd0.add_tag(TiffTag::bytes(50710, &[0, 1, 2])); // CFAPlaneColor = [0, 1, 2]
        subifd0.add_tag(TiffTag::short(50711, 1)); // CFALayout = 1 (Rectangular)

        // Levels & Sensor Geometry
        subifd0.add_tag(TiffTag::rational(50714, raw.black_level, 1)); // BlackLevel
        subifd0.add_tag(TiffTag::long(50717, raw.white_level)); // WhiteLevel
        subifd0.add_tag(TiffTag::longs(50720, &raw.active_area)); // ActiveArea

        // Default crop matching active area
        let default_crop_origin = [(raw.active_area[1], 1), (raw.active_area[0], 1)];
        let default_crop_size = [
            (raw.active_area[3] - raw.active_area[1], 1),
            (raw.active_area[2] - raw.active_area[0], 1),
        ];
        subifd0.add_tag(TiffTag::rationals(50719, &default_crop_origin)); // DefaultCropOrigin
        subifd0.add_tag(TiffTag::rationals(50720, &default_crop_size)); // DefaultCropSize

        // Tiling or Strip Tags
        if let (Some(tw), Some(th)) = (tile_w, tile_h) {
            subifd0.add_tag(TiffTag::long(322, tw)); // TileWidth
            subifd0.add_tag(TiffTag::long(323, th)); // TileLength
        } else {
            subifd0.add_tag(TiffTag::long(278, raw.height)); // RowsPerStrip
        }

        // Construct EXIF IFD
        let mut exif_ifd = TiffDirectory::new();
        if let Some(iso) = raw.metadata.iso {
            exif_ifd.add_tag(TiffTag::short(34855, iso as u16));
        }
        if let Some((num, den)) = raw.metadata.exposure_time {
            exif_ifd.add_tag(TiffTag::rational(33434, num, den));
        }
        if let Some((num, den)) = raw.metadata.f_number {
            exif_ifd.add_tag(TiffTag::rational(33437, num, den));
        }
        if let Some((num, den)) = raw.metadata.focal_length {
            exif_ifd.add_tag(TiffTag::rational(37386, num, den));
        }
        if let Some(ref date) = raw.metadata.date_time_original {
            exif_ifd.add_tag(TiffTag::ascii(36867, date));
        }
        if let Some(ref lens) = raw.metadata.lens_model {
            exif_ifd.add_tag(TiffTag::ascii(42036, lens));
        }

        // Embed Original Raw Payload if requested
        let mut extra_payloads = Vec::new();
        extra_payloads.push(preview_payload.as_slice());
        extra_payloads.push(raw_payload.as_slice());

        if options.embed_original_raw {
            if let Some(ref orig_bytes) = raw.original_raw_bytes {
                extra_payloads.push(orig_bytes.as_slice());
                // DNGPrivateData (tag 50740) points to original RAW stream
                ifd0.add_tag(TiffTag::bytes(50740, orig_bytes));
            }
        }

        // Assemble IFD vector
        let mut ifds = vec![ifd0, subifd0, exif_ifd];

        // Step 1: Add placeholder tags so all tag counts and data lengths are fixed
        ifds[0].add_tag(TiffTag::long(330, 0)); // SubIFD
        ifds[0].add_tag(TiffTag::long(34665, 0)); // ExifIFD
        ifds[0].add_tag(TiffTag::long(273, 0)); // StripOffsets (preview)
        ifds[0].add_tag(TiffTag::long(279, preview_payload.len() as u32)); // StripByteCounts

        if let (Some(offsets), Some(counts)) = (tile_offsets.as_ref(), tile_byte_counts.as_ref()) {
            let placeholder_offsets = vec![0u32; offsets.len()];
            if tile_w.is_some() {
                ifds[1].add_tag(TiffTag::longs(324, &placeholder_offsets)); // TileOffsets
                ifds[1].add_tag(TiffTag::longs(325, counts)); // TileByteCounts
            } else {
                ifds[1].add_tag(TiffTag::longs(273, &placeholder_offsets)); // StripOffsets
                ifds[1].add_tag(TiffTag::longs(279, counts)); // StripByteCounts
            }
        }

        // Step 2: Now that all tags are present in every IFD, calculate exact IFD offsets
        let ifd0_offset = 8usize;
        let ifd0_len = 2 + ifds[0].sort_tags_and_count() * 12 + 4;
        let subifd0_offset = ifd0_offset + ifd0_len;
        let subifd0_len = 2 + ifds[1].sort_tags_and_count() * 12 + 4;
        let exif_offset = subifd0_offset + subifd0_len;

        ifds[0].update_tag(TiffTag::long(330, subifd0_offset as u32));
        ifds[0].update_tag(TiffTag::long(34665, exif_offset as u32));

        // Step 3: Run preliminary serialization with fixed tag set to get exact payload offsets
        let preliminary_bytes = TiffSerializer::serialize(&mut ifds, &[]);
        let preview_offset = preliminary_bytes.len();
        let preview_bytes_len = preview_payload.len();
        let raw_payload_offset = preview_offset + preview_bytes_len + (preview_bytes_len % 2);

        // Step 4: Update tags with exact payload offsets
        ifds[0].update_tag(TiffTag::long(273, preview_offset as u32));

        if let (Some(offsets), _) = (tile_offsets.as_ref(), tile_byte_counts.as_ref()) {
            let adjusted_offsets: Vec<u32> = offsets
                .iter()
                .map(|&off| (raw_payload_offset as u32) + off)
                .collect();
            if tile_w.is_some() {
                ifds[1].update_tag(TiffTag::longs(324, &adjusted_offsets));
            } else {
                ifds[1].update_tag(TiffTag::longs(273, &adjusted_offsets));
            }
        }

        // Final deterministic serialization with all payloads
        let final_dng = TiffSerializer::serialize(&mut ifds, &extra_payloads);
        Ok(final_dng)
    }

    /// Atomically writes DNG bytes to the target file path via a temporary file.
    pub fn write_dng_atomic(
        raw: &NormalizedRawImage,
        target_path: &Path,
        options: &DngWriterOptions,
    ) -> Result<PathBuf, String> {
        let dng_bytes = Self::write_dng_bytes(raw, options)?;

        let parent_dir = target_path
            .parent()
            .ok_or_else(|| "Invalid target path: missing parent directory".to_string())?;
        fs::create_dir_all(parent_dir).map_err(|e| format!("Failed to create directory: {}", e))?;

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let pid = std::process::id();
        let temp_file_name = format!(
            ".{}.tmp.{}.{}",
            target_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("image.dng"),
            pid,
            timestamp
        );
        let temp_path = parent_dir.join(temp_file_name);

        // Write to temporary file with sync
        let mut file = File::create(&temp_path).map_err(|e| {
            format!(
                "Failed to create temporary file {}: {}",
                temp_path.display(),
                e
            )
        })?;
        file.write_all(&dng_bytes)
            .map_err(|e| format!("Failed to write DNG bytes: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("Failed to sync temporary file to disk: {}", e))?;
        drop(file);

        // Atomic rename
        fs::rename(&temp_path, target_path).map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            format!(
                "Atomic rename failed from {} to {}: {}",
                temp_path.display(),
                target_path.display(),
                e
            )
        })?;

        Ok(target_path.to_path_buf())
    }
}
