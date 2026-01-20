
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'functions/.env' });

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_ID = 'gemini-3-pro-image-preview';
// Endpoint for AI Studio (Generative Language API)
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${API_KEY}`;

async function verifyGeminiApiRest() {
    if (!API_KEY) {
        console.error('❌ No GEMINI_API_KEY, cannot test.');
        return;
    }

    console.log(`Verifying Google AI Studio API via REST`);
    console.log(`Model: ${MODEL_ID}`);
    console.log(`Endpoint: https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`);

    const payload = {
        contents: [
            {
                parts: [
                    { text: "A futuristic city with flying cars, neon lights, 8k resolution" }
                ]
            }
        ],
        // Image generation specific config if supported by this endpoint/model
        // For gemini-3-pro-image-preview, it might be different, but let's try standard generateContent
    };

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log(`Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.error('❌ Error response:', JSON.stringify(data, null, 2));
        } else {
            console.log('✅ SUCCESS! Response received.');
            // console.log(JSON.stringify(data, null, 2)); // Detailed log
            if (data.candidates && data.candidates.length > 0) {
                console.log('candidates found:', data.candidates.length);
            }
        }
    } catch (error: any) {
        console.error('❌ Network/Script Error:', error.message);
    }
}

verifyGeminiApiRest();
