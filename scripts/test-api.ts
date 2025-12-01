import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

// This SDK might not support Semantic Retriever directly yet?
// Let's check if there is a specific package for it.
// The user has @ai-sdk/google and @google/generative-ai.

// Actually, the Semantic Retriever API is often accessed via REST or a specific alpha/beta SDK.
// Let's try to use the REST API but with a different endpoint structure?

// Wait, looking at Google's docs:
// https://ai.google.dev/gemini-api/docs/semantic-retriever
// It says:
// POST https://generativelanguage.googleapis.com/v1beta/corpora
// POST https://generativelanguage.googleapis.com/v1beta/corpora/NAME/documents

// Maybe I should try to use the `key` query param ONLY?
// I tried that before.

// Let's try to use the `GoogleAIFileManager` just to see if it works for files?
// No, that's irrelevant.

// Let's try to use the `fetch` but with `v1` instead of `v1beta`?
async function test() {
    const apiKey = process.env.VITE_API_KEY;
    if (!apiKey) throw new Error("No API Key");

    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // 1. List Corpora
    console.log("Listing corpora...");
    const listRes = await fetch(`${baseUrl}/corpora?key=${apiKey}`);
    const list = await listRes.json();
    console.log("Corpora:", list);

    if (!list.corpora || list.corpora.length === 0) {
        console.log("No corpora found.");
        return;
    }

    const corpus = list.corpora[0];
    console.log("Using corpus:", corpus.name);

    // 2. List Documents with double corpora prefix?
    // corpus.name is "corpora/ID"
    // URL pattern is "corpora/{corpus}/documents"
    // Maybe {corpus} should be the full name?
    // Let's try appending corpus.name to baseUrl directly?
    // baseUrl is .../v1beta
    // url = .../v1beta/corpora/ID/documents (This is what I tried and failed)

    // Let's try: .../v1beta/corpora/corpora/ID/documents?
    const doubleUrl = `${baseUrl}/corpora/${corpus.name}/documents?key=${apiKey}`;
    console.log(`Listing documents for ${doubleUrl}...`);
    const docsRes = await fetch(doubleUrl);

    if (!docsRes.ok) {
        console.error("Failed to list documents:", docsRes.status, docsRes.statusText);
        console.error(await docsRes.text());
    } else {
        const docs = await docsRes.json();
        console.log("Documents:", docs);
    }
}

test();
