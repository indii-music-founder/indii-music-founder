import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
const projectId = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const location = process.env.VERTEX_LOCATION || 'global';

function getVertexAIBaseUrl(vertexLocation: string): string {
    if (vertexLocation === 'global' || vertexLocation === 'us' || vertexLocation === 'eu') {
        return 'https://aiplatform.googleapis.com';
    }
    return `https://${vertexLocation}-aiplatform.googleapis.com`;
}

console.log('--- API Key Permission Check ---');
console.log(`Key Present: ${!!apiKey}`);
console.log(`Project ID: ${projectId}`);
console.log(`Location: ${location}`);
console.log('--------------------------------');

async function checkGeminiAPI() {
    console.log('\n[1/2] Testing Google AI (Gemini API)...');
    if (!apiKey) {
        console.log('❌ Skipped: No API Key found.');
        return false;
    }
    try {
        // Using new @google/genai SDK (GA)
        const genAI = new GoogleGenAI({ apiKey });
        const result = await genAI.models.generateContent({
            model: 'gemini-3-flash-preview', // Use current approved model
            contents: [{ role: 'user', parts: [{ text: 'Hello, are you there?' }] }]
        });
        console.log('✅ Gemini API Success! (The key works for Google AI Studio)');
        console.log(`   Response preview: "${(result.text || '').slice(0, 50)}..."`);
        return true;
    } catch (error: any) {
        console.log('❌ Gemini API Failed');
        if (error.message.includes('API key not valid')) {
            console.log('   Reason: Invalid API Key.');
        } else if (error.message.includes('PERMISSION_DENIED')) {
            console.log('   Reason: Permission Denied.');
        } else {
            console.log('   Error:', error.message);
        }
        return false;
    }
}

async function checkVertexAI() {
    console.log('\n[2/2] Testing Google Cloud Vertex AI (via REST)...');
    if (!projectId || !apiKey) {
        console.log('❌ Skipped: Missing Project ID or API Key.');
        return false;
    }

    // Attempting to use the API Key with Vertex AI REST endpoint.
    // This often requires the key to be restricted/enabled for "Vertex AI API" in GCP Console.
    const endpoint = `${getVertexAIBaseUrl(location)}/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ role: 'user', parts: [{ text: 'Hello from Vertex REST?' }] }]
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            signal: AbortSignal.timeout(30000),
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.log('❌ Vertex AI Failed');
            // @ts-expect-error - ignoring intentional type stress test
            const msg = data.error?.message || response.statusText;
            console.log('   Error:', msg);

            if (msg.includes('Method doesn\'t allow unregistered callers')) {
                console.log('   Reason: Key likely restricted or Vertex API not enabled for this key.');
            }
            if (msg.includes('API keys are not supported')) {
                console.log('   Reason: This endpoint might not support API keys directly without OAuth.');
            }
            return false;
        }

        console.log('✅ Vertex AI Success! (The key works for Vertex AI)');
        return true;
    } catch (error: any) {
        console.log('❌ Vertex AI Network Error');
        console.log('Error:', error.message);
        return false;
    }
}

async function run() {
    await checkGeminiAPI();
    await checkVertexAI();
}

run();
