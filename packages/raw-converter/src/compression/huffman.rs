/// Clean-room ITU-T T.81 / ISO/IEC 10918-1 Lossless JPEG Huffman coding.

#[derive(Debug, Clone)]
pub struct HuffmanTable {
    pub bits: [u8; 17], // bits[1..=16] is number of codes of length i
    pub huffval: Vec<u8>,
    // Derived lookup tables for encoding
    codes: Vec<u16>,
    code_lengths: Vec<u8>,
}

impl HuffmanTable {
    /// Creates a Huffman table from standard BITS and HUFFVAL arrays.
    pub fn new(bits: [u8; 17], huffval: Vec<u8>) -> Self {
        let mut table = Self {
            bits,
            huffval,
            codes: vec![0; 256],
            code_lengths: vec![0; 256],
        };
        table.build_encoding_tables();
        table
    }

    /// Standard ITU-T T.81 default lossless DC table for up to 16 categories.
    pub fn standard_lossless() -> Self {
        let mut bits = [0u8; 17];
        // Standard distribution of code lengths for difference categories 0..16
        bits[1] = 0;
        bits[2] = 1;
        bits[3] = 5;
        bits[4] = 1;
        bits[5] = 1;
        bits[6] = 1;
        bits[7] = 1;
        bits[8] = 1;
        bits[9] = 1;
        bits[10] = 0;
        bits[11] = 0;
        bits[12] = 0;
        bits[13] = 0;
        bits[14] = 0;
        bits[15] = 0;
        bits[16] = 0;

        let huffval = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        // Ensure total bits matches huffval length
        let mut custom_bits = [0u8; 17];
        custom_bits[2] = 1; // 0
        custom_bits[3] = 2; // 1, 2
        custom_bits[4] = 3; // 3, 4, 5
        custom_bits[5] = 3; // 6, 7, 8
        custom_bits[6] = 3; // 9, 10, 11
        custom_bits[7] = 3; // 12, 13, 14
        custom_bits[8] = 2; // 15, 16

        Self::new(custom_bits, huffval)
    }

    /// Builds the encoding tables (codes and code lengths) from BITS and HUFFVAL.
    fn build_encoding_tables(&mut self) {
        let mut code = 0u16;
        let mut k = 0;
        for len in 1..=16 {
            let count = self.bits[len] as usize;
            for _ in 0..count {
                if k < self.huffval.len() {
                    let val = self.huffval[k] as usize;
                    self.codes[val] = code;
                    self.code_lengths[val] = len as u8;
                    k += 1;
                }
                code += 1;
            }
            code <<= 1;
        }
    }

    pub fn get_code(&self, val: u8) -> (u16, u8) {
        (self.codes[val as usize], self.code_lengths[val as usize])
    }
}

/// BitWriter writes variable-length bit codes to a byte buffer with JPEG byte stuffing.
pub struct BitWriter {
    pub buffer: Vec<u8>,
    current_byte: u8,
    bits_in_current_byte: u8,
}

impl BitWriter {
    pub fn new() -> Self {
        Self {
            buffer: Vec::with_capacity(4096),
            current_byte: 0,
            bits_in_current_byte: 0,
        }
    }

    pub fn write_bits(&mut self, code: u16, len: u8) {
        if len == 0 {
            return;
        }
        for i in (0..len).rev() {
            let bit = ((code >> i) & 1) as u8;
            self.current_byte = (self.current_byte << 1) | bit;
            self.bits_in_current_byte += 1;
            if self.bits_in_current_byte == 8 {
                self.emit_byte(self.current_byte);
                self.current_byte = 0;
                self.bits_in_current_byte = 0;
            }
        }
    }

    fn emit_byte(&mut self, b: u8) {
        self.buffer.push(b);
        if b == 0xFF {
            // Byte stuffing: 0xFF must be followed by 0x00 in JPEG entropy-coded segments
            self.buffer.push(0x00);
        }
    }

    pub fn flush(&mut self) {
        if self.bits_in_current_byte > 0 {
            // Pad remainder with 1s as per JPEG standard
            let padding = 8 - self.bits_in_current_byte;
            let final_byte = (self.current_byte << padding) | ((1 << padding) - 1);
            self.emit_byte(final_byte);
            self.current_byte = 0;
            self.bits_in_current_byte = 0;
        }
    }
}

/// BitReader reads variable-length bit codes from a byte buffer, reversing JPEG byte stuffing.
pub struct BitReader<'a> {
    data: &'a [u8],
    pos: usize,
    current_byte: u8,
    bits_left: u8,
}

impl<'a> BitReader<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Self {
            data,
            pos: 0,
            current_byte: 0,
            bits_left: 0,
        }
    }

    pub fn read_bit(&mut self) -> Result<u8, String> {
        if self.bits_left == 0 {
            if self.pos >= self.data.len() {
                return Err("Unexpected end of bitstream".to_string());
            }
            let b = self.data[self.pos];
            self.pos += 1;
            if b == 0xFF {
                if self.pos < self.data.len() {
                    let next = self.data[self.pos];
                    if next == 0x00 {
                        self.pos += 1; // Unstuff
                    } else if next >= 0xD0 && next <= 0xD7 {
                        // Restart marker
                        self.pos += 1;
                        return self.read_bit();
                    }
                }
            }
            self.current_byte = b;
            self.bits_left = 8;
        }

        self.bits_left -= 1;
        let bit = (self.current_byte >> self.bits_left) & 1;
        Ok(bit)
    }

    pub fn read_bits(&mut self, n: u8) -> Result<u16, String> {
        let mut val = 0u16;
        for _ in 0..n {
            val = (val << 1) | (self.read_bit()? as u16);
        }
        Ok(val)
    }

    pub fn decode_huffman(&mut self, table: &HuffmanTable) -> Result<u8, String> {
        let mut code = 0u16;
        let mut k = 0;
        for len in 1..=16 {
            code = (code << 1) | (self.read_bit()? as u16);
            let count = table.bits[len] as usize;
            for _ in 0..count {
                if k < table.huffval.len() {
                    let val = table.huffval[k];
                    if table.codes[val as usize] == code && table.code_lengths[val as usize] == len as u8 {
                        return Ok(val);
                    }
                    k += 1;
                }
            }
        }
        Err("Failed to decode Huffman symbol".to_string())
    }
}

/// Computes the magnitude category SSSS (0..16) for a difference value.
pub fn category(diff: i32) -> u8 {
    if diff == 0 {
        return 0;
    }
    let abs_val = diff.unsigned_abs();
    32 - abs_val.leading_zeros() as u8
}

/// Encodes a difference into its magnitude category and extra bits.
pub fn encode_diff(diff: i32) -> (u8, u16) {
    let ssss = category(diff);
    if ssss == 0 {
        return (0, 0);
    }
    let bits = if diff > 0 {
        diff as u16
    } else {
        ((1i32 << ssss) - 1 + diff) as u16
    };
    (ssss, bits)
}

/// Decodes a difference from its magnitude category and extra bits.
pub fn decode_diff(ssss: u8, bits: u16) -> i32 {
    if ssss == 0 {
        return 0;
    }
    let threshold = 1u16 << (ssss - 1);
    if bits >= threshold {
        bits as i32
    } else {
        (bits as i32) - ((1i32 << ssss) - 1)
    }
}
