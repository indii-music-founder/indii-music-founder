
import { config } from 'dotenv';
import { resolve, join, basename } from 'path';
import { readdir, stat, readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import fs from 'fs';

config();

const API_KEY = process.env.VITE_API_KEY;
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const SYNC_STATE_FILE = resolve('.rag-sync-state.json');

// Mapping between directories/files and corpus names
const CORPUS_MAP: Record<string, string> = {
    'career': 'career',
    'contracts': 'contracts',
    'finance': 'finance',
    'licensing': 'licensing',
    'marketing': 'marketing',
    'production': 'production',
    'publishing': 'publishing',
    'recording-deals': 'deals',
    'touring': 'touring',
    'visual-creative': 'visual',
    'merchandise.md': 'merchandise'
};

type SyncState = Record<string, { hash: string, fileId: string }>;
let syncState: SyncState = {};

async function loadSyncState() {
    try {
        if (fs.existsSync(SYNC_STATE_FILE)) {
            const data = await readFile(SYNC_STATE_FILE, 'utf-8');
            syncState = JSON.parse(data);
        }
    } catch (e) {
        console.warn("⚠️ Could not load sync state, starting fresh.");
    }
}

async function saveSyncState() {
    await writeFile(SYNC_STATE_FILE, JSON.stringify(syncState, null, 2));
}

function computeHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
}

async function main() {
    if (!API_KEY) {
        console.error("VITE_API_KEY is missing in .env");
        process.exit(1);
    }

    await loadSyncState();

    const kbPath = resolve('docs/knowledge-base');
    console.log(`🚀 Starting Bulk RAG Ingestion for ${kbPath}...`);
    console.log("===============================================");

    // 1. Get all stores with pagination
    const stores = await listAllStores();
    console.log(`✓ Found ${stores.length} total stores in Gemini.`);

    const storeMap: Record<string, string> = {};
    for (const s of stores) {
        const match = s.displayName.match(/indiiOS Store - (.*)/);
        if (match) {
            storeMap[match[1]] = s.name;
        }
    }

    // 2. Scan knowledge-base directory
    const entries = await readdir(kbPath);

    for (const entry of entries) {
        const fullPath = join(kbPath, entry);
        const s = await stat(fullPath);

        if (s.isDirectory()) {
            const corpusName = CORPUS_MAP[entry.toLowerCase()];
            if (corpusName && storeMap[corpusName]) {
                await ingestDirectory(fullPath, storeMap[corpusName], corpusName);
            } else {
                console.warn(`⚠️  No corpus mapping or store found for directory: "${entry}" (Mapped: ${corpusName}, Store: ${!!storeMap[corpusName]})`);
            }
        } else if (s.isFile() && entry.endsWith('.md')) {
            const corpusName = CORPUS_MAP[entry] || 'career';
            if (storeMap[corpusName]) {
                await ingestFile(fullPath, storeMap[corpusName], corpusName);
            }
        }
    }

    console.log("\n✨ Bulk ingestion & sync complete.");
}

async function listAllStores() {
    let allStores: any[] = [];
    let pageToken = '';

    do {
        const url = `${BASE_URL}/fileSearchStores?key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (data.fileSearchStores) {
            allStores = allStores.concat(data.fileSearchStores);
        }
        pageToken = data.nextPageToken || '';
    } while (pageToken);

    return allStores;
}

async function ingestDirectory(dirPath: string, storeResourceId: string, corpusName: string) {
    console.log(`\n📂 Ingesting ${corpusName.toUpperCase()}...`);
    const files = await readdir(dirPath);
    for (const f of files) {
        if (f.endsWith('.md')) {
            const filePath = join(dirPath, f);
            await ingestFile(filePath, storeResourceId, corpusName);
        }
    }
}

async function ingestFile(filePath: string, storeResourceId: string, corpusName: string) {
    const displayName = basename(filePath);
    process.stdout.write(`• ${corpusName.padEnd(12)} -> ${displayName.padEnd(30)} ... `);

    try {
        const fileContent = await readFile(filePath);
        const currentHash = computeHash(fileContent);
        const relativePath = filePath.replace(resolve(process.cwd()), '');

        // Sync Check: Only upload if the file changed
        if (syncState[relativePath] && syncState[relativePath].hash === currentHash) {
            console.log("✓ Skipped (Unchanged)");
            return;
        }

        // Deleting old version if it exists
        if (syncState[relativePath]?.fileId) {
            try {
                await fetch(`${BASE_URL}/${syncState[relativePath].fileId}?key=${API_KEY}`, { method: 'DELETE' });
            } catch (ignore) { /* Ignore if it fails */ }
        }

        const mimeType = 'text/markdown';
        const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${API_KEY}`;

        // 1. Upload
        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'raw',
                'Content-Type': mimeType,
                'X-Goog-Upload-Header-Content-Meta-Session-Data': JSON.stringify({ displayName })
            },
            body: fileContent
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.text();
            throw new Error(`Upload failed: ${uploadRes.status} ${err}`);
        }

        const { file } = await uploadRes.json() as any;
        const fileResourceName = file.name;

        // 2. Wait for ACTIVE
        let active = false;
        let attempts = 0;
        while (!active && attempts < 10) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`${BASE_URL}/${fileResourceName}?key=${API_KEY}`);
            const status = await statusRes.json() as any;
            if (status.state === 'ACTIVE') {
                active = true;
            } else if (status.state === 'FAILED') {
                throw new Error(`Processing failed: ${JSON.stringify(status.error)}`);
            }
            attempts++;
        }

        // 3. Import
        const importRes = await fetch(`${BASE_URL}/${storeResourceId}:importFile?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: fileResourceName })
        });

        if (!importRes.ok) {
            const err = await importRes.text();
            if (err.includes("already exists")) {
                console.log("✓ (Imported existing)");
                syncState[relativePath] = { hash: currentHash, fileId: fileResourceName };
                await saveSyncState();
                return;
            }
            throw new Error(`Import failed: ${importRes.status} ${err}`);
        }

        syncState[relativePath] = { hash: currentHash, fileId: fileResourceName };
        await saveSyncState();

        console.log("✓ Done");
    } catch (e: any) {
        console.log(`✕ Failed: ${e.message}`);
    }
}

main().catch(console.error);
