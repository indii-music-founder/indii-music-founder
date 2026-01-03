
import fs from 'fs';
import path from 'path';

// 1. Init Env & Mocks
try {
    // Mock import.meta.env for firebase.ts
    // @ts-ignore
    if (!global.import) global.import = {};
    // @ts-ignore
    global.import.meta = { env: { DEV: true, MODE: 'development' } };


    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        console.log("Loading .env from:", envPath);
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) process.env[key.trim()] = value.trim();
        });
    }
} catch (e) {
    console.warn("Could not load .env:", e);
}

// Helper to mock window.electronAPI for testing
// @ts-ignore
if (typeof window === 'undefined') {
    // @ts-ignore
    global.window = {
        electronAPI: {
            audio: {
                analyze: async (path: string) => ({ bpm: 120, key: 'C Major', energy: 0.8 }),
                getMetadata: async (hash: string) => ({ title: 'Mock Song', artist: 'Mock Artist' })
            }
        }
    };
}


async function verifyFeatures() {
    console.log("🚀 Starting AI Feature Verification...");

    try {
        // Dynamic imports to ensure env is ready
        const { firebaseAI } = await import('../src/services/ai/FirebaseAIService');
        const { VideoGeneration } = await import('../src/services/image/VideoGenerationService');
        const { PublicistAgent } = await import('../src/services/agent/definitions/PublicistAgent');
        const { MusicTools } = await import('../src/services/agent/tools/MusicTools');
        const { DirectorAgent } = await import('../src/agents/director/config');

        // 1. Check FirebaseAIService Bootstrap
        console.log("\n📡 Checking FirebaseAIService...");
        // Mocking remote config fetch if needed or just relying on it failing gracefully in test env
        // In a real script we might need to mock 'firebase/remote-config' if we can't hit network
        // For now, we assume we can import it. 
        // Note: Actual network calls might fail in this script environment if not auth'd, 
        // so we focus on structure and existence.
        if (firebaseAI) {
            console.log("✅ FirebaseAIService instance exists.");
        } else {
            throw new Error("❌ FirebaseAIService failed to import.");
        }

        // 2. Check Video AI
        console.log("\n🎥 Checking Video AI...");
        if (VideoGeneration) {
            console.log("✅ VideoGenerationService exists.");
            // Check if critical methods exist
            if (typeof VideoGeneration.generateVideo === 'function') {
                console.log("✅ VideoGeneration.generateVideo is callable.");
            } else {
                console.error("❌ VideoGeneration.generateVideo is missing.");
            }
        }

        // 3. Check Publicist AI
        console.log("\n📢 Checking Publicist AI...");
        if (PublicistAgent) {
            console.log("✅ PublicistAgent definition found.");
            const tools = PublicistAgent.tools?.[0]?.functionDeclarations?.map((f: any) => f.name);
            console.log(`   Tools: ${tools?.join(', ')}`);

            if (tools?.includes('create_campaign')) {
                console.log("✅ Tool 'create_campaign' is present.");
            } else {
                console.error("❌ Tool 'create_campaign' is MISSING.");
            }
        }

        // 4. Check Music AI
        console.log("\n🎵 Checking Music AI...");
        const analysisResult = await MusicTools.analyze_audio({ filePath: '/mock/path.mp3' });
        if (analysisResult.includes('120')) {
            console.log("✅ MusicTools.analyze_audio returned valid mock data.");
        } else {
            console.error(`❌ MusicTools.analyze_audio failed: ${analysisResult}`);
        }

        // 5. Check Director AI
        console.log("\n🎬 Checking Director AI...");
        if (DirectorAgent) {
            console.log("✅ DirectorAgent definition found.");
            const directorTools = DirectorAgent.tools?.[0]?.functionDeclarations?.map((f: any) => f.name);
            console.log(`   Tools: [${directorTools?.length}] found.`);

            if (directorTools?.includes('generate_visual_script')) {
                console.log("✅ Tool 'generate_visual_script' is present.");
            } else {
                console.error("❌ Tool 'generate_visual_script' is MISSING.");
            }
        }

        console.log("\n✅ Verification Pre-Flight Complete.");

    } catch (error) {
        console.error("❌ Fatal Verification Error:", error);
        process.exit(1);
    }
}

verifyFeatures();
