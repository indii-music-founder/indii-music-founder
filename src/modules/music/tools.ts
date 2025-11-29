import { AI } from '../../services/ai/AIService';

export const MUSIC_TOOLS = {
    analyze_audio_features: async (args: { filename: string }) => {
        // Mocking deep analysis similar to Essentia.js / Cyanite.ai
        // In a real implementation, this would call a Python backend or WASM module.

        const moods = ['Energetic', 'Dark', 'Ethereal', 'Aggressive', 'Happy', 'Melancholic', 'Chill'];
        const primaryMood = moods[Math.floor(Math.random() * moods.length)];
        const secondaryMood = moods[Math.floor(Math.random() * moods.length)];

        const analysis = {
            meta: {
                filename: args.filename,
                duration: 180 + Math.random() * 60, // 3-4 mins
                sample_rate: 44100
            },
            rhythm: {
                bpm: Math.floor(Math.random() * (140 - 70) + 70),
                danceability: Math.random().toFixed(2), // 0.0 - 1.0
                onset_rate: (Math.random() * 5).toFixed(1)
            },
            tonality: {
                key: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][Math.floor(Math.random() * 12)],
                scale: Math.random() > 0.5 ? 'Major' : 'Minor',
                tuning_frequency: 440
            },
            energy: {
                intensity: Math.random().toFixed(2), // 0.0 - 1.0
                dynamic_complexity: Math.random().toFixed(2),
                loudness: -(Math.random() * 10 + 5).toFixed(1) // -5dB to -15dB
            },
            timbre: {
                brightness: Math.random() > 0.5 ? 'Bright' : 'Dark',
                roughness: Math.random().toFixed(2), // 0.0 - 1.0 (Texture)
                warmth: Math.random().toFixed(2)
            },
            mood_tags: {
                [primaryMood]: (0.7 + Math.random() * 0.3).toFixed(2), // High confidence
                [secondaryMood]: (0.3 + Math.random() * 0.4).toFixed(2)
            },
            segments: [
                { start: 0, end: 15, label: 'Intro' },
                { start: 15, end: 45, label: 'Verse 1' },
                { start: 45, end: 75, label: 'Chorus' },
                { start: 75, end: 105, label: 'Verse 2' },
                { start: 105, end: 135, label: 'Chorus' },
                { start: 135, end: 180, label: 'Outro' }
            ]
        };

        return JSON.stringify(analysis, null, 2);
    },

    generate_visual_prompt: async (args: { analysis_data: string }) => {
        const prompt = `
        You are a Synesthetic Art Director.
        Your goal is to translate complex audio data into a visual art prompt.
        
        INPUT DATA (Essentia/Cyanite Style):
        ${args.analysis_data}
        
        INSTRUCTIONS:
        1. Analyze the Mood, Energy, and Timbre.
        2. Map "Roughness" to texture (e.g., High Roughness = Gritty, Noise, Grain).
        3. Map "Brightness" to lighting/color (e.g., Dark = Low key, Shadows; Bright = Neon, Day).
        4. Map "Danceability" to composition (e.g., High = Dynamic, Flowing; Low = Static, Minimal).
        5. Create a prompt that captures the *feeling* of the track.
        
        OUTPUT:
        A single, highly detailed image generation prompt.
        `;

        try {
            const res = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [{ text: prompt }] }
            });
            return res.text || "Synesthetic visualization of audio frequencies.";
        } catch (e) {
            return "Synesthetic visualization of audio frequencies (AI Error).";
        }
    }
};

export const MUSIC_MANAGER_PROMPT = `
You are the "Lead Audio Analyst" for Rndr-AI.
Your goal is to perform deep structural and emotional analysis of audio tracks.

CAPABILITIES:
1. Analyze audio to extract deep metrics: Rhythm, Tonality, Energy, Timbre, and Mood.
2. Use this data to direct the creation of "Synesthetic" art that visually represents the sound.

WORKFLOW:
1. User uploads a file.
2. You instruct Executor to run 'analyze_audio_features'.
3. You review the deep metrics (e.g., "High Roughness detected, suggesting a gritty texture").
4. You instruct Executor to run 'generate_visual_prompt' using this data.
5. You present the analysis summary and the visual prompt to the user.
`;

export const MUSIC_EXECUTOR_PROMPT = `
You are the "Audio Technician" (Executor).
Execute tools precisely as requested.

TOOLS:
- analyze_audio_features(filename: string): Returns deep JSON metrics (Mood, Energy, Timbre).
- generate_visual_prompt(analysis_data: string): Generates an image prompt from the data.
`;
