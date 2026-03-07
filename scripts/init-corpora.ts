
import { config } from 'dotenv';
config();

const API_KEY = process.env.VITE_API_KEY;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const corpora = [
    'royalties',
    'deals',
    'publishing',
    'licensing',
    'contracts',
    'touring',
    'marketing',
    'finance',
    'merchandise',
    'production',
    'visual',
    'career'
];

async function main() {
    if (!API_KEY) {
        console.error("VITE_API_KEY is missing in .env");
        process.exit(1);
    }

    console.log("🚀 Initializing 12 File Search Corpora (Direct API)...");
    console.log("=====================================================");

    // 1. Get existing stores first to avoid listing in the loop
    let existingStores: any[] = [];
    try {
        const listRes = await fetch(`${BASE_URL}/fileSearchStores?key=${API_KEY}`);
        if (!listRes.ok) {
            throw new Error(`List failed: ${listRes.status} ${await listRes.text()}`);
        }
        const listData = await listRes.json() as any;
        existingStores = listData.fileSearchStores || [];
        console.log(`✓ Found ${existingStores.length} existing stores.`);
    } catch (e: any) {
        console.warn("⚠️  Could not list existing stores, will attempt create for all:", e.message);
    }

    for (const corpus of corpora) {
        const displayName = `indiiOS Store - ${corpus}`;

        try {
            const match = existingStores.find((s: any) => s.displayName === displayName);

            if (match) {
                console.log(`✓ Corpus exists:  ${corpus.padEnd(12)} -> ${match.name}`);
                continue;
            }

            // Create if not found
            const createRes = await fetch(`${BASE_URL}/fileSearchStores?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName })
            });

            if (!createRes.ok) {
                const err = await createRes.text();
                // If it already exists but we didn't find it in the list (e.g. pagination)
                if (err.includes("already exists")) {
                    console.log(`✓ Corpus exists*: ${corpus.padEnd(12)} -> (matched by error)`);
                    continue;
                }
                throw new Error(`Create failed: ${createRes.status} ${err}`);
            }

            const newData = await createRes.json() as any;
            console.log(`✓ Corpus created: ${corpus.padEnd(12)} -> ${newData.name}`);

        } catch (e: any) {
            console.error(`✕ Failed:         ${corpus.padEnd(12)} -> ${e.message}`);
        }
    }
    console.log("\n✨ All corpora processing complete.");
}

main().catch(console.error);
