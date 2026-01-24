import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_API_KEY;

if (!apiKey) {
    console.error('❌ No API key found.');
    process.exit(1);
}

async function checkAuthStatus() {
    // Try to verify password (with junk data) to see who handles it
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'password',
                returnSecureToken: true
            })
        });

        const data = await response.json();

        console.log('--- Identity Toolkit Response ---');
        console.log(JSON.stringify(data, null, 2));

        if (data.error) {
            console.log('\nAnalysis:');
            if (data.error.message === 'CONFIGURATION_NOT_FOUND') {
                console.log('❌ Project exists, but Authentication is NOT enabled for it.');
            } else if (data.error.message.includes('Project')) {
                console.log('❌ Project Info in error:', data.error.message);
            }
        }

    } catch (e) {
        console.error('Network error:', e);
    }
}

checkAuthStatus();
