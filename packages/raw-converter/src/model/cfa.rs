use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CfaPattern {
    RGGB,
    BGGR,
    GRBG,
    GBRG,
}

impl CfaPattern {
    /// Returns the 4-byte DNG CFAPattern tag value for this 2x2 Bayer repeat block.
    /// In DNG TIFF spec: 0 = Red, 1 = Green, 2 = Blue.
    pub fn to_dng_pattern_bytes(&self) -> [u8; 4] {
        match self {
            CfaPattern::RGGB => [0, 1, 1, 2],
            CfaPattern::BGGR => [2, 1, 1, 0],
            CfaPattern::GRBG => [1, 0, 2, 1],
            CfaPattern::GBRG => [1, 2, 0, 1],
        }
    }

    /// Color plane at (row, col) coordinates: 0 = Red, 1 = Green, 2 = Blue
    pub fn color_at(&self, row: u32, col: u32) -> u8 {
        let r = (row % 2) as usize;
        let c = (col % 2) as usize;
        let idx = r * 2 + c;
        self.to_dng_pattern_bytes()[idx]
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            CfaPattern::RGGB => "RGGB",
            CfaPattern::BGGR => "BGGR",
            CfaPattern::GRBG => "GRBG",
            CfaPattern::GBRG => "GBRG",
        }
    }
}
