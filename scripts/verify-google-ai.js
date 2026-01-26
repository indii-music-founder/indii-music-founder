
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ NO API KEY FOUND in .env (checked GOOGLE_API_KEY and GEMINI_API_KEY)");
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log("📡 Connecting to Google AI Studio API...");

try {
    const response = await fetch(url);

    if (!response.ok) {
        const text = await response.text();
        console.error(`❌ API Error (${response.status}):`, text);
        process.exit(1);
    }

    const data = await response.json();
    console.log("✅ Connection Successful!");

    console.log(`\n📋 Found ${data.models?.length || 0} models.`);

    const gemini3 = data.models?.find(m => m.name.includes('gemini-3') || m.name.includes('gemini-2.0'));

    if (gemini3) {
        console.log(`\n🎉 Gemini 3/2.0 Model Detected in List: ${gemini3.name}`);
    } else {
        console.log(`\n⚠️ No Gemini 3/2.0 models found in public list.`);
    }

    // DIRECT GENERATION TEST
    const modelsToTest = [
        'models/gemini-3.0-pro',
        'models/gemini-3-pro-preview',
        'models/gemini-3.0-flash',
        'models/gemini-3-flash-preview'
    ];

    console.log("\n🧪 ATTEMPTING DIRECT GENERATION...");

    for (const model of modelsToTest) {
        console.log(`\nTesting: ${model}...`);
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${API_KEY}`;

        try {
            const genResponse = await fetch(genUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Hello, strictly reply with 'OK'." }] }]
                })
            });

            if (genResponse.ok) {
                const genData = await genResponse.json();
                const text = genData.candidates?.[0]?.content?.parts?.[0]?.text;
                console.log(`✅ SUCCESS [${model}]: Response: "${text?.trim()}"`);
                console.log(`‼️ RECOMMENDATION: Update settings.json to use '${model}'`);
            } else {
                console.log(`❌ FAILED [${model}]: Status ${genResponse.status}`);
            }
        } catch (e) {
            console.log(`❌ ERROR [${model}]: ${e.message}`);
        }
    }

} catch (error) {
    console.error("💥 Network/Script Error:", error);
}
