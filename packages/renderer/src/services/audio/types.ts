import { DSPComplianceReport } from './DSPComplianceValidator';

export interface TechnicalAudit {
    peakLevel: number;
    truePeakDb: number;
    integratedLoudness: number;
    sampleRate: number;
    isStereo: boolean;
    rejectionRisks: string[];
    compliance?: DSPComplianceReport;
}

export interface AudioFeatures {
    bpm: number;
    key: string;
    scale: string;
    energy: number;
    duration: number;
    danceability: number;
    loudness: number;
    valence?: number; // Happiness/Sadness
    audit?: TechnicalAudit;
    segments?: { start: number; label: string; energy: number }[];
}

export interface DeepAudioFeatures extends AudioFeatures {
    genre?: { [key: string]: number };
    moods?: {
        happy: number;
        aggressive: number;
        relaxed: number;
        sad: number;
    };
    voice_instrumental?: number; // >0.5 instrumental
    danceability_ml?: number;
}
export interface AudioSemanticData {
    mood: string[];         // e.g., ["Dark", "Energetic"]
    genre: string[];        // e.g., ["Industrial Techno", "Cyberpunk"]
    instruments: string[];  // e.g., ["Synthesizer", "Distorted Bass"]

    // DDEX Specific Fields (Inferred)
    ddexGenre: string;      // Primary Genre for DDEX (e.g., "Electronic")
    ddexSubGenre: string;   // SubGenre for DDEX (e.g., "Techno")
    language: string;       // ISO 639-2 (e.g., "eng", "zxx" for instrumental)
    isExplicit: boolean;    // Content advisory
    marketingComment: string; // DDEX SoundRecording/MarketingComment — DSP pitch copy

    // Sonic Soul (Session 1) — Timbre & Production Texture
    timbre: {
        texture: string;    // e.g., "Analog Warmth", "Digital Quantization", "Gritty Lo-Fi"
        brightness: string; // e.g., "Dark & Muddy", "Crisp & Airy", "Midrange-Heavy"
        saturation: string; // e.g., "Heavily Compressed", "Dynamic & Unprocessed"
        spaceDepth: string; // e.g., "Cavernous Reverb", "Dry & Intimate", "Wide Stereo Field"
    };
    productionValue: {
        era: string;        // e.g., "Late 90s Boom Bap", "Modern Hyperpop", "70s Soul"
        quality: string;    // e.g., "Bedroom Producer", "Professional Studio", "Lo-Fi Aesthetic"
        mixBalance: string; // e.g., "Bass-Forward", "Vocal-Forward", "Balanced"
        aiArtifacts: boolean; // True if quantization/AI artifacts are audible (Goal 3 compliance)
    };

    visualImagery: {
        abstract: string;   // For abstract visualizers
        narrative: string;  // For finding stock footage or generating scenes
        lighting: string;   // e.g., "Strobe lights, neon red"
    };
    marketingHooks: {
        keywords: string[]; // For SEO/Socials
        oneLiner: string;   // "A crushing industrial anthem for the digital age."
    };
    targetPrompts: {
        image: string;      // Optimized for gemini-3-pro-image-preview
        veo: string;        // Optimized for veo-3.1-generate-preview
    };
}

export interface AudioIntelligenceProfile {
    id: string;             // Content hash — fingerprint from FingerprintService
    technical: AudioFeatures; // BPM, Key, Energy — from Essentia.js WASM
    semantic: AudioSemanticData; // Mood, Genre, Imagery, Prompts — from Gemini 3 Pro
    analyzedAt: number;
    modelVersion: string;   // e.g., "gemini-3-pro-preview"
}
// Note: Render directives (image/veo prompts) are retrieved via NeuralCortexService.
// Call neuralCortex.processAndDirect(profile, label) after analyze() to get directives.
