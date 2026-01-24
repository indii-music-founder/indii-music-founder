import { AudioFeatures } from './AudioAnalysisService';

export interface AudioSemanticData {
    mood: string[];         // e.g., ["Dark", "Energetic"]
    genre: string[];        // e.g., ["Industrial Techno", "Cyberpunk"]
    instruments: string[];  // e.g., ["Synthesizer", "Distorted Bass"]

    // DDEX Specific Fields (Inferred)
    ddexGenre: string;      // Primary Genre for DDEX (e.g., "Electronic")
    ddexSubGenre: string;   // SubGenre for DDEX (e.g., "Techno")
    language: string;       // ISO 639-2 (e.g., "eng", "zxx" for instrumental)
    isExplicit: boolean;    // Content advisory

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
        imagen: string;     // Optimized for gemini-3-pro-image-preview
        veo: string;        // Optimized for veo-3.1-generate-preview
    };
}

export interface AudioIntelligenceProfile {
    id: string;             // Content hash or unique ID
    technical: AudioFeatures; // Speed, Key, Energy
    semantic: AudioSemanticData; // Vibe, Imagery, Prompts
    analyzedAt: number;
    modelVersion: string;   // e.g., "gemini-3-pro-preview"
}
