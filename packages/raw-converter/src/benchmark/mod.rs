use crate::adapter::get_adapter_for;
use crate::writer::{DngCompression, DngWriter, DngWriterOptions};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkItem {
    pub file_name: String,
    pub camera_model: String,
    pub input_size_bytes: usize,
    pub output_size_bytes: usize,
    pub compression_ratio: f64, // output / input
    pub duration_ms: u64,
    pub megapixels: f64,
    pub throughput_mp_per_sec: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkReport {
    pub total_files: usize,
    pub total_input_bytes: usize,
    pub total_output_bytes: usize,
    pub average_compression_ratio: f64,
    pub total_duration_ms: u64,
    pub overall_throughput_mp_per_sec: f64,
    pub items: Vec<BenchmarkItem>,
}

pub fn run_benchmark(fixtures_dir: &Path) -> Result<BenchmarkReport, String> {
    if !fixtures_dir.is_dir() {
        return Err(format!(
            "Fixtures path is not a directory: {}",
            fixtures_dir.display()
        ));
    }

    let entries = fs::read_dir(fixtures_dir)
        .map_err(|e| format!("Failed to read directory {}: {}", fixtures_dir.display(), e))?;

    let mut items = Vec::new();
    let mut total_input = 0usize;
    let mut total_output = 0usize;
    let mut total_mp = 0.0f64;
    let overall_start = Instant::now();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext == "arw" {
                let bytes = fs::read(&path)
                    .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
                if let Some(adapter) = get_adapter_for(&bytes) {
                    let start = Instant::now();
                    let raw = adapter.parse(&bytes)?;
                    let options = DngWriterOptions {
                        compression: DngCompression::LosslessJpeg,
                        embed_original_raw: false,
                        generate_preview: true,
                        baseline_exposure_override: None,
                    };
                    let dng_bytes = DngWriter::write_dng_bytes(&raw, &options)?;
                    let elapsed = start.elapsed().as_millis() as u64;

                    let mp = (raw.width as f64 * raw.height as f64) / 1_000_000.0;
                    let throughput = if elapsed > 0 {
                        mp / (elapsed as f64 / 1000.0)
                    } else {
                        mp * 1000.0
                    };

                    total_input += bytes.len();
                    total_output += dng_bytes.len();
                    total_mp += mp;

                    items.push(BenchmarkItem {
                        file_name: path.file_name().unwrap().to_string_lossy().to_string(),
                        camera_model: raw.metadata.model,
                        input_size_bytes: bytes.len(),
                        output_size_bytes: dng_bytes.len(),
                        compression_ratio: dng_bytes.len() as f64 / bytes.len() as f64,
                        duration_ms: elapsed,
                        megapixels: mp,
                        throughput_mp_per_sec: throughput,
                    });
                }
            }
        }
    }

    let total_elapsed = overall_start.elapsed().as_millis() as u64;
    let avg_ratio = if total_input > 0 {
        total_output as f64 / total_input as f64
    } else {
        0.0
    };
    let overall_throughput = if total_elapsed > 0 {
        total_mp / (total_elapsed as f64 / 1000.0)
    } else {
        0.0
    };

    Ok(BenchmarkReport {
        total_files: items.len(),
        total_input_bytes: total_input,
        total_output_bytes: total_output,
        average_compression_ratio: avg_ratio,
        total_duration_ms: total_elapsed,
        overall_throughput_mp_per_sec: overall_throughput,
        items,
    })
}
