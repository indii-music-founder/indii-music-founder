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
    if (!apiKey) {
        console.error('No API key found in .env');
        process.exit(1);
    }

    const opName = "models/veo-3.1-generate-preview/operations/wbitg9qd7nsf";
    const url = `https://generativelanguage.googleapis.com/v1alpha/${opName}?key=${apiKey}`;

    console.log("Polling Veo 3.1 Operation:", opName);
    let done = false;
    while (!done) {
        const res = await fetch(url);
        const data = await res.json();

        done = data.done;
        console.log("Status:", done ? "Completed!" : "Still processing...");

        if (done) {
            if (data.error) {
                console.error("Failed:", data.error);
                process.exit(1);
            }
            const videos = data.response?.generatedVideos;
            if (videos && videos.length > 0) {
                const videoBytes = videos[0].video.videoBytes;
                fs.writeFileSync('output_veo_3_1.mp4', Buffer.from(videoBytes, 'base64'));
                console.log("SUCCESS! Extracted Veo generated video bytes to output_veo_3_1.mp4");
            } else {
                console.log("No video in response", data);
            }
        } else {
            console.log("... waiting 10 seconds ...");
            await new Promise(r => setTimeout(r, 10000));
        }
    }
}
run();
