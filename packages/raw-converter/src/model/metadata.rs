use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawMetadata {
    pub make: String,
    pub model: String,
    pub unique_camera_model: String,
    pub orientation: u16,
    pub as_shot_neutral: [f64; 3],
    pub color_matrix1: [f64; 9],
    pub color_matrix2: [f64; 9],
    pub calibration_illuminant1: u16,
    pub calibration_illuminant2: u16,
    pub baseline_exposure: f64,
    pub iso: Option<u32>,
    pub exposure_time: Option<(u32, u32)>,
    pub f_number: Option<(u32, u32)>,
    pub focal_length: Option<(u32, u32)>,
    pub lens_model: Option<String>,
    pub date_time_original: Option<String>,
}

impl Default for RawMetadata {
    fn default() -> Self {
        Self {
            make: "SONY".to_string(),
            model: "ILCE-7M3".to_string(),
            unique_camera_model: "Sony ILCE-7M3".to_string(),
            orientation: 1,
            // Standard neutral: D65 daylight neutral
            as_shot_neutral: [0.55, 1.0, 0.65],
            // Standard Sony color matrix for Standard Illuminant A
            color_matrix1: [
                0.8638, -0.2974, -0.0403,
                -0.5186, 1.3051, 0.2372,
                -0.0827, 0.1691, 0.6729,
            ],
            // Standard Sony color matrix for D65
            color_matrix2: [
                0.7323, -0.1983, -0.0617,
                -0.4578, 1.2584, 0.2227,
                -0.0768, 0.1704, 0.6482,
            ],
            calibration_illuminant1: 17, // Standard Light A
            calibration_illuminant2: 21, // D65
            baseline_exposure: 0.35,     // +0.35 EV standard Sony baseline lift
            iso: None,
            exposure_time: None,
            f_number: None,
            focal_length: None,
            lens_model: None,
            date_time_original: None,
        }
    }
}
