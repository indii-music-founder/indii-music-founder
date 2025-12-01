import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Read API Key
const envPath = path.resolve(process.cwd(), '.env');
let apiKey = process.env.VITE_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const match = envConfig.match(/VITE_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
    }
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

class GeminiRetrievalService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    public async fetch(endpoint: string, options: RequestInit = {}) {
        const url = `${BASE_URL}/${endpoint}?key=${this.apiKey}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey,
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
    }

    async listCorpora() {
        return this.fetch('corpora');
    }

    async deleteCorpus(corpusName: string) {
        return this.fetch(corpusName, { method: 'DELETE' });
    }
}

const GeminiRetrieval = new GeminiRetrievalService(apiKey!);

async function cleanup() {
    console.log("🧹 Starting Corpus Cleanup...");
    try {
        const list = await GeminiRetrieval.listCorpora();
        // @ts-ignore
        const corpora = list.corpora || [];
        console.log(`Found ${corpora.length} corpora.`);

        for (const c of corpora) {
            if (c.displayName.includes("Stress Test")) {
                console.log(`Deleting: ${c.displayName} (${c.name})...`);
                await GeminiRetrieval.deleteCorpus(c.name);
                console.log("   Deleted.");
            } else {
                console.log(`Skipping: ${c.displayName} (${c.name})`);
            }
        }
        console.log("✅ Cleanup complete.");
    } catch (e) {
        console.error("Cleanup failed:", e);
    }
}

cleanup();
