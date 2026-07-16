import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory name for ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY;
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const functionsRegion = process.env.VITE_FUNCTIONS_REGION || 'us-central1';
const functionsBaseUrl = process.env.VITE_FUNCTIONS_URL || `https://${functionsRegion}-${projectId}.cloudfunctions.net`;

if (!firebaseApiKey || !projectId) {
    console.error('❌ Missing required Firebase environment variables (VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID).');
    process.exit(1);
}

console.log('==================================================');
console.log('   Starting Backend REST API Verification Suite   ');
console.log('==================================================');
console.log(`Firebase Project: ${projectId}`);
console.log(`Functions URL:    ${functionsBaseUrl}`);
console.log(`API Key Present:  ${!!firebaseApiKey}`);
console.log('==================================================\n');

interface TestResult {
    endpoint: string;
    method: string;
    status: number;
    latencyMs: number;
    passed: boolean;
    payloadPreview: string;
}

const results: TestResult[] = [];

async function runTest(
    name: string,
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: any
): Promise<any> {
    const startTime = Date.now();
    try {
        const response = await fetch(url, {
            method,
            headers: {
                ...headers,
                'Referer': 'https://app.indii.music/',
                'Origin': 'https://app.indii.music'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        const latencyMs = Date.now() - startTime;
        let data: any = null;
        const text = await response.text();
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        const isOk = response.ok || response.status === 204;
        const preview = typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : String(data).slice(0, 120);

        results.push({
            endpoint: name,
            method,
            status: response.status,
            latencyMs,
            passed: isOk,
            payloadPreview: preview + (preview.length >= 120 ? '...' : '')
        });

        if (!isOk) {
            console.error(`❌ Failed: ${method} ${url} -> Status ${response.status}`);
            console.error(`   Response:`, text);
        }

        return { status: response.status, data };
    } catch (e: any) {
        const latencyMs = Date.now() - startTime;
        results.push({
            endpoint: name,
            method,
            status: 0,
            latencyMs,
            passed: false,
            payloadPreview: `Network/Request Error: ${e.message}`
        });
        console.error(`❌ Failed: ${method} ${url} -> Error: ${e.message}`);
        return null;
    }
}

async function verifyAll() {
    // 1. Authenticate to Firebase Auth using REST API to retrieve ID token
    console.log('🔑 Authenticating via Firebase Auth REST API...');
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`;
    const authPayload = {
        email: 'marcus.deep@test.indii.music',
        password: 'Test1234!',
        returnSecureToken: true
    };

    const authStart = Date.now();
    const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Referer': 'https://app.indii.music/',
            'Origin': 'https://app.indii.music'
        },
        body: JSON.stringify(authPayload)
    });
    
    if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error('❌ Authentication failed! Cannot proceed with API checks.');
        console.error(errorText);
        process.exit(1);
    }

    const authData = await authResponse.json() as any;
    const idToken = authData.idToken;
    const userId = authData.localId;
    console.log(`Base URL: ${functionsBaseUrl}`);
    console.log(`✅ Authenticated successfully. Latency: ${Date.now() - authStart}ms`);
    console.log(`   User ID:  ${userId}`);
    console.log(`   ID Token: ${idToken.slice(0, 20)}...\n`);

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
    };

    // 2. Call Health Endpoint (unauthenticated)
    await runTest(
        'health',
        'GET',
        `${functionsBaseUrl}/health`,
        { 'Content-Type': 'application/json' }
    );

    // 3. Call getProfile
    await runTest(
        'getProfile',
        'GET',
        `${functionsBaseUrl}/getProfile`,
        authHeaders
    );

    // 4. Call getSubscription (via callable POST wrapper)
    await runTest(
        'getSubscription',
        'POST',
        `${functionsBaseUrl}/getSubscription`,
        authHeaders,
        { data: { userId } }
    );

    // 5. Call getUsageStats (via callable POST wrapper)
    await runTest(
        'getUsageStats',
        'POST',
        `${functionsBaseUrl}/getUsageStats`,
        authHeaders,
        { data: { userId } }
    );

    // 6. Call listTracks
    await runTest(
        'listTracks',
        'GET',
        `${functionsBaseUrl}/listTracks`,
        authHeaders
    );

    // 7. Track CRUD lifecycle: Create
    const trackTitle = `Diagnostic Track ${Date.now()}`;
    const createResult = await runTest(
        'createTrack',
        'POST',
        `${functionsBaseUrl}/createTrack`,
        authHeaders,
        {
            title: trackTitle,
            genre: 'Electronic',
            status: 'draft',
            bpm: 120
        }
    );

    const createdTrackId = createResult?.data?.data?.id;

    if (createdTrackId) {
        console.log(`   Created Track ID: ${createdTrackId}`);

        // 8. Track CRUD lifecycle: Read
        await runTest(
            'getTrack',
            'GET',
            `${functionsBaseUrl}/getTrack/${createdTrackId}`,
            authHeaders
        );

        // 9. Track CRUD lifecycle: Update
        await runTest(
            'updateTrack',
            'PUT',
            `${functionsBaseUrl}/updateTrack/${createdTrackId}`,
            authHeaders,
            {
                title: `${trackTitle} (Updated)`,
                bpm: 128
            }
        );

        // 10. Track CRUD lifecycle: Delete
        await runTest(
            'deleteTrack',
            'DELETE',
            `${functionsBaseUrl}/deleteTrack/${createdTrackId}`,
            authHeaders
        );
    } else {
        console.warn('⚠️ Skipping Track GET/PUT/DELETE due to createTrack failure.');
    }

    // Print Verification Ledger
    console.log('\n====================================================================================================');
    console.log('                                     API VERIFICATION LEDGER                                        ');
    console.log('====================================================================================================');
    console.log(
        '%-18s | %-6s | %-6s | %-10s | %-8s | %s',
        'Endpoint',
        'Method',
        'Status',
        'Latency',
        'Result',
        'Payload Preview'
    );
    console.log('----------------------------------------------------------------------------------------------------');
    
    let allPassed = true;
    for (const r of results) {
        if (!r.passed) allPassed = false;
        console.log(
            '%-18s | %-6s | %-6d | %-10s | %-8s | %s',
            r.endpoint,
            r.method,
            r.status,
            `${r.latencyMs}ms`,
            r.passed ? '✅ PASS' : '❌ FAIL',
            r.payloadPreview
        );
    }
    console.log('====================================================================================================\n');

    if (allPassed) {
        console.log('🎉 SUCCESS: All backend REST API endpoints resolved successfully! 100% operational.');
        process.exit(0);
    } else {
        console.error('❌ FAILURE: One or more backend REST API endpoints failed verification.');
        process.exit(1);
    }
}

verifyAll();
