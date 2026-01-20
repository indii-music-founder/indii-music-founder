
import { GoogleGenerativeAI } from '@google/generative-ai'; // Use the older SDK first as it's common, or check check @google/genai if installed
// Actually user code imports from @google/genai in index.ts, let's look at package.json to be sure.
// Using standard fetch fallback for now to be safe and dependency-free in this script? 
// No, let's use the installed lib. 
// Detailed SDK usage for image gen via `google-genai` (v0.x) or `@google/generative-ai`?
// The user code has: import { GoogleGenAI } from "@google/genai";

import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'functions/.env' });

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_ID = 'gemini-3-pro-image-preview';

async function verifyGeminiApi() {
    if (!API_KEY) {
        console.error('❌ No GEMINI_API_KEY found in env');
        return;
    }

    console.log(`Verifying Google AI Studio API`);
    console.log(`Model: ${MODEL_ID}`);
    console.log(`Key Prefix: ${API_KEY.substring(0, 10)}...`);

    try {
        const client = new GoogleGenAI({ apiKey: API_KEY });

        // Note: The new @google/genai SDK signature for Imagen might differ
        // For gemini-3-pro-image-preview, it is often a generateContent call with specific config

        console.log('Attempting generateContent...');
        const response = await client.models.generateContent({
            model: MODEL_ID,
            contents: [
                {
                    parts: [
                        { text: "A futuristic city with flying cars, neon lights, 8k resolution" }
                    ]
                }
            ],
            config: {
                responseModalities: ["IMAGE"]
            }
        });

        console.log('Response received!');
        console.log(JSON.stringify(response, null, 2));

        if (response.candidates && response.candidates.length > 0) {
            console.log('✅ SUCCESS! Candidates received.');
        } else {
            console.log('⚠️ Response received but no candidates?');
        }

    } catch (error: any) {
        console.error('❌ Error calling Gemini API:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        }
    }
}

verifyGeminiApi();
