import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Note: The official SDK might not support Semantic Retriever fully yet, 
// or it might be under a different namespace.
// But let's check if we can access it.

// Actually, for Semantic Retriever, we often use `GoogleAIFileManager` for files, 
// but for Corpora/Documents, it's usually via `retriever` or similar.

// Let's try to use the `GoogleAIFileManager` just to see if it's related?
// No.

// Let's try to use the raw fetch but with a different base URL?
// Maybe `https://generativelanguage.googleapis.com/v1beta/corpora` is wrong?

// What if I try to use the `File API` instead?
// No, the user wants RAG with Corpora.

// Let's try to use the `google-auth-library` to get an access token and use that instead of API key?
// Maybe the API key is not enough for Semantic Retriever data operations?
// But docs say API key is fine.

// Let's try one more URL variation:
// `https://generativelanguage.googleapis.com/v1beta/corpora/NAME`
// I already tried that.

// Let's try to create a NEW corpus with `users/me/corpora` as parent?
// POST https://generativelanguage.googleapis.com/v1beta/users/me/corpora

async function test() {
    const apiKey = process.env.VITE_API_KEY;
    if (!apiKey) throw new Error("No API Key");

    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    console.log("Creating corpus under users/me...");
    const createRes = await fetch(`${baseUrl}/users/me/corpora?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: "User Scoped Corpus" })
    });

    if (!createRes.ok) {
        console.error("Failed to create corpus:", createRes.status, createRes.statusText);
        console.error(await createRes.text());
    } else {
        const corpus = await createRes.json();
        console.log("Created corpus:", corpus);

        // Now try to list documents for THIS corpus
        const corpusName = corpus.name; // likely starts with corpora/
        console.log(`Listing documents for ${corpusName}...`);

        // Try both URL forms
        const url1 = `${baseUrl}/${corpusName}/documents?key=${apiKey}`;
        console.log("Trying:", url1);
        const res1 = await fetch(url1);
        if (res1.ok) console.log("Success URL1"); else console.log("Failed URL1:", res1.status);

        // Try with users/me prefix if not already present
        if (!corpusName.startsWith('users/')) {
            const id = corpusName.split('/')[1];
            const url2 = `${baseUrl}/users/me/corpora/${id}/documents?key=${apiKey}`;
            console.log("Trying:", url2);
            const res2 = await fetch(url2);
            if (res2.ok) console.log("Success URL2"); else console.log("Failed URL2:", res2.status);
        }

        // Cleanup
        console.log("Deleting corpus...");
        await fetch(`${baseUrl}/${corpusName}?key=${apiKey}`, { method: 'DELETE' });
    }
}

test();
