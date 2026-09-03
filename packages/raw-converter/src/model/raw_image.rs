use crate::model::cfa::CfaPattern;
use crate::model::metadata::RawMetadata;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct NormalizedRawImage {
    pub width: u32,
    pub height: u32,
    pub active_area: [u32; 4], // [top, left, bottom, right]
    pub bit_depth: u8,
    pub cfa_pattern: CfaPattern,
    pub black_level: u32,
    pub white_level: u32,
    pub samples: Vec<u16>,
    pub preview_jpeg: Option<Vec<u8>>,
    pub original_raw_bytes: Option<Vec<u8>>,
    pub metadata: RawMetadata,
}

impl NormalizedRawImage {
    /// Computes a deterministic SHA-256 hash of the normalized CFA sample buffer.
    /// Little-endian bytes of every u16 sensor sample in sequence.
    pub fn compute_cfa_hash(&self) -> String {
        let mut hasher = Sha256::new();
        for &sample in &self.samples {
            hasher.update(sample.to_le_bytes());
        }
        format!("{:x}", hasher.finalize())
    }

    /// Validates internal consistency of dimensions, active area, and sample count.
    pub fn validate(&self) -> Result<(), String> {
        let expected_count = (self.width as usize)
            .checked_mul(self.height as usize)
            .ok_or_else(|| "Image dimension overflow".to_string())?;

        if self.samples.len() != expected_count {
            return Err(format!(
                "Sample buffer length mismatch: expected {}, got {}",
                expected_count,
                self.samples.len()
            ));
        }

        if self.active_area[2] > self.height || self.active_area[3] > self.width {
            return Err("Active area bounds exceed sensor dimensions".to_string());
        }

        if self.active_area[0] >= self.active_area[2] || self.active_area[1] >= self.active_area[3]
        {
            return Err("Invalid active area rectangle".to_string());
        }

        Ok(())
    }
}
