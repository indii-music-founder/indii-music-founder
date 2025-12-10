import fetch from 'node-fetch';

const projectId = 'indiios-v-1-1';
const region = 'us-central1';
const functionName = 'generateContent';
const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;

console.log(`Checking connectivity to: ${url}`);

try {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            data: {
                model: 'gemini-1.5-flash-001',
                contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
            }
        })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`Response body preview: ${text.substring(0, 500)}`);

    if (response.status === 200) {
        console.log("SUCCESS: Backend function is working and returned a response.");
    } else {
        console.error("FAILURE: Backend returned error.");
    }

} catch (error) {
    console.error("Network error:", error);
}
