import dotenv from 'dotenv';
import { GeminiRetrievalService } from '../src/services/rag/GeminiRetrievalService.ts';

// Mock import.meta.env for the service file if it tries to access it
global.import = { meta: { env: {} } };

dotenv.config();

const API_KEY = process.env.VITE_API_KEY;

if (!API_KEY) {
    console.error("❌ VITE_API_KEY not found in .env");
    process.exit(1);
}

async function runTest() {
    console.log("🚀 Starting Gemini RAG Verification...");

    // 1. Initialize Service
    const service = new GeminiRetrievalService(API_KEY);

    try {
        // 2. Create Test Corpus
        console.log("Creating Test Corpus...");
        const corpus = await service.createCorpus("indii Test Corpus " + Date.now());
        console.log("✅ Corpus Created:", corpus.name);

        console.log("Waiting 10s for corpus propagation...");
        await new Promise(r => setTimeout(r, 10000));

        // Verify existence
        const list = await service.listCorpora();
        const found = list.corpora?.find(c => c.name === corpus.name);
        if (found) {
            console.log("✅ Corpus found in list:", found.name);
        } else {
            console.warn("⚠️ Corpus NOT found in list yet.");
        }

        // 3. Create Document
        console.log("Creating Document...");
        const doc = await service.createDocument(corpus.name, "Secret Fact");
        console.log("✅ Document Created:", doc.name);

        // 4. Ingest Data
        console.log("Ingesting Text...");
        const secretFact = "The secret code for the indii vault is 'BlueBanana42'.";
        await service.ingestText(doc.name, secretFact);
        console.log("✅ Text Ingested.");

        // Wait a moment for indexing
        console.log("Waiting 5s for indexing...");
        await new Promise(r => setTimeout(r, 5000));

        // 5. Query
        console.log("Querying...");
        const response = await service.query(corpus.name, "What is the secret code for the vault?");
        const answer = response.answer?.content?.parts?.[0]?.text;

        console.log("------------------------------------------------");
        console.log("🤖 Question: What is the secret code for the vault?");
        console.log("🤖 Answer:", answer);
        console.log("------------------------------------------------");

        if (answer && answer.includes("BlueBanana42")) {
            console.log("✅ VERIFICATION SUCCESS: RAG retrieved the secret!");
        } else {
            console.error("❌ VERIFICATION FAILED: Answer did not contain the secret.");
        }

        // 6. Cleanup
        console.log("Cleaning up...");
        await service.deleteDocument(doc.name);
        await service.deleteCorpus(corpus.name);
        console.log("✅ Cleanup Complete.");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

runTest();
