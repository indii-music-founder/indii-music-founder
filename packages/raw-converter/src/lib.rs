pub mod adapter;
pub mod benchmark;
pub mod compression;
pub mod model;
pub mod verify;
pub mod writer;

use adapter::get_adapter_for;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::Instant;
pub use writer::{DngCompression, DngWriter, DngWriterOptions};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectReport {
    pub file_path: String,
    pub is_supported: bool,
    pub format: String,
    pub make: String,
    pub model: String,
    pub width: u32,
    pub height: u32,
    pub active_area: [u32; 4],
    pub bit_depth: u8,
    pub cfa_pattern: String,
    pub black_level: u32,
    pub white_level: u32,
    pub has_embedded_preview: bool,
    pub baseline_exposure: f64,
    pub as_shot_neutral: [f64; 3],
    pub iso: Option<u32>,
    pub lens_model: Option<String>,
    pub date_time_original: Option<String>,
    pub supported_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertReport {
    pub success: bool,
    pub input_path: String,
    pub output_path: String,
    pub input_size_bytes: usize,
    pub output_size_bytes: usize,
    pub compression_ratio: f64,
    pub duration_ms: u64,
    pub cfa_sample_hash: String,
    pub error: Option<String>,
}

/// Inspects a camera RAW file and returns rich structured metadata without full decoding.
pub fn inspect_raw(path: &Path) -> Result<InspectReport, String> {
    let bytes = fs::read(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    let adapter = get_adapter_for(&bytes).ok_or_else(|| {
        "Unsupported RAW format or camera make. Currently supported: Sony Alpha series ARW."
            .to_string()
    })?;

    let raw = adapter.parse(&bytes)?;

    Ok(InspectReport {
        file_path: path.to_string_lossy().to_string(),
        is_supported: true,
        format: adapter.name().to_string(),
        make: raw.metadata.make.clone(),
        model: raw.metadata.model.clone(),
        width: raw.width,
        height: raw.height,
        active_area: raw.active_area,
        bit_depth: raw.bit_depth,
        cfa_pattern: raw.cfa_pattern.as_str().to_string(),
        black_level: raw.black_level,
        white_level: raw.white_level,
        has_embedded_preview: raw.preview_jpeg.is_some(),
        baseline_exposure: raw.metadata.baseline_exposure,
        as_shot_neutral: raw.metadata.as_shot_neutral,
        iso: raw.metadata.iso,
        lens_model: raw.metadata.lens_model.clone(),
        date_time_original: raw.metadata.date_time_original.clone(),
        supported_reason: Some("Supported Sony 14-bit Bayer CFA ARW".to_string()),
    })
}

/// Converts a single camera RAW file into a standards-compliant DNG file.
pub fn convert_raw(
    input_path: &Path,
    output_path: &Path,
    options: &DngWriterOptions,
) -> Result<ConvertReport, String> {
    let start = Instant::now();
    let bytes = fs::read(input_path)
        .map_err(|e| format!("Failed to read {}: {}", input_path.display(), e))?;

    let adapter = get_adapter_for(&bytes).ok_or_else(|| {
        format!(
            "Unsupported camera RAW format in {}. Only verified Sony ARW models are supported.",
            input_path.display()
        )
    })?;

    let raw = adapter.parse(&bytes)?;
    let cfa_hash = raw.compute_cfa_hash();

    let target_dng_path = DngWriter::write_dng_atomic(&raw, output_path, options)?;
    let output_bytes = fs::metadata(&target_dng_path)
        .map(|m| m.len() as usize)
        .unwrap_or(0);

    let duration = start.elapsed().as_millis() as u64;
    let ratio = if !bytes.is_empty() {
        output_bytes as f64 / bytes.len() as f64
    } else {
        0.0
    };

    Ok(ConvertReport {
        success: true,
        input_path: input_path.to_string_lossy().to_string(),
        output_path: target_dng_path.to_string_lossy().to_string(),
        input_size_bytes: bytes.len(),
        output_size_bytes: output_bytes,
        compression_ratio: ratio,
        duration_ms: duration,
        cfa_sample_hash: cfa_hash,
        error: None,
    })
}
