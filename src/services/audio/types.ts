import type { AudioFeatures } from './AudioAnalysisService';

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
        image: string;      // Optimized for gemini-3.1-pro-image-preview
        veo: string;        // Optimized for veo-3.1-generate-preview
    };
}

export interface AudioIntelligenceProfile {
    id: string;             // Content hash or unique ID
    technical: AudioFeatures; // Speed, Key, Energy
    semantic: AudioSemanticData; // Vibe, Imagery, Prompts
    analyzedAt: number;
    modelVersion: string;   // e.g., "gemini-3.1-pro-preview"
}
