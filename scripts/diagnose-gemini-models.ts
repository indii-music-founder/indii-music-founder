
import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

async function listModels() {
    const projectId = process.env.VITE_PROJECT_ID || process.env.VITE_VERTEX_PROJECT_ID || 'indiios-v-1-1';
    const location = 'us-central1'; // We'll test this first

    console.log(`🔍 Diagnosing Vertex AI Models for Project: ${projectId} in ${location}`);

    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // Test v1beta1 publisher models
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models`;

    console.log(`\n📡 Fetching Publisher Models from: ${endpoint}`);

    try {
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${accessToken.token}`
            }
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`❌ API Error (${response.status}):`, text);
            return;
        }

        const data = await response.json();

        if (!data.publisherModels) {
            console.log("⚠️ No publisher models found in response.");
            return;
        }

        console.log(`✅ Found ${data.publisherModels.length} models.`);

        // Filter for Gemini
        const geminiModels = data.publisherModels.filter((m: any) =>
            m.name.toLowerCase().includes('gemini') ||
            m.name.toLowerCase().includes('imagen')
        );

        console.log("\n📋 Available Gemini/Imagen Models:");
        geminiModels.forEach((m: any) => {
            const modelId = m.name.split('/').pop();
            console.log(`- ${modelId} (${m.versionId})`);
        });

        // Specifically check for our target
        const target = geminiModels.find((m: any) => m.name.includes('gemini-3-pro-image-preview'));
        if (target) {
            console.log("\n🎉 TARGET ACQUIRED: gemini-3-pro-image-preview is available!");
            console.log("Full Name:", target.name);
        } else {
            console.error("\n❌ TARGET MISSING: gemini-3-pro-image-preview was NOT found in this list.");
        }

    } catch (error) {
        console.error("💥 Script failed:", error);
    }
}

listModels();
