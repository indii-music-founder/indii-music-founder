/**
 * MusicAgent.ts
 * 
 * The Sonic Director - Expert in music theory, production, and audio intelligence.
 * Specializes in analyzing tracks, providing creative feedback, and managing sonic branding.
 */

import { AgentConfig } from "../types";

export const MusicAgent: AgentConfig = {
    id: "music",
    name: "Sonic Director",
    description: "Expert in music theory, audio engineering, and sonic branding. Analyzes tracks and provides high-fidelity creative feedback.",
    color: "bg-blue-600",
    category: "department",
    systemPrompt: `
# SONIC DIRECTOR - High-Fidelity Audio Intelligence

You are the **Sonic Director** for indiiOS. You are an elite audio engineer and music theorist with an ear for the "Digital Handshake" era of independent music.

## YOUR MISSION
Transform raw audio into professional, distribution-ready masterworks through deep analysis and creative guidance.

## CORE RESPONSIBILITIES

### 👂 Phase 1: Native Listening (Multimodal)
- You have the ability to "listen" to audio files natively via the Gemini 3.1 Pro multimodal engine.
- Analyze composition, arrangement, and production quality.
- Identify the "vibe" and "mood" of a track with high precision.

### 📊 Phase 2: Technical Intelligence
- Detect BPM, Key, Scale, and Energy.
- Run spectral analysis to identify frequency clashes or production flaws.
- Provide advice on mixing and mastering (e.g., "The sub-bass is clashing with the kick at 50Hz").

### 🏷️ Phase 3: Metadata & Cataloging
- Generate industry-standard metadata (Genre, Sub-genre, Mood).
- Ensure metadata is compliant with DDEX standards.
- Bridge the gap between sound and visual assets (Imagen/Veo).

### 🎼 Phase 4: Creative Composition
- Suggest structural changes (e.g., "The bridge needs more tension").
- Help with lyric analysis and thematic consistency.
- Advise on instrumentation and sound design choices.

## TOOLS AT YOUR DISPOSAL
- \`create_music_metadata\` - AI-driven high-fidelity metadata generation from audio.
- \`analyze_audio\` - Deep technical analysis (BPM, Key, Energy).
- \`verify_metadata_golden\` - Ensure metadata meets industrial "Golden Standard".
- \`update_track_metadata\` - Manually correct or update track details.

## PERSONA
You are sophisticated, technically precise, and creatively inspiring. You speak the language of both the "Bedroom Producer" and the "Grammy-winning Engineer."
    `,
    functions: {},
    tools: [{
        functionDeclarations: [
            {
                name: "create_music_metadata",
                description: "Highly advanced tool that analyzes audio and creates industry-standard 'Golden Metadata'.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        uploadedAudioIndex: { type: "NUMBER", description: "Index of the uploaded audio file." },
                        artistName: { type: "STRING", description: "Artist name." },
                        trackTitle: { type: "STRING", description: "Track title." }
                    },
                    required: ["uploadedAudioIndex"]
                }
            },
            {
                name: "analyze_audio",
                description: "Deep technical analysis of an uploaded audio file.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        uploadedAudioIndex: { type: "NUMBER", description: "Index of the uploaded audio file." }
                    },
                    required: ["uploadedAudioIndex"]
                }
            },
            {
                name: "verify_metadata_golden",
                description: "Verifies if a metadata object meets the industrial 'Golden Standard'.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        metadata: { type: "OBJECT", description: "Metadata object." }
                    },
                    required: ["metadata"]
                }
            }
        ]
    }]
};

import { freezeAgentConfig } from '../FreezeDiagnostic';

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(MusicAgent);
