
import { config } from 'dotenv';
import { resolve } from 'path';
import { readdir, readFile, stat } from 'fs/promises';
import { GeminiRetrieval } from '../src/services/rag/GeminiRetrievalService';

// Load environment variables from .env
config();

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: npx tsx scripts/ingest-knowledge.ts <directory-path>");
        process.exit(1);
    }

    const targetDir = args[0];
    const absolutePath = resolve(targetDir);

    console.log(`\n📚 IndiiOS Knowledge Base Ingestion`);
    console.log(`===================================`);
    console.log(`Target Directory: ${absolutePath}`);

    try {
        const stats = await stat(absolutePath);
        if (!stats.isDirectory()) {
            console.error("Error: Provided path is not a directory.");
            process.exit(1);
        }
    } catch (e) {
        console.error(`Error: Directory not found: ${absolutePath}`);
        process.exit(1);
    }

    // 1. Ensure Store Exists
    console.log("\n[1/3] Connecting to Gemini Knowledge Store...");
    let storeName: string;
    try {
        storeName = await GeminiRetrieval.ensureFileSearchStore();
        console.log(`✓ Connected to Store: ${storeName}`);
    } catch (e: any) {
        console.error("Failed to connect to store:", e.message);
        process.exit(1);
    }

    // 2. Scan Directory
    console.log(`\n[2/3] Scanning files in ${targetDir}...`);
    const files = await readdir(absolutePath);
    const supportedExtensions = ['.pdf', '.txt', '.md', '.csv', '.json'];
    const targetFiles = files.filter(f => supportedExtensions.some(ext => f.toLowerCase().endsWith(ext)));

    console.log(`Found ${targetFiles.length} supported files (${supportedExtensions.join(', ')}).`);

    if (targetFiles.length === 0) {
        console.log("No files to ingest.");
        return;
    }

    // 3. Upload & Ingest
    console.log(`\n[3/3] Uploading and Indexing...`);
    let successCount = 0;
    let failCount = 0;

    for (const fileName of targetFiles) {
        process.stdout.write(`Processing ${fileName}... `);
        try {
            const filePath = resolve(absolutePath, fileName);
            const content = await readFile(filePath);

            // Upload to Gemini Files
            const uploadedFile = await GeminiRetrieval.uploadFile(fileName, new Uint8Array(content));

            // Link to Store
            await GeminiRetrieval.importFileToStore(uploadedFile.name, storeName);

            console.log("✓ OK");
            successCount++;
        } catch (e: any) {
            console.log(`✕ FAILED: ${e.message}`);
            failCount++;
        }
    }

    console.log(`\n===================================`);
    console.log(`Ingestion Complete`);
    console.log(`✓ Successful: ${successCount}`);
    console.log(`✕ Failed:     ${failCount}`);
    console.log(`===================================\n`);
}

main().catch(console.error);
