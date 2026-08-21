
import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

async function listModels() {
    const projectId = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'indii-music-founder';
    const location = process.env.VERTEX_LOCATION || 'global';

    console.log(`🔍 Diagnosing Vertex AI Models for Project: ${projectId} in ${location}`);

    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // Test v1beta1 publisher models
    const baseUrl = location === 'global' || location === 'us' || location === 'eu'
        ? 'https://aiplatform.googleapis.com'
        : `https://${location}-aiplatform.googleapis.com`;
    const endpoint = `${baseUrl}/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models`;

    console.log(`\n📡 Fetching Publisher Models from: ${endpoint}`);

    try {
        const response = await fetch(endpoint, {
            signal: AbortSignal.timeout(30000),
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
        const target = geminiModels.find((m: any) => m.name.includes('gemini-3-pro-image'));
        if (target) {
            console.log("\n🎉 TARGET ACQUIRED: gemini-3-pro-image is available!");
            console.log("Details:", target);
        } else {
            console.error("\n❌ TARGET MISSING: gemini-3-pro-image was NOT found in this list.");
        }

    } catch (error) {
        console.error("💥 Script failed:", error);
    }
}

listModels();
