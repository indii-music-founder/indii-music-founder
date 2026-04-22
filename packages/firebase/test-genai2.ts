import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: '../../.env' });

const apiKey = process.env.VITE_API_KEY;
if (!apiKey) process.exit(1);

const client = new GoogleGenAI({ apiKey });

async function run() {
    try {
        const config = {
            responseModalities: ["IMAGE"],
            imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K", // Make sure this is uppercase K
            },
            thinkingConfig: {
                thinkingLevel: "High"
            },
            tools: [{ googleSearch: {} }]
        };
        
        console.log("Calling Gemini 3 Flash Image Preview with advanced config...");
        const response = await client.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: [{ role: "user", parts: [{ text: "a beautiful sunset" }] }],
            config: config
        });
        
        console.log("Success! Candidates:", response.candidates?.length);
    } catch (e) {
        console.error("Error from API:");
        console.error(e);
        if (e.status) console.error("Status:", e.status);
    }
}

run();
