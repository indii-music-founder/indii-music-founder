/// ITU-T T.81 Table H.1 Predictors for Lossless JPEG

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PredictorSelection {
    Ra = 1,              // 1: Ra (left neighbor)
    Rb = 2,              // 2: Rb (upper neighbor)
    Rc = 3,              // 3: Rc (upper-left neighbor)
    RaPlusRbMinusRc = 4, // 4: Ra + Rb - Rc
    RaPlusHalfDiff = 5,  // 5: Ra + ((Rb - Rc) / 2)
    RbPlusHalfDiff = 6,  // 6: Rb + ((Ra - Rc) / 2)
    AverageRaRb = 7,     // 7: (Ra + Rb) / 2
}

impl PredictorSelection {
    pub fn from_u8(val: u8) -> Option<Self> {
        match val {
            1 => Some(Self::Ra),
            2 => Some(Self::Rb),
            3 => Some(Self::Rc),
            4 => Some(Self::RaPlusRbMinusRc),
            5 => Some(Self::RaPlusHalfDiff),
            6 => Some(Self::RbPlusHalfDiff),
            7 => Some(Self::AverageRaRb),
            _ => None,
        }
    }

    /// Computes predicted value Px given Ra (left), Rb (above), Rc (above-left),
    /// and row/col within the component plane.
    #[inline(always)]
    pub fn predict(&self, ra: i32, rb: i32, rc: i32, row: usize, col: usize, precision: u8) -> i32 {
        if row == 0 && col == 0 {
            // Initial predictor for start of scan
            1i32 << (precision - 1)
        } else if row == 0 {
            // Top row: only left neighbor exists
            ra
        } else if col == 0 {
            // First column: only upper neighbor exists
            rb
        } else {
            match self {
                Self::Ra => ra,
                Self::Rb => rb,
                Self::Rc => rc,
                Self::RaPlusRbMinusRc => ra + rb - rc,
                Self::RaPlusHalfDiff => ra + ((rb - rc) >> 1),
                Self::RbPlusHalfDiff => rb + ((ra - rc) >> 1),
                Self::AverageRaRb => (ra + rb) >> 1,
            }
        }
    }
}
