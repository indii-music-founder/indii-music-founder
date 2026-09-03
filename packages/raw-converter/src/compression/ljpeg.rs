use crate::compression::huffman::{decode_diff, encode_diff, BitReader, BitWriter, HuffmanTable};
use crate::compression::predictor::PredictorSelection;
use byteorder::{BigEndian, ByteOrder};

/// Encodes a tile or image slice of 16-bit CFA samples into ITU-T T.81 Lossless JPEG (SOF3).
///
/// If `two_components` is true:
/// Bayer CFA columns are split into two interleaved components:
/// - Component 1: Even columns (0, 2, 4...)
/// - Component 2: Odd columns (1, 3, 5...)
///
/// This ensures horizontal predictor Ra always predicts from the identical Bayer color filter.
pub fn encode_lossless_jpeg(
    samples: &[u16],
    width: usize,
    height: usize,
    precision: u8,
    predictor: PredictorSelection,
    two_components: bool,
) -> Result<Vec<u8>, String> {
    if samples.len() != width * height {
        return Err(format!(
            "Sample slice size {} does not match dimensions {}x{}",
            samples.len(),
            width,
            height
        ));
    }

    let mut out = Vec::with_capacity(width * height);

    // 1. SOI Marker
    out.extend_from_slice(&[0xFF, 0xD8]);

    let huff_table = HuffmanTable::standard_lossless();

    // 2. DHT Marker (Define Huffman Table)
    // Marker (0xFFC4), Length (u16), Table Info (0x00 = DC table 0), BITS (16 bytes), HUFFVAL
    let dht_len = 2 + 1 + 16 + huff_table.huffval.len();
    out.extend_from_slice(&[0xFF, 0xC4]);
    out.extend_from_slice(&(dht_len as u16).to_be_bytes());
    out.push(0x00); // Table class 0 (DC / lossless difference), table ID 0
    out.extend_from_slice(&huff_table.bits[1..=16]);
    out.extend_from_slice(&huff_table.huffval);

    // 3. SOF3 Marker (Lossless Huffman frame header)
    if two_components {
        let comp_width = width.div_ceil(2);
        let sof_len = 2 + 1 + 2 + 2 + 1 + (2 * 3);
        out.extend_from_slice(&[0xFF, 0xC3]);
        out.extend_from_slice(&(sof_len as u16).to_be_bytes());
        out.push(precision);
        out.extend_from_slice(&(height as u16).to_be_bytes());
        out.extend_from_slice(&(comp_width as u16).to_be_bytes());
        out.push(2); // 2 components
                     // Component 1: ID 1, H=1 V=1, Table 0
        out.extend_from_slice(&[1, 0x11, 0]);
        // Component 2: ID 2, H=1 V=1, Table 0
        out.extend_from_slice(&[2, 0x11, 0]);
    } else {
        let sof_len = 2 + 1 + 2 + 2 + 1 + 3;
        out.extend_from_slice(&[0xFF, 0xC3]);
        out.extend_from_slice(&(sof_len as u16).to_be_bytes());
        out.push(precision);
        out.extend_from_slice(&(height as u16).to_be_bytes());
        out.extend_from_slice(&(width as u16).to_be_bytes());
        out.push(1); // 1 component
                     // Component 1: ID 1, H=1 V=1, Table 0
        out.extend_from_slice(&[1, 0x11, 0]);
    }

    // 4. SOS Marker (Start of Scan)
    if two_components {
        let sos_len = 2 + 1 + (2 * 2) + 3;
        out.extend_from_slice(&[0xFF, 0xDA]);
        out.extend_from_slice(&(sos_len as u16).to_be_bytes());
        out.push(2); // 2 components in scan
        out.extend_from_slice(&[1, 0x00]); // Comp 1 uses DC table 0
        out.extend_from_slice(&[2, 0x00]); // Comp 2 uses DC table 0
        out.push(predictor as u8); // Predictor selection (1..7)
        out.push(0); // Se (spectral selection end = 0)
        out.push(0); // Ah=0, Al=0 (point transform = 0)
    } else {
        let sos_len = 2 + 1 + 2 + 3;
        out.extend_from_slice(&[0xFF, 0xDA]);
        out.extend_from_slice(&(sos_len as u16).to_be_bytes());
        out.push(1);
        out.extend_from_slice(&[1, 0x00]);
        out.push(predictor as u8);
        out.push(0);
        out.push(0);
    }

    // 5. Entropy-coded scan bitstream
    let mut bit_writer = BitWriter::new();

    if two_components {
        let comp_width = width.div_ceil(2);
        // Keep previous row samples for Ra, Rb, Rc prediction
        let mut prev_row_c1 = vec![0i32; comp_width];
        let mut prev_row_c2 = vec![0i32; comp_width];

        for row in 0..height {
            let row_offset = row * width;
            let mut ra_c1 = 0i32;
            let mut ra_c2 = 0i32;

            for col in 0..comp_width {
                // Component 1 sample (even column: 2*col)
                let c1_idx = row_offset + col * 2;
                let c1_val = if c1_idx < samples.len() {
                    samples[c1_idx] as i32
                } else {
                    0
                };
                let rb_c1 = prev_row_c1[col];
                let rc_c1 = if col > 0 { prev_row_c1[col - 1] } else { 0 };
                let px_c1 = predictor.predict(ra_c1, rb_c1, rc_c1, row, col, precision);
                let diff_c1 = c1_val - px_c1;

                let (ssss_c1, bits_c1) = encode_diff(diff_c1);
                let (code_c1, len_c1) = huff_table.get_code(ssss_c1);
                bit_writer.write_bits(code_c1, len_c1);
                bit_writer.write_bits(bits_c1, ssss_c1);

                ra_c1 = c1_val;
                prev_row_c1[col] = c1_val;

                // Component 2 sample (odd column: 2*col + 1)
                let c2_idx = row_offset + col * 2 + 1;
                let c2_val = if c2_idx < samples.len() {
                    samples[c2_idx] as i32
                } else {
                    0
                };
                let rb_c2 = prev_row_c2[col];
                let rc_c2 = if col > 0 { prev_row_c2[col - 1] } else { 0 };
                let px_c2 = predictor.predict(ra_c2, rb_c2, rc_c2, row, col, precision);
                let diff_c2 = c2_val - px_c2;

                let (ssss_c2, bits_c2) = encode_diff(diff_c2);
                let (code_c2, len_c2) = huff_table.get_code(ssss_c2);
                bit_writer.write_bits(code_c2, len_c2);
                bit_writer.write_bits(bits_c2, ssss_c2);

                ra_c2 = c2_val;
                prev_row_c2[col] = c2_val;
            }
        }
    } else {
        let mut prev_row = vec![0i32; width];
        for row in 0..height {
            let row_offset = row * width;
            let mut ra = 0i32;
            for col in 0..width {
                let sample_val = samples[row_offset + col] as i32;
                let rb = prev_row[col];
                let rc = if col > 0 { prev_row[col - 1] } else { 0 };
                let px = predictor.predict(ra, rb, rc, row, col, precision);
                let diff = sample_val - px;

                let (ssss, bits) = encode_diff(diff);
                let (code, len) = huff_table.get_code(ssss);
                bit_writer.write_bits(code, len);
                bit_writer.write_bits(bits, ssss);

                ra = sample_val;
                prev_row[col] = sample_val;
            }
        }
    }

    bit_writer.flush();
    out.extend_from_slice(&bit_writer.buffer);

    // 6. EOI Marker
    out.extend_from_slice(&[0xFF, 0xD9]);

    Ok(out)
}

/// Decodes ITU-T T.81 Lossless JPEG (SOF3) bytes back into full-precision samples.
/// Returns (samples, width, height, precision, two_components).
pub fn decode_lossless_jpeg(bytes: &[u8]) -> Result<(Vec<u16>, usize, usize, u8, bool), String> {
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return Err("Invalid JPEG: Missing SOI marker".to_string());
    }

    let mut pos = 2;
    let mut huff_table: Option<HuffmanTable> = None;
    let mut precision = 14u8;
    let mut height = 0usize;
    let mut width = 0usize;
    let mut components = 1u8;
    let mut predictor = PredictorSelection::Ra;

    // Parse headers until SOS
    while pos + 1 < bytes.len() {
        if bytes[pos] != 0xFF {
            pos += 1;
            continue;
        }
        let marker = bytes[pos + 1];
        pos += 2;

        if marker == 0xD9 {
            // EOI
            break;
        }

        if marker == 0xC4 {
            // DHT
            let len = BigEndian::read_u16(&bytes[pos..pos + 2]) as usize;
            let table_bytes = &bytes[pos + 2..pos + len];
            let mut bits = [0u8; 17];
            bits[1..=16].copy_from_slice(&table_bytes[1..17]);
            let huffval = table_bytes[17..].to_vec();
            huff_table = Some(HuffmanTable::new(bits, huffval));
            pos += len;
        } else if marker == 0xC3 {
            // SOF3 (Lossless JPEG)
            let len = BigEndian::read_u16(&bytes[pos..pos + 2]) as usize;
            precision = bytes[pos + 2];
            height = BigEndian::read_u16(&bytes[pos + 3..pos + 5]) as usize;
            width = BigEndian::read_u16(&bytes[pos + 5..pos + 7]) as usize;
            components = bytes[pos + 7];
            pos += len;
        } else if marker == 0xDA {
            // SOS (Start of Scan)
            let len = BigEndian::read_u16(&bytes[pos..pos + 2]) as usize;
            let num_comps = bytes[pos + 2];
            let pred_sel = bytes[pos + 3 + (num_comps as usize) * 2];
            predictor = PredictorSelection::from_u8(pred_sel)
                .ok_or_else(|| format!("Unsupported predictor selection: {}", pred_sel))?;
            pos += len;
            break; // Scan bitstream starts immediately after SOS header
        } else {
            // Skip other marker segments
            if pos + 2 <= bytes.len() {
                let len = BigEndian::read_u16(&bytes[pos..pos + 2]) as usize;
                pos += len;
            }
        }
    }

    let huff = huff_table.ok_or_else(|| "Missing DHT marker in JPEG".to_string())?;
    let scan_data = &bytes[pos..];
    let mut bit_reader = BitReader::new(scan_data);

    let two_components = components == 2;
    let total_width = if two_components { width * 2 } else { width };
    let mut samples = vec![0u16; total_width * height];

    if two_components {
        let comp_width = width;
        let mut prev_row_c1 = vec![0i32; comp_width];
        let mut prev_row_c2 = vec![0i32; comp_width];

        for row in 0..height {
            let row_offset = row * total_width;
            let mut ra_c1 = 0i32;
            let mut ra_c2 = 0i32;

            for col in 0..comp_width {
                // Decode component 1
                let ssss_c1 = bit_reader.decode_huffman(&huff)?;
                let diff_bits_c1 = if ssss_c1 > 0 {
                    bit_reader.read_bits(ssss_c1)?
                } else {
                    0
                };
                let diff_c1 = decode_diff(ssss_c1, diff_bits_c1);
                let rb_c1 = prev_row_c1[col];
                let rc_c1 = if col > 0 { prev_row_c1[col - 1] } else { 0 };
                let px_c1 = predictor.predict(ra_c1, rb_c1, rc_c1, row, col, precision);
                let val_c1 = (px_c1 + diff_c1) as u16;

                samples[row_offset + col * 2] = val_c1;
                ra_c1 = val_c1 as i32;
                prev_row_c1[col] = val_c1 as i32;

                // Decode component 2
                let ssss_c2 = bit_reader.decode_huffman(&huff)?;
                let diff_bits_c2 = if ssss_c2 > 0 {
                    bit_reader.read_bits(ssss_c2)?
                } else {
                    0
                };
                let diff_c2 = decode_diff(ssss_c2, diff_bits_c2);
                let rb_c2 = prev_row_c2[col];
                let rc_c2 = if col > 0 { prev_row_c2[col - 1] } else { 0 };
                let px_c2 = predictor.predict(ra_c2, rb_c2, rc_c2, row, col, precision);
                let val_c2 = (px_c2 + diff_c2) as u16;

                samples[row_offset + col * 2 + 1] = val_c2;
                ra_c2 = val_c2 as i32;
                prev_row_c2[col] = val_c2 as i32;
            }
        }
    } else {
        let mut prev_row = vec![0i32; width];
        for row in 0..height {
            let row_offset = row * width;
            let mut ra = 0i32;
            for col in 0..width {
                let ssss = bit_reader.decode_huffman(&huff)?;
                let diff_bits = if ssss > 0 {
                    bit_reader.read_bits(ssss)?
                } else {
                    0
                };
                let diff = decode_diff(ssss, diff_bits);
                let rb = prev_row[col];
                let rc = if col > 0 { prev_row[col - 1] } else { 0 };
                let px = predictor.predict(ra, rb, rc, row, col, precision);
                let val = (px + diff) as u16;

                samples[row_offset + col] = val;
                ra = val as i32;
                prev_row[col] = val as i32;
            }
        }
    }

    Ok((samples, total_width, height, precision, two_components))
}
