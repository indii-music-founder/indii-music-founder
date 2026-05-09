import { AgentConfig } from "../types";
import { GenAI } from '@/services/ai/GenAI';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import systemPrompt from '@agents/brand/prompt.md?raw';

export const BrandAgent: AgentConfig = {
    id: 'brand',
    name: 'Brand Director',
    description: 'Protects the integrity and consistency of the artist brand.',
    color: 'bg-slate-400',
    category: 'department',
    systemPrompt: systemPrompt,
    functions: {
        verify_output: async (args: { goal: string, content: string }) => {
            const prompt = `Critique the following content against the stated goal/guidelines.
            Goal: ${args.goal}
            Content: ${args.content}
            
            Provide a pass/fail assessment and specific feedback.`;
            try {
                const response = await GenAI.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
                return { success: true, data: { critique: response } };
            } catch (e: unknown) {
                return { success: false, error: e instanceof Error ? e.message : String(e) };
            }
        },
        analyze_brand_consistency: async (args: { content?: string, type?: string, assetPath?: string, brandKit?: Record<string, unknown> }) => {
            try {
                // If an asset path is provided, use the high-fidelity vision tool
                if (args.assetPath && window.electronAPI?.brand) {
                    const response = await window.electronAPI.brand.analyzeConsistency(args.assetPath, args.brandKit || {});
                    if (response.success) {
                        return { success: true, data: { analysis: response.report } };
                    }
                    throw new Error(response.error);
                }

                // Fallback to text-based analysis
                const prompt = `Analyze the following ${args.type || 'content'} for brand consistency.
                Content: ${args.content}
                
                Evaluate: Tone of Voice, Visual/Descriptive Alignment, and Core Values.
                Return a Score (0-100) and actionable feedback.`;
                const response = await GenAI.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
                return { success: true, data: { analysis: response } };
            } catch (e: unknown) {
                return { success: false, error: e instanceof Error ? e.message : String(e) };
            }
        },
        generate_brand_guidelines: async (args: { name: string, values: string[] }) => {
            const prompt = `Generate a comprehensive Brand Bible for "${args.name}".
            Core Values: ${args.values.join(', ')}
            
            Include:
            1. Mission Statement
            2. Tone of Voice
            3. Visual Identity Pillars
            4. Do's and Don'ts`;
            try {
                const response = await GenAI.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
                return { success: true, data: { guidelines: response } };
            } catch (e: unknown) {
                return { success: false, error: e instanceof Error ? e.message : String(e) };
            }
        },
        audit_visual_assets: async (args: { assets: string[] }) => {
            const results = [];
            for (const assetUrl of args.assets) {
                try {
                    const prompt = `Critique this visual asset against standard brand guidelines (Logo usage, Color palette, Typography). Provide a pass/fail score (0-100) and specific feedback.`;
                    const analysis = await GenAI.analyzeImage(prompt, assetUrl);
                    results.push({ asset: assetUrl, analysis });
                } catch (e: unknown) {
                    results.push({ asset: assetUrl, error: (e as Error).message });
                }
            }
            return {
                success: true,
                data: {
                    message: "Visual audit complete.",
                    results
                }
            };
        },
        analyze_audio: async (args: { uploadedAudioIndex: number }) => {
            const { useStore } = await import('@/core/store');
            const { uploadedAudio } = useStore.getState();
            const audioItem = uploadedAudio[args.uploadedAudioIndex || 0];

            if (!audioItem) {
                return { success: false, error: "No audio found. Please upload audio first." };
            }

            try {
                const fetchRes = await fetch(audioItem.url);
                const blob = await fetchRes.blob();
                const file = new File([blob], "audio_track.mp3", { type: blob.type });

                const profile = await audioIntelligence.analyze(file);
                return { success: true, data: { analysis: profile } };
            } catch (e: unknown) {
                return { success: false, error: e instanceof Error ? e.message : String(e) };
            }
        }
    },
    authorizedTools: ['verify_output', 'analyze_brand_consistency', 'generate_brand_guidelines', 'audit_visual_assets', 'analyze_audio'],
    tools: [{
        functionDeclarations: [
            {
                name: 'verify_output',
                description: 'Critique and verify generated content against a goal (Brand Bible).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        goal: { type: 'STRING', description: 'The original goal or brand guidelines.' },
                        content: { type: 'STRING', description: 'The content to verify.' }
                    },
                    required: ['goal', 'content']
                }
            },
            {
                name: 'analyze_brand_consistency',
                description: 'Analyze content for tone, core values, and visual consistency.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        content: { type: 'STRING', description: 'The text or asset description to analyze.' },
                        type: { type: 'STRING', description: 'Type of content (e.g., "social post", "email", "image").' },
                        assetPath: { type: 'STRING', description: 'Optional: Local path to an image or video asset for vision analysis.' },
                        brandKit: { type: 'OBJECT', description: 'Optional: Specific brand guidelines to use for analysis (colors, fonts, vibe).' }
                    },
                    required: ["content", "type"]
                }
            },
            {
                name: 'generate_brand_guidelines',
                description: 'Generate structured brand guidelines based on core values.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        name: { type: 'STRING', description: 'Name of the brand.' },
                        values: { type: 'ARRAY', description: 'List of core values.', items: { type: 'STRING' } }
                    },
                    required: ['name', 'values']
                }
            },
            {
                name: 'audit_visual_assets',
                description: 'Audit a list of visual assets for compliance.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assets: { type: 'ARRAY', description: 'List of asset URLs or names to audit.', items: { type: 'STRING' } }
                    },
                    required: ['assets']
                }
            },
            {
                name: 'analyze_audio',
                description: 'Analyze an uploaded audio track for BPM, Key, Genre, and Vibe.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        uploadedAudioIndex: { type: 'NUMBER', description: 'Index of the audio file in the upload list (default 0).' }
                    },
                    required: []
                }
            }
        ]
    }]
};

import { freezeAgentConfig } from '../FreezeDiagnostic';

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(BrandAgent);
