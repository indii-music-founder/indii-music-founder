import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: '../../.env' });

const apiKey = process.env.VITE_API_KEY;

if (!apiKey) {
    console.error("No API key found in .env");
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey });

async function run() {
    try {
        console.log("Calling Gemini 3 Flash Image Preview...");
        const response = await client.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: [{ role: "user", parts: [{ text: "a beautiful sunset" }] }],
            config: {
                responseModalities: ["IMAGE"]
            }
        });
        
        console.log("Success! Candidates:", response.candidates?.length);
        if (response.candidates?.[0]?.content?.parts?.[0]) {
            console.log("Got image data part");
        }
    } catch (e) {
        console.error("Error from API:");
        console.error(e);
        if (e.status) console.error("Status:", e.status);
    }
}

run();
