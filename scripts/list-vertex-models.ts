
import { GoogleAuth } from "google-auth-library";
import { config } from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../.env") });

async function listModels() {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const projectId = process.env.VITE_VERTEX_PROJECT_ID || "indiios-v-1-1";
    const location = "us-central1";
    const accessToken = await client.getAccessToken();

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1beta/projects/${projectId}/locations/${location}/publishers/google/models`;

    console.log(`Checking models at: ${endpoint}`);
    const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${accessToken.token}` }
    });

    if (res.ok) {
        const data = await res.json();
        console.log("Models found:", JSON.stringify(data, null, 2));
    } else {
        console.log("Error listing models:", res.status, await res.text());
    }
}

listModels();
