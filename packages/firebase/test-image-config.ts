import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: '../../.env' });
const apiKey = process.env.VITE_API_KEY;
const client = new GoogleGenAI({ apiKey });

async function run() {
    try {
        console.log("Calling with imageConfig...");
        const response = await client.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: "a beautiful mountain",
            config: {
                personGeneration: "ALLOW_ADULT",
                imageConfig: {
                    aspectRatio: "16:9",
                    style: "PHOTOREALISTIC",
                    quality: "HIGH",
                    seed: 12345
                }
            } as any
        });
        console.log("Success! Candidates:", response.candidates?.length);
    } catch (e) {
        console.error("Error from API:", e);
    }
}
run();
