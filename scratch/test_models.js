
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env manually since this is a scratch script
const envContent = readFileSync('.env', 'utf-8');
const env = Object.fromEntries(
    envContent.split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('='))
        .map(([key, ...val]) => [key, val.join('=')])
);

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'indiios-v-1-1',
    appId: '1:223837784072:web:28eabcf0c5dd985395e9bd',
    location: env.VITE_VERTEX_LOCATION || 'us-central1'
};

const app = initializeApp(firebaseConfig);
const vertexAI = getAI(app, {
    backend: new VertexAIBackend('us-central1')
});

async function testModel(modelId) {
    console.log(`Testing model: ${modelId}...`);
    try {
        const model = getGenerativeModel(vertexAI, { model: modelId });
        const result = await model.generateContent("Hi");
        console.log(`✅ ${modelId} worked! Response:`, result.response.text());
        return true;
    } catch (e) {
        console.error(`❌ ${modelId} failed:`, e.message);
        return false;
    }
}

async function run() {
    const models = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-3-pro-preview',
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
        'gemini-3.1-flash-preview'
    ];
    for (const model of models) {
        await testModel(model);
    }
    process.exit(0);
}

run();
