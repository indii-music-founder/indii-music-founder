
const fs = require('fs');
const path = require('path');

console.log('--- Auth Configuration Audit ---');

const expectedKey = "AIzaSyD9SmSp-2TIxw5EV9dfQSOdx4yRNNxU0RM";
const expectedAppId = "1:223837784072:web:3af738739465ea4095e9bd";

// 1. Check src/config/env.ts
const envPath = path.join(__dirname, '../src/config/env.ts');
const envContent = fs.readFileSync(envPath, 'utf8');
const envKeyMatch = envContent.includes(`apiKey: "${expectedKey}"`);
const envAppIdMatch = envContent.includes(`appId: "${expectedAppId}"`);

console.log('1. Electron App Config (src/config/env.ts):');
console.log(`   - API Key Match: ${envKeyMatch}`);
console.log(`   - App ID Match:  ${envAppIdMatch}`);

// 2. Check landing-page/app/lib/firebase.ts
const landingPath = path.join(__dirname, '../landing-page/app/lib/firebase.ts');
const landingContent = fs.readFileSync(landingPath, 'utf8');
const landingKeyMatch = landingContent.includes(expectedKey);
const landingAppIdMatch = landingContent.includes(expectedAppId);

console.log('2. Landing Page Config (landing-page/app/lib/firebase.ts):');
console.log(`   - API Key Match: ${landingKeyMatch}`);
console.log(`   - App ID Match:  ${landingAppIdMatch}`);

// 3. Check .env
const envFilePath = path.join(__dirname, '../.env');
const dotEnvContent = fs.readFileSync(envFilePath, 'utf8');
const dotEnvKeyMatch = dotEnvContent.includes(`VITE_FIREBASE_API_KEY=${expectedKey}`);

console.log('3. .env File Config:');
console.log(`   - VITE_FIREBASE_API_KEY Match: ${dotEnvKeyMatch}`);

if (envKeyMatch && envAppIdMatch && landingKeyMatch && landingAppIdMatch && dotEnvKeyMatch) {
    console.log('\nVERIFICATION RESULT: SUCCESS ✅ all keys unified.');
    process.exit(0);
} else {
    console.log('\nVERIFICATION RESULT: FAILURE ❌ configuration drifts detected.');
    process.exit(1);
}
