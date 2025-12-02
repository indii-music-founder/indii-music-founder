
import { GeminiRetrievalService } from '../src/services/rag/GeminiRetrievalService';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function diagnose() {
    console.log("🩺 Starting API Diagnosis...");
    const apiKey = process.env.VITE_API_KEY;

    if (!apiKey) {
        console.error("❌ Missing VITE_API_KEY");
        return;
    }
    console.log(`🔑 API Key found: ${apiKey.substring(0, 8)}...`);

    const GeminiRetrieval = new GeminiRetrievalService(apiKey);

    try {
        // 1. Check List Corpora (Read Access)
        console.log("\n1. Checking Read Access (List Corpora)...");
        const list = await GeminiRetrieval.listCorpora();
        console.log("✅ Success! API is connected.");
        console.log(`   Found ${list.corpora?.length || 0} corpora.`);

        if (list.corpora && list.corpora.length > 0) {
            console.log("   Existing Corpora:");
            list.corpora.forEach(c => console.log(`   - ${c.displayName} (${c.name})`));

            // 2. Check Document Access on First Corpus
            const firstCorpus = list.corpora[0];
            console.log(`\n2. Checking Document Access on '${firstCorpus.displayName}'...`);
            try {
                const docs = await GeminiRetrieval.listDocuments(firstCorpus.name);
                console.log(`✅ Success! Can read documents.`);
                console.log(`   Found ${docs.documents?.length || 0} documents.`);
            } catch (e: any) {
                console.error(`❌ Failed to read documents: ${e.message}`);
            }
        } else {
            console.log("\n⚠️ No corpora found to test document access.");
        }

    } catch (error: any) {
        console.error("❌ API Connection Failed:", error.message);
        if (error.message.includes("403")) {
            console.log("   -> API Key is invalid or lacks permissions.");
        }
    }
}

diagnose();
