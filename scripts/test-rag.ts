
import { GeminiRetrievalService } from '../src/services/rag/GeminiRetrievalService';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runTest() {
    console.log("Starting RAG Service Test...");
    const apiKey = process.env.VITE_API_KEY;
    if (!apiKey) {
        console.error("❌ Missing VITE_API_KEY in .env");
        return;
    }
    const GeminiRetrieval = new GeminiRetrievalService(apiKey);

    try {
        // 0. Cleanup old test corpora
        console.log("0. Cleaning up old test corpora...");
        const list = await GeminiRetrieval.listCorpora();
        if (list.corpora) {
            for (const c of list.corpora) {
                if (c.displayName.startsWith("Test Corpus")) {
                    console.log(`   Deleting ${c.displayName} (${c.name})...`);
                    await GeminiRetrieval.deleteCorpus(c.name);
                }
            }
        }

        // 1. Init Corpus
        const uniqueCorpusName = `Test Corpus ${Date.now()}`;
        console.log(`1. Initializing Corpus '${uniqueCorpusName}'...`);
        const corpusName = await GeminiRetrieval.initCorpus(uniqueCorpusName);
        console.log("   Corpus Name:", corpusName);

        // Wait for propagation
        console.log("   Waiting 5s for propagation...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Debug: List documents first
        console.log("   Listing documents...");
        try {
            const docs = await GeminiRetrieval.listDocuments(corpusName);
            console.log("   Documents found:", docs.documents?.length || 0);
        } catch (e) {
            console.error("   ❌ Failed to list documents:", e);
        }

        // 2. Create Document
        const docName = `test-doc-${Date.now()}`;
        console.log("2. Creating Document:", docName);
        const doc = await GeminiRetrieval.createDocument(corpusName, docName, { source: 'test-script' });
        console.log("   Document Created:", doc.name);

        // 3. Ingest Text
        const text = "The quick brown fox jumps over the lazy dog. This is a test document for the RAG system. It should be able to retrieve this information.";
        console.log("3. Ingesting Text...");
        await GeminiRetrieval.ingestText(doc.name, text);
        console.log("   Text Ingested.");

        // 4. Query
        console.log("4. Querying...");
        const query = "What does the fox do?";
        const result = await GeminiRetrieval.query(corpusName, query);
        const answer = result.answer?.content?.parts?.[0]?.text;
        console.log("   Query:", query);
        console.log("   Answer:", answer);

        if (answer && answer.toLowerCase().includes("jumps")) {
            console.log("✅ Test PASSED");
        } else {
            console.error("❌ Test FAILED: Unexpected answer");
        }

        // Cleanup (Optional - maybe keep for inspection)
        // await GeminiRetrieval.deleteDocument(doc.name);

    } catch (error) {
        console.error("❌ Test FAILED with error:", error);
    }
}

runTest();
