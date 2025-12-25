
import { config } from 'dotenv';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { GeminiRetrieval } from '../src/services/rag/GeminiRetrievalService';

// Load environment variables
config();

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("Usage: npx tsx scripts/ingest-youtube.ts <youtube-url>");
        process.exit(1);
    }

    const videoUrl = args[0];

    if (!ytdl.validateURL(videoUrl)) {
        console.error("Error: Invalid YouTube URL provided.");
        process.exit(1);
    }

    console.log(`\n🎥 IndiiOS YouTube Ingestion`);
    console.log(`===================================`);
    console.log(`URL: ${videoUrl}`);

    try {
        // 1. Get Video Info
        console.log("\n[1/4] Fetching video metadata...");
        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title.replace(/[\/\\?%*:|"<>]/g, '-'); // Sanitize filename
        const author = info.videoDetails.author.name;
        console.log(`Title:  ${title}`);
        console.log(`Author: ${author}`);

        // 2. Download Audio
        console.log(`\n[2/4] Downloading audio stream...`);
        const tempDir = path.resolve('temp_downloads');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const fileName = `${title}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Use standard output stream
        const stream = ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' });

        await new Promise((resolve, reject) => {
            stream
                .pipe(fs.createWriteStream(filePath))
                .on('finish', resolve)
                .on('error', reject);
        });

        console.log(`✓ Downloaded to: ${filePath}`);

        // 3. Connect to Store
        console.log("\n[3/4] Connecting to Gemini Knowledge Store...");
        const storeName = await GeminiRetrieval.ensureFileSearchStore();
        console.log(`✓ Connected to Store: ${storeName}`);

        // 4. Upload & Ingest
        console.log(`\n[4/4] Uploading to Knowledge Base...`);
        const fileContent = fs.readFileSync(filePath);

        // Upload to Gemini Files
        const uploadedFile = await GeminiRetrieval.uploadFile(fileName, new Uint8Array(fileContent), 'audio/mp3');
        console.log(`✓ Uploaded file: ${uploadedFile.name}`);

        // Link to Store
        await GeminiRetrieval.importFileToStore(uploadedFile.name, storeName);
        console.log(`✓ Imported into Store!`);

        // Cleanup
        fs.unlinkSync(filePath);
        fs.rmdirSync(tempDir);

        console.log(`\n===================================`);
        console.log(`✅ YouTube Video Ingested Successfully!`);
        console.log(`Agents can now answer questions about: "${title}"`);
        console.log(`===================================\n`);

    } catch (error: any) {
        console.error("\n❌ Ingestion Failed:", error.message);
        if (error.message.includes('429')) {
            console.error("Make sure your IP is not blocked by YouTube or try again later.");
        }
        process.exit(1);
    }
}

main().catch(console.error);
