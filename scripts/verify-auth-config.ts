import { config } from 'dotenv';
import { firebaseDefaultConfig } from '../src/config/env';
import fs from 'fs';
import path from 'path';

config({ path: path.join(__dirname, '../.env') });

console.log('--- Auth Configuration Audit ---');

const landingPageConfigPath = path.join(__dirname, '../landing-page/app/lib/firebase.ts');
const landingPageContent = fs.readFileSync(landingPageConfigPath, 'utf8');

const expectedKey = process.env.VITE_FIREBASE_API_KEY || "";
const expectedAppId = "1:223837784072:web:3af738739465ea4095e9bd";

console.log('1. Checking Electron App Config (src/config/env.ts):');
console.log(`   - API Key: ${firebaseDefaultConfig.apiKey}`);
console.log(`   - App ID:  ${firebaseDefaultConfig.appId}`);

const electronMatch = firebaseDefaultConfig.apiKey === expectedKey && firebaseDefaultConfig.appId === expectedAppId;
console.log(`   Match: ${electronMatch ? '✅ SUCCESS' : '❌ MISMATCH'}`);

console.log('2. Checking Landing Page Config (landing-page/app/lib/firebase.ts):');
const landingKeyMatch = landingPageContent.includes(expectedKey);
const landingAppIdMatch = landingPageContent.includes(expectedAppId);

console.log(`   - API Key Present: ${landingKeyMatch}`);
console.log(`   - App ID Present:  ${landingAppIdMatch}`);
console.log(`   Match: ${landingKeyMatch && landingAppIdMatch ? '✅ SUCCESS' : '❌ MISMATCH'}`);

console.log('3. Checking .env file:');
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envKeyMatch = envContent.includes(`VITE_FIREBASE_API_KEY=${expectedKey}`);
    console.log(`   - .env VITE_FIREBASE_API_KEY match: ${envKeyMatch}`);
} else {
    console.log('   - .env file not found');
}

if (electronMatch && landingKeyMatch && landingAppIdMatch) {
    console.log('\nResult: CONFIGURATION IS UNIFIED ✅');
    process.exit(0);
} else {
    console.log('\nResult: CONFIGURATION MISMATCH DETECTED ❌');
    process.exit(1);
}
