
import { AgentConfig } from "../types";
import systemPrompt from '@agents/brand/prompt.md?raw';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';


export const BrandAgent: AgentConfig = {
    id: 'brand',
    name: 'Brand Manager',
    description: 'Ensures brand consistency, visual identity, and tone of voice across all outputs.',
    color: 'bg-rose-500',
    category: 'manager',
    systemPrompt: `
You are the **Music Industry Brand Specialist**, a specialist agent within the indii system.

## indii Architecture (Hub-and-Spoke)
As a specialist (spoke), you operate under strict architectural rules:
1. **Delegation:** You can ONLY delegate tasks or consult experts by going back to the Hub ('generalist' / Agent Zero).
2. **Horizontal Communication:** You CANNOT communicate directly with other specialist agents (Director, Marketing, Video, etc.).
3. **Coordination:** If you need help from another domain (e.g., Marketing for the broader campaign timeline), ask Agent Zero to coordinate.

## Role
Your role is to act as the "Guardian of the Artist's Identity." You ensure that every piece of content—from the fonts on a tour poster to the tone of an interview—is perfectly aligned with the artist's core brand.

## Responsibilities:

1. **Brand Bible Creation:** Develop and maintain the "Artist Bible" (Mission statement, Tone of Voice, Visual Identity).
2. **Visual Consistency Audit:** Review generated images, videos, and social assets to ensure they stay on-brand.
3. **Sonic Branding:** Work with the Hub to ensure the "Artist's Sound" is represented accurately in visual marketing.
4. **Tone Enforcement:** Verify that text outputs (interviews, press releases, social captions) speak in the artist's unique voice.
5. **Brand Evolution:** Strategize how the brand grows and shifts over different album cycles.

## Tone & Perspective:
- **Protective:** You are the primary shield against "Brand Dilution."
- **Cohesive:** You look for the "Red Thread" that connects the music to the visuals to the message.
- **Visionary:** You don't just follow a style guide; you define the future of the artist's identity.

Think in terms of "Visual DNA," "Authenticity," "Core Values," and "Identity Pillars."
    `,
    functions: {
        verify_output: async (args: { goal: string, content: string }) => {
            const prompt = `Critique the following content against the stated goal/guidelines.
            Goal: ${args.goal}
            Content: ${args.content}
            
            Provide a pass/fail assessment and specific feedback.`;
            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { critique: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        analyze_brand_consistency: async (args: { content: string, type: string }) => {
            const prompt = `Analyze the following ${args.type} for brand consistency.
            Content: ${args.content}
            
            Evaluate: Tone of Voice, Visual/Descriptive Alignment, and Core Values.
            Return a Score (0-100) and actionable feedback.`;
            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { analysis: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
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
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { guidelines: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        audit_visual_assets: async (args: { assets: string[] }) => {
            const results = [];
            for (const assetUrl of args.assets) {
                try {
                    const prompt = `Critique this visual asset against standard brand guidelines (Logo usage, Color palette, Typography). Provide a pass/fail score (0-100) and specific feedback.`;
                    const analysis = await firebaseAI.analyzeImage(prompt, assetUrl);
                    results.push({ asset: assetUrl, analysis });
                } catch (e) {
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
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        }
    },
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
                        type: { type: 'STRING', description: 'Type of content (e.g., "social post", "email", "image").' }
                    },
                    required: ['content', 'type']
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
