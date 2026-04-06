import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function loadEnv() {
    let apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        try {
            const envContent = fs.readFileSync('.env', 'utf-8');
            const lines = envContent.split('\n');
            for (let line of lines) {
                if (line.startsWith('VITE_API_KEY=')) {
                    apiKey = line.split('=')[1].trim().replace(/(^"|"$)/g, '');
                }
            }
        } catch (e) { }
    }
    return apiKey;
}

async function run() {
    const apiKey = await loadEnv();
    if (!apiKey) {
        console.error('No API key found in .env');
        process.exit(1);
    }

    console.log("API Key loaded successfully.");
    const ai = new GoogleGenAI({ apiKey });

    console.log("Submitting Veo 3.1 video generation request (this will take 1-2 minutes)...");
    try {
        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: 'A cinematic drone shot flying over a glowing neon cyberpunk city at night, 4k, hyperrealistic',
            config: { durationSeconds: 4 }
        });

        let done = operation.done;
        let opName = operation.name;

        console.log("Request accepted! Monitoring operation:", opName);

        while (!done) {
            console.log("... still generating (wait 10s) ...");
            await new Promise(r => setTimeout(r, 10000));
            // Poll status
            const status = await ai.operations.get({ name: opName });
            done = status.done;
            if (done) {
                if (status.error) {
                    console.error("Veo generation failed:", status.error);
                    process.exit(1);
                }
                const videos = status.response?.generatedVideos;
                if (videos && videos.length > 0) {
                    const videoBytes = videos[0].video.videoBytes;
                    fs.writeFileSync('output_veo_3_1.mp4', Buffer.from(videoBytes, 'base64'));
                    console.log("SUCCESS! Video saved as output_veo_3_1.mp4");
                } else {
                    console.log("Done, but no video bytes returned.");
                }
            }
        }
    } catch (e) {
        console.error("Error during generation:", e);
    }
}

run();
