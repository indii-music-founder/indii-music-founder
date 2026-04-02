import fs from 'fs';
async function loadEnv() {
    let apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        try {
            const envContent = fs.readFileSync('.env', 'utf-8');
            const lines = envContent.split('\n');
            for (let line of lines) {
                if (line.startsWith('VITE_API_KEY=')) {
                    apiKey = line.split('=')[1].trim().replace(/(^"|"$)/g, '');
                }
            }
        } catch (e) { }
    }
    return apiKey;
}

async function run() {
    const apiKey = await loadEnv();
    const url = `https://generativelanguage.googleapis.com/v1alpha/models/veo-3.1-generate-preview/operations/wbitg9qd7nsf?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    fs.writeFileSync('veo_raw_response.json', JSON.stringify(data, null, 2));

    const samples = data.response?.generateVideoResponse?.generatedSamples;
    if (samples && samples.length > 0) {
        if (samples[0].video && samples[0].video.uri) {
            const uri = samples[0].video.uri;
            console.log("Downloading video from:", uri);
            const videoRes = await fetch(`${uri}&key=${apiKey}`);
            const buffer = await videoRes.arrayBuffer();
            fs.writeFileSync('cyberpunk_city_veo.mp4', Buffer.from(buffer));
            console.log("SUCCESS! Saved video to cyberpunk_city_veo.mp4");
        }
    } else {
        console.log("No video samples found in the response.");
    }
}
run();
