
import * as dotenv from 'dotenv';
dotenv.config();

import { fetch } from 'undici';

// @ts-expect-error - testing invalid input for API resilience
if (!global.fetch) global.fetch = fetch;

const functionsUrl = process.env.VITE_FUNCTIONS_URL || 'https://us-central1-indiios-v-1-1.cloudfunctions.net';

async function testFilesApi() {
    console.log("Testing Models API via Proxy...");
    const modelsUrl = `${functionsUrl}/ragProxy/v1beta/models`;

    try {
        const res = await fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Body:", text);
        const flashModels = JSON.parse(text);

        console.log("Flash Models:", JSON.stringify(flashModels, null, 2));

        console.log("Testing generateContent...");
        const generateUrl = `${functionsUrl}/ragProxy/v1beta/models/gemini-3-flash-preview:generateContent`;
        const contentRes = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, are you working?" }] }]
            })
        });
        console.log("Generate Status:", contentRes.status);
        console.log("Generate Body:", await contentRes.text());

    } catch (e) {
        console.error("List models failed:", e);
    }
}

testFilesApi();
