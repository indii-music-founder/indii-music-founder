
import { GeminiRetrievalService } from '../src/services/rag/GeminiRetrievalService.ts';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function diagnose() {
    console.log("🩺 Starting API Diagnosis...");
    const apiKey = process.env.VITE_API_KEY;

    if (!apiKey) {
        console.error("❌ Missing VITE_API_KEY");
        return;
    }
    console.log(`🔑 API Key found: ${apiKey.substring(0, 8)}...`);

    const GeminiRetrieval = new GeminiRetrievalService(apiKey);

    try {
        // 1. Check List Files (Read Access)
        console.log("\n1. Checking Read Access (List Files)...");
        const list = await GeminiRetrieval.listFiles();
        console.log("✅ Success! API is connected.");
        console.log(`   Found ${list.files?.length || 0} files.`);

        if (list.files && list.files.length > 0) {
            console.log("   Existing Files (Top 5):");
            list.files.slice(0, 5).forEach(f => console.log(`   - ${f.displayName} (${f.name}) [${f.state}]`));
        } else {
            console.log("\n⚠️ No files found.");
        }

    } catch (error: any) {
        console.error("❌ API Connection Failed:", error.message);
        if (error.message.includes("403")) {
            console.log("   -> API Key is invalid or lacks permissions.");
        }
    }
}

diagnose();
