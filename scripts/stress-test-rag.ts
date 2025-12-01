import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Read API Key from .env manually if dotenv doesn't pick it up
const envPath = path.resolve(process.cwd(), '.env');
let apiKey = process.env.VITE_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const match = envConfig.match(/VITE_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
    }
}

if (!apiKey) {
    console.error("❌ No VITE_API_KEY found in .env or process.env");
    process.exit(1);
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

class GeminiRetrievalService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    public async fetch(endpoint: string, options: RequestInit = {}) {
        const proxyUrl = process.env.VITE_RAG_PROXY_URL;
        let url: string;

        if (proxyUrl) {
            url = `${proxyUrl}/v1beta/${endpoint}`;
        } else {
            url = `${BASE_URL}/${endpoint}?key=${this.apiKey}`;
        }

        // console.log(`DEBUG: Fetching ${url} [${options.method || 'GET'}]`);
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        // ...

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error (${endpoint}): ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
    }

    async createCorpus(displayName: string = "indiiOS Knowledge Base") {
        return this.fetch('corpora', {
            method: 'POST',
            body: JSON.stringify({ displayName })
        });
    }

    async listCorpora() {
        return this.fetch('corpora');
    }

    async initCorpus() {
        const list = await this.listCorpora();
        // @ts-ignore
        const existing = list.corpora?.find(c => c.displayName === "indiiOS Knowledge Base");

        if (existing) {
            return existing.name;
        }

        const newCorpus = await this.createCorpus();
        // @ts-ignore
        return newCorpus.name;
    }

    async listDocuments(corpusName: string) {
        return this.fetch(`${corpusName}/documents`);
    }

    async createDocument(corpusName: string, displayName: string, metadata?: Record<string, unknown>) {
        const body: any = { displayName };
        if (metadata) {
            body.customMetadata = Object.entries(metadata).map(([key, value]) => ({ key, stringValue: String(value) }));
        }

        return this.fetch(`${corpusName}/documents`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    async ingestText(documentName: string, text: string, chunkSize: number = 500) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push({
                data: { stringValue: text.substring(i, i + chunkSize) }
            });
        }

        const BATCH_SIZE = 100;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            await this.fetch(`${documentName}/chunks:batchCreate`, {
                method: 'POST',
                body: JSON.stringify({ requests: batch.map(c => ({ chunk: c })) })
            });
        }
    }

    async deleteDocument(documentName: string) {
        return this.fetch(documentName, { method: 'DELETE' });
    }

    async deleteCorpus(corpusName: string) {
        return this.fetch(corpusName, { method: 'DELETE' });
    }

    async query(corpusName: string, userQuery: string) {
        return this.fetch('models/aqa:generateAnswer', {
            method: 'POST',
            body: JSON.stringify({
                content: { parts: [{ text: userQuery }] },
                semanticRetrievalSource: {
                    source: corpusName,
                    query: { text: userQuery }
                }
            })
        });
    }
}

const GeminiRetrieval = new GeminiRetrievalService(apiKey);

async function runStressTest() {
    console.log("🚀 Starting RAG Stress Test (Node.js)...");

    try {
        // 1. Create 5 dummy documents in parallel
        const dummyDocs = Array.from({ length: 5 }).map((_, i) => ({
            name: `stress-test-node-${Date.now()}-${i}.txt`,
            content: `This is stress test document #${i}. The secret code for #${i} is OMEGA-${i}-${Math.random().toString(36).substring(7)}.`
        }));

        console.log("📥 Ingesting 5 documents...");
        console.time("Stress Test Ingestion");

        // Create a dedicated corpus for the test
        const testCorpusName = `indiiOS Stress Test ${Date.now()}`;
        const corpus = await GeminiRetrieval.createCorpus(testCorpusName);
        console.log("   DEBUG: createCorpus response:", JSON.stringify(corpus, null, 2));

        const corpusName = corpus.name; // e.g. corpora/12345
        console.log(`   Created Test Corpus: ${corpusName} (${testCorpusName})`);

        console.log("   Waiting 5s for propagation...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log("   DEBUG: Listing all corpora to verify existence...");
        const list = await GeminiRetrieval.listCorpora();
        // @ts-ignore
        const found = list.corpora?.find(c => c.name === corpusName);
        console.log("   DEBUG: Found in list?", !!found);

        console.log("   DEBUG: Fetching corpus details directly...");
        try {
            // @ts-ignore
            const details = await GeminiRetrieval.fetch(corpusName);
            console.log("   DEBUG: Corpus details:", JSON.stringify(details, null, 2));
        } catch (e) {
            console.error("   DEBUG: Failed to fetch corpus details:", e);
        }

        console.log("   DEBUG: Listing documents...");
        try {
            const docs = await GeminiRetrieval.listDocuments(corpusName);
            console.log("   DEBUG: Documents list:", JSON.stringify(docs, null, 2));
        } catch (e) {
            console.error("   DEBUG: Failed to list documents:", e);
        }

        await Promise.all(dummyDocs.map(async (doc) => {
            const d = await GeminiRetrieval.createDocument(corpusName, doc.name);
            await GeminiRetrieval.ingestText(d.name, doc.content);
            return { ...doc, resourceName: d.name };
        })).then(docs => {
            // 2. Query them in parallel
            console.timeEnd("Stress Test Ingestion");
            console.log("🔍 Querying 5 documents...");
            console.time("Stress Test Query");

            return Promise.all(docs.map(async (doc, i) => {
                const result = await GeminiRetrieval.query(corpusName, `What is the secret code for document #${i}?`);
                // @ts-ignore
                const answer = result.answer?.content?.parts?.[0]?.text || 'No answer';
                return { doc: i, answer, expected: doc.content };
            })).then(async results => {
                console.timeEnd("Stress Test Query");
                console.log("\n📊 Results:");
                results.forEach(r => {
                    console.log(`   Doc #${r.doc}: ${r.answer}`);
                });

                // Cleanup
                console.log("\n🧹 Cleaning up test corpus...");
                await GeminiRetrieval.deleteCorpus(corpusName);
                console.log("✅ Cleanup complete.");
            });
        });

    } catch (error) {
        console.error("❌ Stress Test Failed:", error);
    }
}

runStressTest();
