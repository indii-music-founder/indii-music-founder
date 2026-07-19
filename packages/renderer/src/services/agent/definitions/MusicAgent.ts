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
import { buildDomainRetrievalTools, buildDomainRetrievalDeclarations } from '../tools/DomainTools';



const musicRetrievalConfig = {
    'tracks': { path: 'tracks', requiresUserIdFilter: true },
    'audio_assets': { path: 'audio_assets', requiresUserIdFilter: true },
    'analyzed_tracks': { path: 'analyzed_tracks', requiresUserIdFilter: true }
};
const musicRetrievalTools = buildDomainRetrievalTools('Music', musicRetrievalConfig);
const musicRetrievalDeclarations = buildDomainRetrievalDeclarations('Music', musicRetrievalConfig);

export const MusicAgent: AgentConfig = {
    id: "music",
    name: "Music Director",
    description: "Expert in audio intelligence, metadata generation, and DSP compliance. Extracts Audio DNA and prepares tracks for distribution.",
    color: "bg-blue-600",
    category: "department",
    systemPrompt: systemPrompt,
    get functions() {
        return {
            ...musicRetrievalTools,
            analyze_audio: MusicTools.analyze_audio,
            analyze_audio_stem: MusicTools.analyze_audio_stem,
            detect_bpm_and_key: MusicTools.detect_bpm_and_key,
            create_music_metadata: MusicTools.create_music_metadata,
            update_track_metadata: MusicTools.update_track_metadata,
            verify_metadata_golden: MusicTools.verify_metadata_golden,
            scrub_id3_tags: MusicTools.scrub_id3_tags,
            inject_splits_to_metadata: MusicTools.inject_splits_to_metadata,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['list_domain_records', 'create_music_metadata', 'analyze_audio', 'analyze_audio_stem', 'detect_bpm_and_key', 'verify_metadata_golden', 'update_track_metadata', 'scrub_id3_tags', 'inject_splits_to_metadata'],

    tools: [{
        functionDeclarations: [
            ...musicRetrievalDeclarations,
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
                name: "analyze_audio_stem",
                description: "Deep technical analysis of an isolated audio stem (e.g. vocals, drums).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        uploadedAudioIndex: { type: "NUMBER", description: "Index of the uploaded audio file." },
                        stemType: { type: "STRING", description: "Type of stem (e.g. 'vocals', 'drums', 'bass')" }
                    },
                    required: ["uploadedAudioIndex", "stemType"]
                }
            },
            {
                name: "detect_bpm_and_key",
                description: "Fast technical analysis focused solely on extracting BPM, Key, and Scale.",
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
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(MusicAgent);
