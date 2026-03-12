import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_API_KEY;

if (!apiKey) {
    console.error('❌ No API key found in .env');
    process.exit(1);
}

console.log(`Checking key: ${apiKey.substring(0, 8)}...`);

async function verifyKey() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ API Key is VALID.');
            console.log('Available Model Info:', JSON.stringify(data, null, 2));
        } else {
            console.error('❌ API Key Check FAILED.');
            console.error(`Status: ${response.status} ${response.statusText}`);
            console.error('Error Body:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('❌ Network Error:', error);
    }
}

verifyKey();
