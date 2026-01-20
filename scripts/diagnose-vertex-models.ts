
import { VertexAI } from '@google-cloud/vertexai';
import * as dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config();

// Attempt to load from functions .env as well if needed
dotenv.config({ path: 'functions/.env' });

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'indiios-v-1-1';
const MODELS_TO_TEST = [
    'gemini-3.0-pro-image',
    'gemini-3.0-pro-image-001',
    'gemini-3.0-pro-image-preview',
    'gemini-3.0-generate-001',
    'gemini-3-pro-image-preview', // User's original 
    'imagen-3.0-generate-001'
];

async function diagnose() {
    console.log(`Diagnosing Vertex AI Models`);
    console.log(`Project: ${PROJECT_ID}`);

    const regions = ['us-central1', 'us-east4', 'us-west1', 'europe-west4'];

    for (const modelId of MODELS_TO_TEST) {
        console.log(`\n=========================================`);
        console.log(`TESTING MODEL: ${modelId}`);
        console.log(`=========================================`);

        for (const location of regions) {
            console.log(`\n--- Checking Region: ${location} ---`);
            try {
                const vertexAI = new VertexAI({ project: PROJECT_ID, location });
                const model = vertexAI.getGenerativeModel({ model: modelId });

                console.log(`Attempting generation with ${modelId} in ${location}...`);

                try {
                    const result = await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: 'Test prompt' }] }],
                        generationConfig: {
                            // Only use responseModalities for the newer models if needed, 
                            // but for diagnosis we can be looser or try-catch it
                            // responseModalities: ["IMAGE"], 
                        }
                    });
                    console.log(`✅ SUCCESS in ${location}! Model ${modelId} found.`);
                    // console.log(JSON.stringify(result, null, 2));
                } catch (genError: any) {
                    if (genError.message && genError.message.includes('404')) {
                        console.log(`❌ 404 Not Found in ${location}`);
                    } else {
                        console.log(`⚠️ Error in ${location} (but likely found):`, genError.message);
                        // Access denied 403 or 400 bad request means the model IS found but we used it wrong.
                        // This counts as "found" for our 404 hunt.
                        if (genError.message.includes('Publisher Model') && genError.message.includes('not found')) {
                            console.log(`   -> DEFINITELY NOT FOUND by Vertex.`);
                        } else {
                            console.log(`   -> FOUND (but failed generation). This is good!`);
                        }
                    }
                }
            } catch (error: any) {
                console.error(`Error initializing/calling ${location}:`, error.message);
            }
        }
    }

    console.log('\n--- Diagnosis Complete ---');
}

diagnose().catch(console.error);
