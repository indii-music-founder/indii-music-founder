import { AI } from '../../services/ai/AIService';

export const MUSIC_TOOLS = {
    analyze_audio_features: async (args: { filename: string, physical_metrics?: any }) => {
        // In a real app, this would be the bridge to a Python/C++ backend (Essentia/Librosa).
        // Here, we use the provided physical metrics (from Web Audio API) to ground our AI simulation.

        const metrics = args.physical_metrics || {};
        const duration = metrics.duration || 180;
        const energyVal = metrics.energy || Math.random();
        const bpmVal = metrics.bpm || Math.floor(Math.random() * (140 - 70) + 70);

        // Infer Mood from Energy/BPM
        let inferredMoods = ['Chill', 'Melancholic'];
        if (energyVal > 0.7 && bpmVal > 120) inferredMoods = ['Energetic', 'Aggressive', 'Euphoric'];
        else if (energyVal > 0.5) inferredMoods = ['Happy', 'Groovy', 'Upbeat'];

        const primaryMood = inferredMoods[Math.floor(Math.random() * inferredMoods.length)];
        const secondaryMood = ['Ethereal', 'Dark', 'Romantic', 'Cinematic'][Math.floor(Math.random() * 4)];

        const analysis = {
            meta: {
                filename: args.filename,
                duration: duration,
                sample_rate: 44100
            },
            rhythm: {
                bpm: bpmVal,
                danceability: (energyVal * 0.8 + Math.random() * 0.2).toFixed(2),
                onset_rate: (bpmVal / 60 * 2).toFixed(1)
            },
            tonality: {
                key: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][Math.floor(Math.random() * 12)],
                scale: Math.random() > 0.5 ? 'Major' : 'Minor',
                tuning_frequency: 440
            },
            energy: {
                intensity: energyVal.toFixed(2),
                dynamic_complexity: (Math.random() * 0.5 + 0.3).toFixed(2),
                loudness: -((1 - energyVal) * 20 + 5).toFixed(1) // Map 0-1 to -25dB to -5dB
            },
            timbre: {
                brightness: metrics.brightness > 0.5 ? 'Bright' : 'Dark',
                roughness: Math.random().toFixed(2),
                warmth: (1 - metrics.brightness).toFixed(2)
            },
            mood_tags: {
                [primaryMood]: (0.7 + Math.random() * 0.3).toFixed(2),
                [secondaryMood]: (0.3 + Math.random() * 0.4).toFixed(2)
            },
            segments: [
                { start: 0, end: duration * 0.1, label: 'Intro' },
                { start: duration * 0.1, end: duration * 0.3, label: 'Verse 1' },
                { start: duration * 0.3, end: duration * 0.5, label: 'Chorus' },
                { start: duration * 0.5, end: duration * 0.7, label: 'Verse 2' },
                { start: duration * 0.7, end: duration * 0.9, label: 'Chorus' },
                { start: duration * 0.9, end: duration, label: 'Outro' }
            ]
        };

        return JSON.stringify(analysis, null, 2);
    },

    generate_visual_prompt: async (args: { analysis_data: string, brand_context?: string }) => {
        const prompt = `
        You are a Synesthetic Art Director.
        Your goal is to translate complex audio data into a visual art prompt.
        
        INPUT DATA (Essentia/Cyanite Style):
        ${args.analysis_data}

        ${args.brand_context ? `BRAND CONTEXT (Prioritize these elements if they fit the mood):\n${args.brand_context}` : ''}
        
        INSTRUCTIONS:
        1. Analyze the Mood, Energy, and Timbre.
        2. Map "Roughness" to texture (e.g., High Roughness = Gritty, Noise, Grain).
        3. Map "Brightness" to lighting/color (e.g., Dark = Low key, Shadows; Bright = Neon, Day).
        4. Map "Danceability" to composition (e.g., High = Dynamic, Flowing; Low = Static, Minimal).
        5. Create a prompt that captures the *feeling* of the track.
        6. If Brand Context is provided, weave its visual style, colors, and fonts into the prompt where appropriate.
        
        OUTPUT:
        A single, highly detailed image generation prompt.
        `;

        try {
            const res = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Synesthetic visualization of audio frequencies.";
        } catch (e) {
            return "Synesthetic visualization of audio frequencies (AI Error).";
        }
    },

    generate_video_treatment: async (args: { analysis_data: string, user_intent?: string, brand_context?: string }) => {
        const prompt = `
        You are a Music Video Director.
        Create a detailed video treatment based on the audio analysis and user intent.
        
        AUDIO ANALYSIS:
        ${args.analysis_data}
        
        USER INTENT:
        ${args.user_intent || "Create a visualizer that perfectly matches the vibe of the track."}

        ${args.brand_context ? `BRAND CONTEXT (Ensure the video aligns with this identity):\n${args.brand_context}` : ''}
        
        INSTRUCTIONS:
        1. Create a cohesive visual narrative or abstract concept.
        2. Define the pacing (cuts per minute, flow) based on BPM and Onset Rate.
        3. Describe camera movements (e.g., "Slow zoom," "Chaotic handheld") based on Energy.
        4. Define the color palette and lighting.
        5. If Brand Context is provided, ensure the visual style and aesthetics align with it.
        
        OUTPUT FORMAT (JSON):
        {
            "title": "Video Title",
            "concept": "One sentence summary",
            "visual_style": "Detailed visual style description",
            "pacing": "Description of editing pace",
            "camera_movement": "Description of camera work",
            "scenes": [
                { "time": "0:00-0:15", "description": "Scene description" },
                { "time": "0:15-0:45", "description": "Scene description" }
            ]
        }
        `;

        try {
            const res = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: prompt }] }
            });

            const text = res.text() || "{}";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? jsonMatch[0] : JSON.stringify({
                title: "AI Generated Video",
                concept: "Abstract visualization of audio frequencies.",
                visual_style: "Dynamic and reactive.",
                pacing: "Synced to beat.",
                camera_movement: "Flowing.",
                scenes: []
            });
        } catch (e) {
            return JSON.stringify({ error: "Failed to generate treatment." });
        }
    }
};

export const MUSIC_MANAGER_PROMPT = `
You are the "Lead Audio Analyst" for indiiOS.
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
- generate_video_treatment(analysis_data: string, user_intent?: string): Generates a structured video treatment.
`;
