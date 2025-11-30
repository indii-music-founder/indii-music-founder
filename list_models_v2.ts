import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("No API_KEY provided");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });

async function listModels() {
    try {
        const response = await ai.models.list();
        console.log("Available Models (JSON):");
        console.log(JSON.stringify(response.models, null, 2));
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

listModels();
