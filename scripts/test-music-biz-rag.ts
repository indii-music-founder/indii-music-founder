// Load environment variables BEFORE other imports
import * as dotenv from 'dotenv';
dotenv.config();

// Mock Proxy URL if missing for test
if (!process.env.VITE_FUNCTIONS_URL) {
    process.env.VITE_FUNCTIONS_URL = 'http://localhost:5001/rndr-ai-v1/us-central1';
    console.log("⚠️ VITE_FUNCTIONS_URL missing, using mock: http://localhost:5001/rndr-ai-v1/us-central1");
}
if (!process.env.VITE_RAG_PROXY_URL) {
    process.env.VITE_RAG_PROXY_URL = 'http://localhost:3000';
}

// Dynamic import to ensure env vars are loaded
const { GeminiRetrievalService } = await import('../src/services/rag/GeminiRetrievalService');

const MOCK_DOCS = [
    {
        name: "Recording_Agreement_2025.txt",
        content: `
STANDARD EXCLUSIVE RECORDING AGREEMENT

This Agreement is made as of January 1, 2025, between Future Sound Records ("Company") and The Artist ("Artist").

1. TERM
The term of this agreement shall be for an initial period of one (1) year, with three (3) separate options to extend for additional one-year periods.

2. ADVANCES
Company shall pay Artist an advance of Fifty Thousand Dollars ($50,000) upon execution of this agreement. For each option period, the advance shall be Seventy-Five Thousand Dollars ($75,000).

3. ROYALTIES
Company shall pay Artist a royalty of eighteen percent (18%) of the Suggested Retail List Price (SRLP) for all records sold and paid for in the United States. For foreign sales, the royalty rate shall be 50% of the U.S. rate.

4. TERRITORY
The territory of this agreement shall be the Universe.
`
    },
    {
        name: "Marketing_Plan_Q1_2025.txt",
        content: `
Q1 2025 MARKETING STRATEGY - "NEON HORIZONS" ALBUM

OVERVIEW
The goal is to drive 1M streams in the first week.

BUDGET
Total Budget: $150,000
- Digital Ads (Meta/TikTok): $50,000
- Spotify Marquee: $25,000
- Influencer Campaign: $40,000
- PR & Radio: $20,000
- Content Creation: $15,000

TARGET DEMOGRAPHICS
- Age: 18-34
- Interests: Synthwave, Indie Pop, Festivals
- Key Markets: Los Angeles, London, Tokyo, Berlin

KEY DATES
- Jan 15: Single 1 Release ("Night Drive")
- Feb 14: Single 2 Release ("Heartbeat")
- Mar 01: Full Album Drop
`
    },
    {
        name: "Royalty_Guide_101.txt",
        content: `
MUSICIAN'S GUIDE TO ROYALTIES

1. MECHANICAL ROYALTIES
These are paid to songwriters whenever a copy of their song is made (e.g., streamed, downloaded, or manufactured on CD/Vinyl). In the US, the statutory rate is set by the CRB.

2. PERFORMANCE ROYALTIES
These are paid when a song is performed publicly. This includes radio airplay, streaming (Spotify, Apple Music), live venues, and restaurants. These are collected by PROs like ASCAP, BMI, and SESAC.

3. SOUND RECORDING ROYALTIES
These are paid to the master rights holder (usually the label) and the performing artist. For digital performance (like Pandora or SiriusXM), these are collected by SoundExchange.
`
    }
];

async function runTest() {
    console.log("🎵 Starting Music Business RAG Test...");
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
                if (c.displayName.startsWith("Music Biz Test")) {
                    console.log(`   Deleting ${c.displayName} (${c.name})...`);
                    await GeminiRetrieval.deleteCorpus(c.name);
                }
            }
        }

        // 1. Init Corpus
        const corpusName = await GeminiRetrieval.initCorpus(`Music Biz Test ${Date.now()}`);
        console.log(`1. Initialized Corpus: ${corpusName}`);

        // Helper for reliable waiting
        const waitForPropagation = async (attempt: number) => {
            console.log(`   Waiting for propagation (Attempt ${attempt})...`);
            // Exponential backoff: 2s, 4s, 8s...
            const waitTime = Math.min(2000 * Math.pow(2, attempt), 10000);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        };

        // 2. Ingest Documents with Retry
        console.log("2. Ingesting Documents...");
        for (const doc of MOCK_DOCS) {
            console.log(`   Processing: ${doc.name}...`);
            let retries = 0;
            let success = false;

            while (!success && retries < 5) {
                try {
                    const d = await GeminiRetrieval.createDocument(corpusName, doc.name, { source: 'script' });
                    await GeminiRetrieval.ingestText(d.name, doc.content);
                    success = true;
                } catch (e: any) {
                    if (e.message?.includes('404') || e.message?.includes('429')) {
                        console.warn(`   ⚠️ Error initializing document (404/429). Retrying...`);
                        await waitForPropagation(retries);
                        retries++;
                    } else {
                        throw e; // Fatal error
                    }
                }
            }
            if (!success) {
                console.error(`   ❌ Failed to ingest ${doc.name} after 5 retries.`);
            }
        }
        console.log("   All documents ingested.");

        // Wait for final index propagation
        console.log("   Waiting for final index propagation...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 3. Run Queries with Retry
        console.log("3. Running Queries...");

        const queries = [
            "What is the royalty rate in the recording agreement?",
            "What is the total marketing budget for Q1?",
            "Explain the difference between mechanical and performance royalties."
        ];

        for (const q of queries) {
            console.log(`\n❓ Q: ${q}`);
            let queryRetries = 0;
            let querySuccess = false;

            while (!querySuccess && queryRetries < 3) {
                try {
                    const result = await GeminiRetrieval.query(corpusName, q);
                    const answer = result.answer?.content?.parts?.[0]?.text;
                    console.log(`💡 A: ${answer}`);

                    if (result.answer?.groundingAttributions?.length) {
                        console.log("   📚 Sources:");
                        result.answer.groundingAttributions.forEach((attr: any) => {
                            console.log(`      - ${attr.sourceId} (Confidence: ${attr.content?.parts?.[0]?.text})`);
                        });
                    }
                    querySuccess = true;
                } catch (e: any) {
                    if (e.message?.includes('404') || e.message?.includes('429')) {
                        console.warn(`   ⚠️ Query failed (404/429). Retrying...`);
                        await waitForPropagation(queryRetries);
                        queryRetries++;
                    } else {
                        console.error(`   ❌ Query failed fatal: ${e}`);
                        break;
                    }
                }
            }
        }

    } catch (error) {
        console.error("❌ Test FAILED with error:", error);
    }
}

runTest();
