use crate::adapter::get_adapter_for;
use crate::compression::ljpeg::{decode_lossless_jpeg, encode_lossless_jpeg};
use crate::compression::predictor::PredictorSelection;
use crate::model::cfa::CfaPattern;
use crate::model::metadata::RawMetadata;
use crate::model::raw_image::NormalizedRawImage;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkStats {
    pub path_name: String,
    pub dimensions: String,
    pub megapixels: f64,
    pub runs: usize,
    pub min_duration_ms: f64,
    pub max_duration_ms: f64,
    pub median_duration_ms: f64,
    pub p95_duration_ms: f64,
    pub median_throughput_mp_per_sec: f64,
    pub min_throughput_mp_per_sec: f64,
    pub max_throughput_mp_per_sec: f64,
    pub output_bytes: usize,
    pub compression_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyntheticBenchmarkReport {
    pub hardware: String,
    pub os: String,
    pub profile: String,
    pub warmup_runs: usize,
    pub total_runs_per_path: usize,
    pub results: Vec<BenchmarkStats>,
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

fn compute_stats(
    mut times_ms: Vec<f64>,
    mp: f64,
    output_bytes: usize,
    raw_bytes: usize,
    path_name: &str,
    width: u32,
    height: u32,
) -> BenchmarkStats {
    times_ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let count = times_ms.len();
    let min_ms = times_ms.first().copied().unwrap_or(0.0);
    let max_ms = times_ms.last().copied().unwrap_or(0.0);
    let median_ms = times_ms[count / 2];
    let p95_idx = ((count as f64 * 0.95).ceil() as usize).min(count - 1);
    let p95_ms = times_ms[p95_idx];

    let to_throughput = |ms: f64| if ms > 0.0 { mp / (ms / 1000.0) } else { 0.0 };

    BenchmarkStats {
        path_name: path_name.to_string(),
        dimensions: format!("{}x{}", width, height),
        megapixels: mp,
        runs: count,
        min_duration_ms: min_ms,
        max_duration_ms: max_ms,
        median_duration_ms: median_ms,
        p95_duration_ms: p95_ms,
        median_throughput_mp_per_sec: to_throughput(median_ms),
        min_throughput_mp_per_sec: to_throughput(max_ms), // slowest time = min throughput
        max_throughput_mp_per_sec: to_throughput(min_ms), // fastest time = max throughput
        output_bytes,
        compression_ratio: if raw_bytes > 0 {
            output_bytes as f64 / raw_bytes as f64
        } else {
            1.0
        },
    }
}

pub fn run_synthetic_benchmark(runs: usize) -> Result<SyntheticBenchmarkReport, String> {
    let width = 6000u32;
    let height = 4000u32;
    let total_pixels = (width * height) as usize;
    let mp = total_pixels as f64 / 1_000_000.0;
    let raw_bytes = total_pixels * 2; // 14-bit packed in 16-bit words: 48 MB

    // Generate realistic 14-bit Bayer CFA pattern
    let mut samples = vec![0u16; total_pixels];
    for y in 0..height {
        for x in 0..width {
            let base = 512 + ((x * 47 + y * 73) % 15500);
            samples[(y * width + x) as usize] = base as u16;
        }
    }

    let raw_image = NormalizedRawImage {
        width,
        height,
        active_area: [0, 0, height, width],
        bit_depth: 14,
        cfa_pattern: CfaPattern::RGGB,
        black_level: 512,
        white_level: 16383,
        samples: samples.clone(),
        preview_jpeg: None,
        original_raw_bytes: None,
        metadata: RawMetadata {
            make: "SONY".to_string(),
            model: "ILCE-7M3".to_string(),
            unique_camera_model: "Sony ILCE-7M3".to_string(),
            orientation: 1,
            as_shot_neutral: [0.55, 1.0, 0.65],
            baseline_exposure: 0.35,
            ..Default::default()
        },
    };

    let mut results = Vec::new();

    // 1. Benchmark Lossless JPEG Encode (2-Component Bayer SOF3)
    // Warmup
    for _ in 0..2 {
        let _ = encode_lossless_jpeg(
            &samples,
            width as usize,
            height as usize,
            14,
            PredictorSelection::Ra,
            true,
        );
    }
    let mut ljpeg_encoded_bytes = Vec::new();
    let mut enc_times = Vec::with_capacity(runs);
    for _ in 0..runs {
        let t0 = Instant::now();
        let enc = encode_lossless_jpeg(
            &samples,
            width as usize,
            height as usize,
            14,
            PredictorSelection::Ra,
            true,
        )
        .map_err(|e| format!("LJPEG encode failed: {}", e))?;
        enc_times.push(t0.elapsed().as_secs_f64() * 1000.0);
        ljpeg_encoded_bytes = enc;
    }
    results.push(compute_stats(
        enc_times,
        mp,
        ljpeg_encoded_bytes.len(),
        raw_bytes,
        "Lossless JPEG (SOF3 2-Comp Bayer) Encode",
        width,
        height,
    ));

    // 2. Benchmark Lossless JPEG Decode
    for _ in 0..2 {
        let _ = decode_lossless_jpeg(&ljpeg_encoded_bytes);
    }
    let mut dec_times = Vec::with_capacity(runs);
    for _ in 0..runs {
        let t0 = Instant::now();
        let _ = decode_lossless_jpeg(&ljpeg_encoded_bytes)
            .map_err(|e| format!("LJPEG decode failed: {}", e))?;
        dec_times.push(t0.elapsed().as_secs_f64() * 1000.0);
    }
    results.push(compute_stats(
        dec_times,
        mp,
        raw_bytes,
        ljpeg_encoded_bytes.len(),
        "Lossless JPEG (SOF3 2-Comp Bayer) Decode",
        width,
        height,
    ));

    // 3. Benchmark Uncompressed DNG Write
    let uncomp_opts = DngWriterOptions {
        compression: DngCompression::Uncompressed,
        embed_original_raw: false,
        generate_preview: false,
        baseline_exposure_override: None,
    };
    for _ in 0..2 {
        let _ = DngWriter::write_dng_bytes(&raw_image, &uncomp_opts);
    }
    let mut uncomp_times = Vec::with_capacity(runs);
    let mut uncomp_bytes_len = 0;
    for _ in 0..runs {
        let t0 = Instant::now();
        let dng = DngWriter::write_dng_bytes(&raw_image, &uncomp_opts)
            .map_err(|e| format!("Uncompressed DNG write failed: {}", e))?;
        uncomp_times.push(t0.elapsed().as_secs_f64() * 1000.0);
        uncomp_bytes_len = dng.len();
    }
    results.push(compute_stats(
        uncomp_times,
        mp,
        uncomp_bytes_len,
        raw_bytes,
        "Uncompressed DNG Generation (TIFF Container + RAW)",
        width,
        height,
    ));

    // 4. Benchmark Full Pipeline End-to-End (Lossless JPEG DNG Output)
    let full_opts = DngWriterOptions {
        compression: DngCompression::LosslessJpeg,
        embed_original_raw: false,
        generate_preview: false,
        baseline_exposure_override: None,
    };
    for _ in 0..2 {
        let _ = DngWriter::write_dng_bytes(&raw_image, &full_opts);
    }
    let mut full_times = Vec::with_capacity(runs);
    let mut full_bytes_len = 0;
    for _ in 0..runs {
        let t0 = Instant::now();
        let dng = DngWriter::write_dng_bytes(&raw_image, &full_opts)
            .map_err(|e| format!("Full LJPEG DNG write failed: {}", e))?;
        full_times.push(t0.elapsed().as_secs_f64() * 1000.0);
        full_bytes_len = dng.len();
    }
    results.push(compute_stats(
        full_times,
        mp,
        full_bytes_len,
        raw_bytes,
        "Full Pipeline: 24MP RAW to Lossless JPEG DNG",
        width,
        height,
    ));

    Ok(SyntheticBenchmarkReport {
        hardware: format!("Apple Silicon ({})", std::env::consts::ARCH),
        os: std::env::consts::OS.to_string(),
        profile: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
        warmup_runs: 2,
        total_runs_per_path: runs,
        results,
    })
}
