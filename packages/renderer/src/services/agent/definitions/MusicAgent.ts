/**
 * MusicAgent.ts
 * 
 * The Sonic Director - Expert in audio intelligence and music metadata.
 * Specializes in analyzing tracks via Audio DNA extraction and preparing distribution-ready metadata.
 */

import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';
import { MusicTools } from '../tools/MusicTools';
import systemPrompt from '@agents/music/prompt.md?raw';

export const MusicAgent: AgentConfig = {
    id: "music",
    name: "Music Director",
    description: "Expert in audio intelligence, metadata generation, and DSP compliance. Extracts Audio DNA and prepares tracks for distribution.",
    color: "bg-blue-600",
    category: "department",
    systemPrompt: systemPrompt,
    get functions() {
        return {
            analyze_audio: MusicTools.analyze_audio,
            create_music_metadata: MusicTools.create_music_metadata,
            update_track_metadata: MusicTools.update_track_metadata,
            verify_metadata_golden: MusicTools.verify_metadata_golden,
            scrub_id3_tags: MusicTools.scrub_id3_tags,
            inject_splits_to_metadata: MusicTools.inject_splits_to_metadata,
            export_dolby_atmos_stems: MusicTools.export_dolby_atmos_stems,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['create_music_metadata', 'analyze_audio', 'verify_metadata_golden', 'update_track_metadata', 'scrub_id3_tags', 'inject_splits_to_metadata', 'export_dolby_atmos_stems'],

    tools: [{
        functionDeclarations: [
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
                name: "update_track_metadata",
                description: "Updates specific metadata fields for a track.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackId: { type: "STRING", description: "ISRC or ID of the track." },
                        updates: { type: "OBJECT", description: "Object containing fields to update (genre, mood, bpm, etc.)" }
                    },
                    required: ["trackId", "updates"]
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
            },
            {
                name: "scrub_id3_tags",
                description: "Standardizes and cleans ID3 tags on an audio file.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        fileUrl: { type: "STRING", description: "URL of the audio file to scrub." },
                        metadata: { type: "OBJECT", description: "Metadata to write to the tags." }
                    },
                    required: ["fileUrl", "metadata"]
                }
            },
            {
                name: "inject_splits_to_metadata",
                description: "Injects royalty split data into track metadata.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackId: { type: "STRING", description: "ID of the track." },
                        splits: { type: "ARRAY", items: { type: "OBJECT" }, description: "Array of collaborator split objects." }
                    },
                    required: ["trackId", "splits"]
                }
            },
            {
                name: "export_dolby_atmos_stems",
                description: "Exports audio stems formatted for Dolby Atmos mixing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackId: { type: "STRING", description: "ID of the track." },
                        format: { type: "STRING", enum: ["wav", "aiff"], description: "Audio format for stems." },
                        stemCount: { type: "NUMBER", description: "Number of stems to export." }
                    },
                    required: ["trackId", "format", "stemCount"]
                }
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(MusicAgent);
