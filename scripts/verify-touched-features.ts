
import fs from 'fs';
import path from 'path';

// 1. Load .env manually BEFORE any app code is imported
// This prevents hoisting issues where firebase.ts inits before env is set
console.log("🚀 Starting Verification Script...");

try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        console.log("Loading .env from:", envPath);
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                const k = key.trim();
                const v = value.trim();
                // Override only if not already set (or just force it)
                // For test scripts, forcing is usually safer
                if (!process.env[k]) {
                    process.env[k] = v;
                }
            }
        });
    } else {
        console.warn("⚠️ .env file not found at:", envPath);
        // Fallback for CI or explicit env vars
    }
} catch (e) {
    console.warn("Could not load .env:", e);
}

// 2. Dynamic Import of App Code
async function verify() {
    console.log("🔍 Verifying Touched Features (Static Analysis)...");

    // Dynamic import to ensure process.env is ready
    const { PHYSICAL_MEDIA_TEMPLATES } = await import('../src/services/design/templates');
    const { AGENT_CONFIGS } = await import('../src/services/agent/agentConfig');

    // 1. Verify Templates
    console.log("Checking Physical Media Templates...");
    const templateKeys = Object.keys(PHYSICAL_MEDIA_TEMPLATES);
    if (templateKeys.length === 0) throw new Error("No templates found!");
    console.log(`✅ Found ${templateKeys.length} templates: ${templateKeys.join(', ')}`);

    // 2. Verify Agent Config
    console.log("Checking Creative Director Agent Config...");

    const directorConfig = AGENT_CONFIGS.find((c: any) => c.id === 'director');
    if (!directorConfig) {
        console.error("❌ CRITICAL: 'director' agent config not found!");
        process.exit(1);
    }
    console.log("✅ Creative Director Config found.");

    // Check for the new tool
    const toolsConfig = directorConfig.tools || [];

    // Extract definition names from all tool groups
    const toolNames = toolsConfig.flatMap((t: any) =>
        (t.functionDeclarations || []).map((f: any) => f.name)
    );

    console.log(`Found tools: [${toolNames.join(', ')}]`);

    const hasTool = toolNames.includes('generate_high_res_asset');

    if (hasTool) {
        console.log("✅ Tool 'generate_high_res_asset' is correctly registered to Director config.");
    } else {
        console.error("❌ ERROR: Tool 'generate_high_res_asset' is MISSING from Director config.");
        console.log("Current Tool Struct:", JSON.stringify(toolsConfig, null, 2));
        process.exit(1);
    }

    console.log("🎉 All touched features verified successfully.");
}

verify().catch(err => {
    console.error("❌ Verification Failed:", err);
    process.exit(1);
});
