
import { config } from 'dotenv';
import { resolve, basename } from 'path';
import { readdir, readFile, stat, writeFile, mkdir, unlink, rm } from 'fs/promises';
import { createWriteStream } from 'fs';
import { GeminiRetrieval } from '../src/services/rag/GeminiRetrievalService';
import ytdl from 'ytdl-core';
import { JSDOM } from 'jsdom';

// Load environment variables
config();

// Helper to sanitize filenames
const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9._-]/g, '_');

// Helper to compute SHA256 (simplified for now to rely on displayName matching, 
// as local hashing might mismatch Gemini's server-side hash for some types)
// We will use displayName checking as the primary deduplication method for now.

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: npx tsx scripts/ingest-unified.ts <path-or-url> [dataset-name]");
        console.error("Examples:");
        console.error("  npx tsx scripts/ingest-unified.ts ./knowledge         (Ingest folder)");
        console.error("  npx tsx scripts/ingest-unified.ts https://youtube...  (Ingest Video)");
        console.error("  npx tsx scripts/ingest-unified.ts https://example.com (Ingest Web Article)");
        process.exit(1);
    }

    const input = args[0];
    const datasetName = args[1] || "Default Knowledge Set";

    console.log(`\n🧠 IndiiOS Unified Ingestion System`);
    console.log(`===================================`);
    console.log(`Input: ${input}`);

    try {
        // 1. Initialize Store & Cache
        console.log("\n[1/?] Connecting to Knowledge Base...");
        const storeName = await GeminiRetrieval.ensureFileSearchStore();
        console.log(`✓ Connected to Store: ${storeName}`);

        console.log("Fetching existing file list for deduplication...");
        const existingFiles = await GeminiRetrieval.listFiles();
        const existingMap = new Set(existingFiles.files?.map(f => f.displayName) || []);
        console.log(`✓ Found ${existingMap.size} existing documents.`);


        // 2. Route Handler
        if (input.startsWith('http')) {
            if (input.includes('youtube.com') || input.includes('youtu.be')) {
                await handleYouTube(input, storeName, existingMap);
            } else {
                await handleWebPage(input, storeName, existingMap);
            }
        } else {
            // Assume File or Directory
            await handleFileSystem(input, storeName, existingMap);
        }

    } catch (e: any) {
        console.error("\n❌ System Error:", e.message);
        process.exit(1);
    }
}

// Handler: YouTube
async function handleYouTube(url: string, storeName: string, existingMap: Set<string>) {
    console.log(`\n[YouTube Mode] Processing video...`);
    if (!ytdl.validateURL(url)) throw new Error("Invalid YouTube URL");

    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title; // raw title
    const safeFilename = `${sanitize(title)}.mp3`;

    if (existingMap.has(safeFilename)) {
        console.log(`⚠️  Skipping "${safeFilename}" - Already exists in Knowledge Base.`);
        return;
    }

    console.log(`Downloading: "${title}"...`);

    // Create temp dir
    const tempDir = resolve('temp_ingest');
    await mkdir(tempDir, { recursive: true });
    const filePath = resolve(tempDir, safeFilename);

    const stream = ytdl(url, { quality: 'highestaudio', filter: 'audioonly' });

    await new Promise((resolve, reject) => {
        stream.pipe(createWriteStream(filePath))
            .on('finish', resolve)
            .on('error', reject);
    });

    await uploadAndIngest(filePath, safeFilename, storeName, 'audio/mp3');
    await rm(tempDir, { recursive: true, force: true });
}

// Handler: Web Page
async function handleWebPage(url: string, storeName: string, existingMap: Set<string>) {
    console.log(`\n[Web Mode] Scraping article...`);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.statusText}`);
    const html = await res.text();

    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Basic Extraction
    const title = doc.title || "Untitled Web Page";
    // Remove scripts and styles
    doc.querySelectorAll('script, style, nav, footer, iframe').forEach(el => el.remove());

    const content = doc.body.textContent || "";
    const cleanContent = content.replace(/\s+/g, ' ').trim();

    // Create Markdown synthesis
    const markdown = `# ${title}\n\n**Source:** ${url}\n**Ingested:** ${new Date().toISOString()}\n\n## Content\n${cleanContent}\n`;

    const safeFilename = `${sanitize(title)}.md`;

    if (existingMap.has(safeFilename)) {
        console.log(`⚠️  Skipping "${safeFilename}" - Already exists in Knowledge Base.`);
        return;
    }

    // Create temp file
    const tempDir = resolve('temp_ingest');
    await mkdir(tempDir, { recursive: true });
    const filePath = resolve(tempDir, safeFilename);

    await writeFile(filePath, markdown);
    await uploadAndIngest(filePath, safeFilename, storeName, 'text/markdown');
    await rm(tempDir, { recursive: true, force: true });
}

// Handler: File System
async function handleFileSystem(pathStr: string, storeName: string, existingMap: Set<string>) {
    const absPath = resolve(pathStr);
    let stats;
    try {
        stats = await stat(absPath);
    } catch {
        throw new Error(`Path not found: ${absPath}`);
    }

    if (stats.isDirectory()) {
        console.log(`\n[Directory Mode] Scanning ${absPath}...`);
        const files = await readdir(absPath);

        for (const f of files) {
            // Recursive? Let's keep it simple (flat) for now, or just handle top level
            // Filter common garbage
            if (f.startsWith('.')) continue;

            const fullPath = resolve(absPath, f);
            const childStats = await stat(fullPath);

            if (childStats.isFile()) {
                if (existingMap.has(f)) {
                    console.log(`• Skipping: ${f} (Exists)`);
                    continue;
                }
                await uploadAndIngest(fullPath, f, storeName);
            }
        }
    } else {
        const fileName = basename(absPath);
        if (existingMap.has(fileName)) {
            console.log(`⚠️  Skipping "${fileName}" - Already exists.`);
            return;
        }
        await uploadAndIngest(absPath, fileName, storeName);
    }
}

// Core Uploader
async function uploadAndIngest(filePath: string, displayName: string, storeName: string, mimeType?: string) {
    process.stdout.write(`Uploading ${displayName}... `);
    try {
        const content = await readFile(filePath);
        // Upload
        const file = await GeminiRetrieval.uploadFile(displayName, new Uint8Array(content), mimeType);
        // Import
        await GeminiRetrieval.importFileToStore(file.name, storeName);
        console.log("✓ Done");
    } catch (e: any) {
        console.log(`✕ Failed: ${e.message}`);
    }
}

main().catch(console.error);
