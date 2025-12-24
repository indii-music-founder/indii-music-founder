// Load environment variables BEFORE other imports
import * as dotenv from 'dotenv';
dotenv.config();

// Mock Proxy URL if missing for test
if (!process.env.VITE_FUNCTIONS_URL) {
    process.env.VITE_FUNCTIONS_URL = 'https://us-central1-indiios-v-1-1.cloudfunctions.net';
    console.log("⚠️ VITE_FUNCTIONS_URL missing, using live: https://us-central1-indiios-v-1-1.cloudfunctions.net");
}
if (!process.env.VITE_RAG_PROXY_URL) {
    process.env.VITE_RAG_PROXY_URL = 'http://localhost:3000';
}

// Dynamic import to ensure env vars are loaded
const { GeminiRetrievalService } = await import('../src/services/rag/GeminiRetrievalService.ts');

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
    console.log("🎵 Starting Music Business RAG Test (Files API)...");
    const apiKey = process.env.VITE_API_KEY;
    if (!apiKey) {
        console.error("❌ Missing VITE_API_KEY in .env");
        return;
    }
    const GeminiRetrieval = new GeminiRetrievalService(apiKey);

    try {
        console.log("1. Preparing Knowledge Base...");
        const combinedContent = MOCK_DOCS.map(d => `--- Document: ${d.name} ---\n${d.content}\n`).join("\n");
        const kbName = `Music_Biz_KB_${Date.now()}.txt`;

        console.log("2. Uploading File to Gemini...");
        const file = await GeminiRetrieval.uploadFile(kbName, combinedContent);
        console.log(`   ✅ File Uploaded: ${file.name} (URI: ${file.uri})`);
        console.log(`   State: ${file.state}`);

        // 3. Run Queries
        console.log("3. Running Queries (Long Context)...");

        const queries = [
            "What is the royalty rate in the recording agreement?",
            "What is the total marketing budget for Q1?",
            "Explain the difference between mechanical and performance royalties."
        ];

        for (const q of queries) {
            console.log(`\n❓ Q: ${q}`);
            try {
                // const canonicalUri = `https://generativelanguage.googleapis.com/${file.name}`;
                const result = await GeminiRetrieval.query(file.uri, q);
                // Result structure: { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
                const answer = result.candidates?.[0]?.content?.parts?.[0]?.text;

                if (answer) {
                    console.log(`💡 A: ${answer.trim()}`);
                } else {
                    console.warn("   ⚠️ No answer returned:", JSON.stringify(result));
                }
            } catch (e: any) {
                console.error(`   ❌ Query failed: ${e.message}`);
            }
        }

        console.log("\n4. Cleanup...");
        await GeminiRetrieval.deleteFile(file.name);
        console.log("   ✅ File deleted.");

    } catch (error) {
        console.error("❌ Test FAILED with error:", error);
    }
}

runTest();

