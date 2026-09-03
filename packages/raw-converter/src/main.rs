use clap::{Parser, Subcommand};
use indii_raw::benchmark::run_benchmark;
use indii_raw::verify::{decode_dng_cfa, verify_cfa_equality};
use indii_raw::{
    convert_raw, inspect_raw, DngCompression, DngWriterOptions,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

#[derive(Parser)]
#[command(name = "indii-raw")]
#[command(author = "indii.music engineering")]
#[command(version = "0.1.0")]
#[command(about = "indii RAW Converter: Memory-safe local camera RAW to DNG converter", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Output results in machine-readable JSON format
    #[arg(long, global = true)]
    json: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Inspects a RAW file and displays camera and sensor metadata
    Inspect {
        /// Path to camera RAW file
        input: PathBuf,
    },
    /// Converts a RAW file or directory of RAW files into DNG
    Convert {
        /// Path to input RAW file or directory
        input: PathBuf,

        /// Destination output DNG file or folder
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Recursively convert subdirectories when input is a folder
        #[arg(short, long)]
        recursive: bool,

        /// Store sensor data uncompressed instead of Lossless JPEG
        #[arg(long)]
        uncompressed: bool,

        /// Embed original source RAW file inside the DNG
        #[arg(long)]
        embed_raw: bool,

        /// Skip generating embedded preview
        #[arg(long)]
        no_preview: bool,

        /// Override camera BaselineExposure value (e.g. 0.35)
        #[arg(long)]
        baseline_exposure: Option<f64>,

        /// Maximum concurrent conversion threads for batch jobs
        #[arg(long, default_value_t = 4)]
        concurrency: usize,
    },
    /// Verifies standards compliance and sensor sample integrity of a DNG file
    Verify {
        /// Path to DNG file
        input: PathBuf,

        /// Optional path to original source RAW file for exact bit-level equality assertion
        #[arg(short, long)]
        source: Option<PathBuf>,
    },
    /// Benchmarks conversion throughput and compression ratio over a fixture directory
    Benchmark {
        /// Path to fixture directory containing RAW files
        directory: PathBuf,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Inspect { input } => {
            match inspect_raw(&input) {
                Ok(report) => {
                    if cli.json {
                        println!("{}", serde_json::to_string_pretty(&report).unwrap());
                    } else {
                        println!("--- indii RAW Inspection Report ---");
                        println!("File:             {}", report.file_path);
                        println!("Camera:           {} {}", report.make, report.model);
                        println!("Dimensions:       {} x {}", report.width, report.height);
                        println!("Bit Depth:        {}-bit", report.bit_depth);
                        println!("CFA Pattern:      {}", report.cfa_pattern);
                        println!("Black / White:    {} / {}", report.black_level, report.white_level);
                        println!("Baseline Lift:    +{:.2} EV", report.baseline_exposure);
                        println!("White Balance:    [{:.3}, {:.3}, {:.3}]", report.as_shot_neutral[0], report.as_shot_neutral[1], report.as_shot_neutral[2]);
                        if let Some(iso) = report.iso {
                            println!("ISO:              {}", iso);
                        }
                        if let Some(ref lens) = report.lens_model {
                            println!("Lens:             {}", lens);
                        }
                        println!("Supported:        Yes ({})", report.supported_reason.unwrap_or_default());
                    }
                }
                Err(e) => {
                    eprintln!("Error inspecting {}: {}", input.display(), e);
                    std::process::exit(1);
                }
            }
        }
        Commands::Convert {
            input,
            output,
            recursive,
            uncompressed,
            embed_raw,
            no_preview,
            baseline_exposure,
            concurrency: _,
        } => {
            let options = DngWriterOptions {
                compression: if uncompressed {
                    DngCompression::Uncompressed
                } else {
                    DngCompression::LosslessJpeg
                },
                embed_original_raw: embed_raw,
                generate_preview: !no_preview,
                baseline_exposure_override: baseline_exposure,
            };

            if input.is_file() {
                let out_path = output.unwrap_or_else(|| input.with_extension("dng"));
                match convert_raw(&input, &out_path, &options) {
                    Ok(report) => {
                        if cli.json {
                            println!("{}", serde_json::to_string_pretty(&report).unwrap());
                        } else {
                            println!("Converted: {} -> {}", report.input_path, report.output_path);
                            println!(
                                "Size: {:.2} MB -> {:.2} MB ({:.1}% of original, saved {:.1}%) in {} ms",
                                report.input_size_bytes as f64 / 1_048_576.0,
                                report.output_size_bytes as f64 / 1_048_576.0,
                                report.compression_ratio * 100.0,
                                (1.0 - report.compression_ratio) * 100.0,
                                report.duration_ms
                            );
                            println!("CFA Digest: {}", report.cfa_sample_hash);
                        }
                    }
                    Err(e) => {
                        eprintln!("Conversion failed for {}: {}", input.display(), e);
                        std::process::exit(1);
                    }
                }
            } else if input.is_dir() {
                let out_dir = output.unwrap_or_else(|| input.clone());
                let mut files = Vec::new();
                collect_raw_files(&input, recursive, &mut files);

                if files.is_empty() {
                    println!("No supported camera RAW files found in {}", input.display());
                    return;
                }

                let mut reports = Vec::new();
                let succeeded = Arc::new(AtomicUsize::new(0));
                let failed = Arc::new(AtomicUsize::new(0));

                for file in files {
                    let rel_path = file.strip_prefix(&input).unwrap_or(&file);
                    let target_dng = out_dir.join(rel_path).with_extension("dng");

                    match convert_raw(&file, &target_dng, &options) {
                        Ok(rep) => {
                            succeeded.fetch_add(1, Ordering::SeqCst);
                            if !cli.json {
                                println!("OK: {} -> {}", file.display(), target_dng.display());
                            }
                            reports.push(rep);
                        }
                        Err(e) => {
                            failed.fetch_add(1, Ordering::SeqCst);
                            eprintln!("FAIL: {}: {}", file.display(), e);
                        }
                    }
                }

                if cli.json {
                    println!("{}", serde_json::to_string_pretty(&reports).unwrap());
                } else {
                    println!(
                        "\nBatch Complete: {} succeeded, {} failed",
                        succeeded.load(Ordering::SeqCst),
                        failed.load(Ordering::SeqCst)
                    );
                }
            } else {
                eprintln!("Input does not exist: {}", input.display());
                std::process::exit(1);
            }
        }
        Commands::Verify { input, source } => {
            let bytes = match fs::read(&input) {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("Failed to read {}: {}", input.display(), e);
                    std::process::exit(1);
                }
            };

            if let Some(src_path) = source {
                let src_bytes = match fs::read(&src_path) {
                    Ok(b) => b,
                    Err(e) => {
                        eprintln!("Failed to read source {}: {}", src_path.display(), e);
                        std::process::exit(1);
                    }
                };

                let adapter = match indii_raw::adapter::get_adapter_for(&src_bytes) {
                    Some(a) => a,
                    None => {
                        eprintln!("Unsupported source RAW adapter");
                        std::process::exit(1);
                    }
                };

                let raw = match adapter.parse(&src_bytes) {
                    Ok(r) => r,
                    Err(e) => {
                        eprintln!("Failed to parse source RAW: {}", e);
                        std::process::exit(1);
                    }
                };

                match verify_cfa_equality(&raw, &bytes) {
                    Ok(report) => {
                        if cli.json {
                            println!("{}", serde_json::to_string_pretty(&report).unwrap());
                        } else {
                            println!("--- Verification Report ---");
                            println!("File:              {}", input.display());
                            println!("Valid:             {}", if report.valid { "PASS" } else { "FAIL" });
                            println!("Dimensions:        {}x{} -> {}x{}", report.source_width, report.source_height, report.dng_width, report.dng_height);
                            println!("Source CFA Hash:   {}", report.source_cfa_hash);
                            println!("DNG CFA Hash:      {}", report.dng_cfa_hash);
                            println!("Sample Diff Count: {}", report.sample_difference_count);
                            if !report.issues.is_empty() {
                                println!("Issues:");
                                for issue in report.issues {
                                    println!("  - {}", issue);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Verification error: {}", e);
                        std::process::exit(1);
                    }
                }
            } else {
                // Standalone DNG validation
                match decode_dng_cfa(&bytes) {
                    Ok((_, w, h, pattern, hash)) => {
                        if cli.json {
                            let obj = serde_json::json!({
                                "valid": true,
                                "file": input.to_string_lossy(),
                                "width": w,
                                "height": h,
                                "cfa_pattern": pattern.as_str(),
                                "cfa_hash": hash
                            });
                            println!("{}", serde_json::to_string_pretty(&obj).unwrap());
                        } else {
                            println!("--- DNG Standalone Verification ---");
                            println!("File:        {}", input.display());
                            println!("Valid:       PASS (Valid TIFF/DNG structure & readable CFA)");
                            println!("Dimensions:  {} x {}", w, h);
                            println!("CFA Pattern: {}", pattern.as_str());
                            println!("CFA Digest:  {}", hash);
                        }
                    }
                    Err(e) => {
                        eprintln!("DNG Validation Failed for {}: {}", input.display(), e);
                        std::process::exit(1);
                    }
                }
            }
        }
        Commands::Benchmark { directory } => {
            match run_benchmark(&directory) {
                Ok(report) => {
                    if cli.json {
                        println!("{}", serde_json::to_string_pretty(&report).unwrap());
                    } else {
                        println!("--- indii RAW Conversion Benchmark ---");
                        println!("Directory:       {}", directory.display());
                        println!("Files Processed: {}", report.total_files);
                        println!(
                            "Input Size:      {:.2} MB",
                            report.total_input_bytes as f64 / 1_048_576.0
                        );
                        println!(
                            "Output Size:     {:.2} MB",
                            report.total_output_bytes as f64 / 1_048_576.0
                        );
                        println!(
                            "Avg Ratio:       {:.2}% of original (saved {:.2}%)",
                            report.average_compression_ratio * 100.0,
                            (1.0 - report.average_compression_ratio) * 100.0
                        );
                        println!("Total Duration:  {} ms", report.total_duration_ms);
                        println!("Throughput:      {:.2} MP/sec", report.overall_throughput_mp_per_sec);
                    }
                }
                Err(e) => {
                    eprintln!("Benchmark failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
    }
}

fn collect_raw_files(dir: &Path, recursive: bool, files: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && recursive {
                collect_raw_files(&path, true, files);
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                    if ext.eq_ignore_ascii_case("arw") {
                        files.push(path);
                    }
                }
            }
        }
    }
}
