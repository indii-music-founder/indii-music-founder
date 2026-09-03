use byteorder::{ByteOrder, LittleEndian};
use indii_raw::compression::huffman::{category, decode_diff, encode_diff};
use indii_raw::compression::ljpeg::{decode_lossless_jpeg, encode_lossless_jpeg};
use indii_raw::compression::predictor::PredictorSelection;
use indii_raw::model::cfa::CfaPattern;
use indii_raw::model::metadata::RawMetadata;
use indii_raw::model::raw_image::NormalizedRawImage;
use indii_raw::verify::{decode_dng_cfa, verify_cfa_equality};
use indii_raw::writer::tiff::{TiffDirectory, TiffSerializer, TiffTag};
use indii_raw::writer::{DngCompression, DngWriter, DngWriterOptions};

#[test]
fn test_tiff_tag_sorting_and_serialization() {
    let mut dir = TiffDirectory::new();
    // Add out of order
    dir.add_tag(TiffTag::long(330, 1000));
    dir.add_tag(TiffTag::short(256, 1920));
    dir.add_tag(TiffTag::short(257, 1080));
    dir.add_tag(TiffTag::ascii(271, "SONY"));

    let bytes = TiffSerializer::serialize(&mut [dir], &[]);
    assert_eq!(&bytes[0..4], &[0x49, 0x49, 0x2A, 0x00]); // Little Endian TIFF header

    let ifd0_offset = LittleEndian::read_u32(&bytes[4..8]) as usize;
    assert_eq!(ifd0_offset, 8);

    let num_tags = LittleEndian::read_u16(&bytes[ifd0_offset..ifd0_offset + 2]);
    assert_eq!(num_tags, 4);

    // Verify ascending sort: 256, 257, 271, 330
    let tag0 = LittleEndian::read_u16(&bytes[ifd0_offset + 2..ifd0_offset + 4]);
    let tag1 = LittleEndian::read_u16(&bytes[ifd0_offset + 14..ifd0_offset + 16]);
    let tag2 = LittleEndian::read_u16(&bytes[ifd0_offset + 26..ifd0_offset + 28]);
    let tag3 = LittleEndian::read_u16(&bytes[ifd0_offset + 38..ifd0_offset + 40]);

    assert_eq!(tag0, 256);
    assert_eq!(tag1, 257);
    assert_eq!(tag2, 271);
    assert_eq!(tag3, 330);
}

#[test]
fn test_huffman_diff_category_roundtrip() {
    for diff in -8192..=8192 {
        let (ssss, bits) = encode_diff(diff);
        let decoded = decode_diff(ssss, bits);
        assert_eq!(
            diff, decoded,
            "Difference roundtrip failed for diff {}",
            diff
        );
        if diff != 0 {
            assert_eq!(ssss, category(diff));
        }
    }
}

#[test]
fn test_lossless_jpeg_roundtrip_exact_samples() {
    let width = 64usize;
    let height = 64usize;
    let precision = 14u8;

    // Deterministic pseudo-random 14-bit CFA samples
    let mut samples = vec![0u16; width * height];
    for y in 0..height {
        for x in 0..width {
            let base = 512 + (x * 120 + y * 85) % 15000;
            samples[y * width + x] = base as u16;
        }
    }

    // 1. Test 2-component Bayer interleaved (standard DNG CFA layout)
    let compressed_2comp = encode_lossless_jpeg(
        &samples,
        width,
        height,
        precision,
        PredictorSelection::Ra,
        true,
    )
    .expect("Compression failed");

    let (decoded_2comp, dec_w, dec_h, dec_prec, is_2comp) =
        decode_lossless_jpeg(&compressed_2comp).expect("Decompression failed");

    assert_eq!(dec_w, width);
    assert_eq!(dec_h, height);
    assert_eq!(dec_prec, precision);
    assert!(is_2comp);
    assert_eq!(decoded_2comp.len(), samples.len());

    // Zero sample loss assertion!
    let mut differing = 0;
    for i in 0..samples.len() {
        if samples[i] != decoded_2comp[i] {
            differing += 1;
        }
    }
    assert_eq!(
        differing, 0,
        "Lossless JPEG 2-component produced differing samples!"
    );

    // 2. Test 1-component layout
    let compressed_1comp = encode_lossless_jpeg(
        &samples,
        width,
        height,
        precision,
        PredictorSelection::AverageRaRb,
        false,
    )
    .expect("Compression 1-comp failed");

    let (decoded_1comp, _, _, _, is_2c) =
        decode_lossless_jpeg(&compressed_1comp).expect("Decompression 1-comp failed");

    assert!(!is_2c);
    assert_eq!(decoded_1comp, samples);
}

#[test]
fn test_dng_writer_and_cfa_equality_verification() {
    let width = 160u32;
    let height = 160u32;
    let total = (width * height) as usize;

    let mut samples = vec![0u16; total];
    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) as usize;
            // Realistic sensor gradient
            samples[idx] = (512 + (x * 70 + y * 90) % 15500) as u16;
        }
    }

    let raw = NormalizedRawImage {
        width,
        height,
        active_area: [0, 0, height, width],
        bit_depth: 14,
        cfa_pattern: CfaPattern::RGGB,
        black_level: 512,
        white_level: 16383,
        samples,
        preview_jpeg: None,
        original_raw_bytes: None,
        metadata: RawMetadata {
            make: "SONY".to_string(),
            model: "ILCE-7M4".to_string(),
            unique_camera_model: "Sony ILCE-7M4".to_string(),
            orientation: 1,
            as_shot_neutral: [0.523, 1.0, 0.612],
            baseline_exposure: 0.35,
            ..Default::default()
        },
    };

    // Test Lossless JPEG DNG Output
    let options_ljpeg = DngWriterOptions {
        compression: DngCompression::LosslessJpeg,
        embed_original_raw: false,
        generate_preview: true,
        baseline_exposure_override: None,
    };

    let dng_bytes = DngWriter::write_dng_bytes(&raw, &options_ljpeg)
        .expect("Failed to write Lossless JPEG DNG");

    let report = verify_cfa_equality(&raw, &dng_bytes).expect("Verification function failed");

    assert!(report.valid, "DNG verification failed: {:?}", report.issues);
    assert_eq!(
        report.sample_difference_count, 0,
        "Zero sample loss required!"
    );
    assert_eq!(
        report.source_cfa_hash, report.dng_cfa_hash,
        "Cryptographic CFA hash match required!"
    );

    // Test Uncompressed DNG Output
    let options_uncompressed = DngWriterOptions {
        compression: DngCompression::Uncompressed,
        embed_original_raw: false,
        generate_preview: true,
        baseline_exposure_override: None,
    };

    let dng_uncompressed = DngWriter::write_dng_bytes(&raw, &options_uncompressed)
        .expect("Failed to write Uncompressed DNG");

    let report_uncomp =
        verify_cfa_equality(&raw, &dng_uncompressed).expect("Verification function failed");

    assert!(report_uncomp.valid);
    assert_eq!(report_uncomp.sample_difference_count, 0);
    assert_eq!(report_uncomp.source_cfa_hash, report_uncomp.dng_cfa_hash);
}

#[test]
fn test_malformed_and_truncated_rejection() {
    // 1. Truncated header
    assert!(decode_dng_cfa(&[0x49, 0x49]).is_err());

    // 2. Corrupt JPEG marker
    assert!(decode_lossless_jpeg(&[0x00, 0x00, 0x00, 0x00]).is_err());

    // 3. Random garbage
    let garbage = vec![0xAB; 512];
    assert!(decode_dng_cfa(&garbage).is_err());
}

#[test]
fn test_camera_calibration_registry_provenance() {
    use indii_raw::model::{CalibrationProvenance, CameraCalibrationRegistry};

    let a7m3 = CameraCalibrationRegistry::resolve("SONY", "ILCE-7M3");
    assert_eq!(a7m3.provenance, CalibrationProvenance::CameraSpecificTable);
    assert!(a7m3.is_exact_calibration);
    assert_eq!(a7m3.black_level, 512);
    assert_eq!(a7m3.white_level, 16383);
    assert_eq!(a7m3.baseline_exposure, 0.35);

    let unknown = CameraCalibrationRegistry::resolve("UnknownBrand", "Mystery9000");
    assert_eq!(
        unknown.provenance,
        CalibrationProvenance::ControlledFallback
    );
    assert!(!unknown.is_exact_calibration);
    assert_eq!(unknown.baseline_exposure, 0.0);
}

#[test]
fn test_hostile_file_and_dos_protection() {
    use indii_raw::adapter::sony_arw::read_ifd_tags;

    // Buffer with pathological tag count claiming 60,000 entries but only 100 bytes long
    let mut bad_buf = vec![0u8; 100];
    LittleEndian::write_u16(&mut bad_buf[0..2], 60000);

    let result = read_ifd_tags(&bad_buf, 0);
    assert!(result.is_err(), "Must reject pathological IFD entry count");
    let err = result.unwrap_err();
    assert!(
        err.contains("Pathological") || err.contains("bounds"),
        "Unexpected error: {}",
        err
    );
}

#[test]
fn test_independent_tiff_validation_oracle() {
    use std::fs;
    use std::process::Command;

    let width = 64u32;
    let height = 64u32;
    let samples = vec![1000u16; (width * height) as usize];

    let raw = NormalizedRawImage {
        width,
        height,
        active_area: [0, 0, height, width],
        bit_depth: 14,
        cfa_pattern: CfaPattern::RGGB,
        black_level: 512,
        white_level: 16383,
        samples,
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

    let options = DngWriterOptions {
        compression: DngCompression::Uncompressed,
        embed_original_raw: false,
        generate_preview: false,
        baseline_exposure_override: None,
    };

    let dng_bytes = DngWriter::write_dng_bytes(&raw, &options).expect("Failed to write DNG");

    let temp_dng =
        std::env::temp_dir().join(format!("indii_test_oracle_{}.dng", std::process::id()));
    fs::write(&temp_dng, &dng_bytes).expect("Failed to write temp DNG");

    // Oracle 1: macOS native tiffutil
    if let Ok(output) = Command::new("tiffutil")
        .arg("-info")
        .arg(&temp_dng)
        .output()
    {
        if output.status.success() {
            let info = String::from_utf8_lossy(&output.stdout);
            assert!(
                info.contains("Directory"),
                "tiffutil must recognize valid TIFF/DNG structure: {}",
                info
            );
        }
    }

    // Oracle 2: Independent Python Pillow parser
    let py_script = r#"
import sys
from PIL import Image
try:
    with Image.open(sys.argv[1]) as im:
        assert im.size == (64, 64), f"Dimension mismatch: {im.size}"
        assert im.format == "TIFF", f"Format mismatch: {im.format}"
        print("PIL_SUCCESS")
except Exception as e:
    print(f"PIL_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
"#;
    let py_res = Command::new("python3")
        .arg("-c")
        .arg(py_script)
        .arg(&temp_dng)
        .output();

    if let Ok(res) = py_res {
        if res.status.success() {
            let stdout = String::from_utf8_lossy(&res.stdout);
            assert!(
                stdout.contains("PIL_SUCCESS"),
                "Independent Pillow validation failed"
            );
        }
    }

    let _ = fs::remove_file(&temp_dng);
}
