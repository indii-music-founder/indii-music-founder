/**
 * Migration Script: Mock Data to Firestore
 *
 * This script migrates hardcoded mock data from production code to Firestore collections.
 * Run once to seed the database, then the services will read from Firestore.
 *
 * Usage: npx tsx scripts/migrate-mock-to-firestore.ts
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(process.cwd(), 'scripts', '../firebase-service-account.json');
let db: FirebaseFirestore.Firestore;

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')) as ServiceAccount;
    initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore();
} else {
    console.error('❌ firebase-service-account.json not found. Please add it to the project root.');
    console.log('   Download from Firebase Console > Project Settings > Service Accounts');
    process.exit(1);
}

// ============================================
// MERCHANDISE CATALOG DATA
// ============================================
const MERCHANDISE_CATALOG = [
    {
        id: 'standard-tee',
        title: "Standard Tee",
        basePrice: 24.99,
        image: "/assets/merch/standard_tee.png",
        tags: ["Streetwear", "Cotton", "Unisex"],
        category: 'standard',
        description: "Classic cotton tee with your branding"
    },
    {
        id: 'standard-hoodie',
        title: "Standard Hoodie",
        basePrice: 49.99,
        image: "/assets/merch/standard_hoodie.png",
        tags: ["Fleece", "Oversized", "Vibrant"],
        category: 'standard',
        description: "Comfortable fleece hoodie"
    },
    {
        id: 'pro-tee',
        title: "PRO Tee",
        basePrice: 45.00,
        image: "/assets/merch/pro_tee.png",
        features: ["Moisture Wicking", "Embedded NFC"],
        category: 'pro',
        description: "Performance tee with smart features"
    },
    {
        id: 'pro-hoodie',
        title: "PRO Hoodie",
        basePrice: 85.00,
        image: "/assets/merch/pro_hoodie.png",
        features: ["Heavyweight", "Water Resistant"],
        category: 'pro',
        description: "Premium heavyweight hoodie"
    }
];

// ============================================
// SAMPLE PLATFORMS KNOWLEDGE BASE
// ============================================
const SAMPLE_PLATFORMS = [
    {
        id: 'splice',
        name: 'Splice',
        keywords: ['splice', 'splice sounds'],
        defaultLicenseType: 'Royalty-Free',
        termsSummary: "Royalty-Free for commercial use. No per-use payment required.",
        color: 'text-blue-400',
        requirements: { creditRequired: false, reportingRequired: false }
    },
    {
        id: 'loopcloud',
        name: 'Loopcloud',
        keywords: ['loopcloud', 'loopmasters'],
        defaultLicenseType: 'Royalty-Free',
        termsSummary: "Royalty-Free for commercial use (Points spent purchased license).",
        color: 'text-indigo-400',
        requirements: { creditRequired: false, reportingRequired: false }
    },
    {
        id: 'tracklib',
        name: 'Tracklib',
        keywords: ['tracklib'],
        defaultLicenseType: 'Clearance-Required',
        termsSummary: "Requires License Purchase + Revenue Share. NOT Royalty-Free by default.",
        color: 'text-orange-500',
        requirements: { creditRequired: true, reportingRequired: true }
    },
    {
        id: 'logic-stock',
        name: 'Logic Pro / GarageBand Stock',
        keywords: ['logic', 'garageband', 'apple loops', 'logic pro'],
        defaultLicenseType: 'Royalty-Free',
        termsSummary: "Royalty-Free commercial use (standalone loops). Cannot resell as loops.",
        color: 'text-gray-400',
        requirements: { creditRequired: false, reportingRequired: false }
    },
    {
        id: 'ableton-stock',
        name: 'Ableton Stock',
        keywords: ['ableton', 'ableton live', 'ableton pack'],
        defaultLicenseType: 'Royalty-Free',
        termsSummary: "Royalty-Free commercial use. Cannot resell as loops.",
        color: 'text-gray-400',
        requirements: { creditRequired: false, reportingRequired: false }
    }
];

// ============================================
// API INVENTORY
// ============================================
const API_INVENTORY = [
    { id: 'payment-api', name: 'Payment API', status: 'ACTIVE', environment: 'production' },
    { id: 'users-api', name: 'Users API', status: 'ACTIVE', environment: 'production' },
    { id: 'legacy-auth-api', name: 'Legacy Auth API', status: 'DEPRECATED', environment: 'production' },
    { id: 'test-endpoint', name: 'Test Endpoint', status: 'DISABLED', environment: 'staging' }
];

// ============================================
// MIGRATION FUNCTIONS
// ============================================

async function migrateMerchandiseCatalog() {
    console.log('\n📦 Migrating Merchandise Catalog...');
    const batch = db.batch();
    let skipped = 0;

    const refs = MERCHANDISE_CATALOG.map(p => db.collection('merchandise_catalog').doc(p.id));
    const snapshots = refs.length > 0 ? await db.getAll(...refs) : [];
    const existingIds = new Set(snapshots.filter(snap => snap.exists).map(snap => snap.id));

    const now = new Date();
    for (const product of MERCHANDISE_CATALOG) {
        if (existingIds.has(product.id)) {
    const now = new Date();
    const refs = MERCHANDISE_CATALOG.map(product => db.collection('merchandise_catalog').doc(product.id));
    const snapshots = await Promise.all(refs.map(ref => ref.get()));

    for (let i = 0; i < MERCHANDISE_CATALOG.length; i++) {
        const product = MERCHANDISE_CATALOG[i];
        if (snapshots[i].exists) {
            console.log(`   ⏭️  Skipping ${product.id} (already exists)`);
            skipped++;
            continue;
        }
        const ref = db.collection('merchandise_catalog').doc(product.id);
        batch.set(ref, {

        batch.set(refs[i], {
            ...product,
            createdAt: now,
            updatedAt: now
        });
    }

    if (MERCHANDISE_CATALOG.length - skipped > 0) {
        await batch.commit();
    }
    console.log(`   ✅ Migrated ${MERCHANDISE_CATALOG.length - skipped} products (${skipped} skipped)`);
}

async function migrateSamplePlatforms() {
    console.log('\n🎵 Migrating Sample Platforms...');
    const batch = db.batch();
    let skipped = 0;

    const refs = SAMPLE_PLATFORMS.map(platform => db.collection('sample_platforms').doc(platform.id));
    const snapshots = await Promise.all(refs.map(ref => ref.get()));

    const now = new Date();

    for (let i = 0; i < SAMPLE_PLATFORMS.length; i++) {
        const platform = SAMPLE_PLATFORMS[i];
        const existing = snapshots[i];

    // Use db.getAll to fetch all documents in a single batched network request to fix N+1 issue
    const existingDocs = await db.getAll(...refs);

    for (let i = 0; i < existingDocs.length; i++) {
        const existing = existingDocs[i];
        const platform = SAMPLE_PLATFORMS[i];
        const ref = refs[i];

        if (existing.exists) {
    const refs = SAMPLE_PLATFORMS.map(p => db.collection('sample_platforms').doc(p.id));
    const snapshots = refs.length > 0 ? await db.getAll(...refs) : [];
    const existingIds = new Set(snapshots.filter(snap => snap.exists).map(snap => snap.id));

    const now = new Date();
    for (const platform of SAMPLE_PLATFORMS) {
        if (existingIds.has(platform.id)) {
    // Optimization: Fetch all documents in a single network request to prevent N+1 query issue
    const refs = SAMPLE_PLATFORMS.map(platform => db.collection('sample_platforms').doc(platform.id));
    const existings = await db.getAll(...refs);

    for (let i = 0; i < SAMPLE_PLATFORMS.length; i++) {
        const platform = SAMPLE_PLATFORMS[i];
        const existing = existings[i];
        if (existing && existing.exists) {
    const now = new Date();
    const refs = SAMPLE_PLATFORMS.map(platform => db.collection('sample_platforms').doc(platform.id));
    const snapshots = await Promise.all(refs.map(ref => ref.get()));

    for (let i = 0; i < SAMPLE_PLATFORMS.length; i++) {
        const platform = SAMPLE_PLATFORMS[i];
        if (snapshots[i].exists) {
            console.log(`   ⏭️  Skipping ${platform.id} (already exists)`);
            skipped++;
            continue;
        }
        const ref = db.collection('sample_platforms').doc(platform.id);
        batch.set(ref, {

        batch.set(refs[i], {
            ...platform,
            createdAt: now,
            updatedAt: now
        });
    }

    if (SAMPLE_PLATFORMS.length - skipped > 0) {
        await batch.commit();
    }
    console.log(`   ✅ Migrated ${SAMPLE_PLATFORMS.length - skipped} platforms (${skipped} skipped)`);
}

async function migrateApiInventory() {
    console.log('\n🔧 Migrating API Inventory...');
    const batch = db.batch();
    let skipped = 0;

    const refs = API_INVENTORY.map(a => db.collection('api_inventory').doc(a.id));
    const snapshots = refs.length > 0 ? await db.getAll(...refs) : [];
    const existingIds = new Set(snapshots.filter(snap => snap.exists).map(snap => snap.id));

    const now = new Date();
    for (const api of API_INVENTORY) {
        if (existingIds.has(api.id)) {
    const now = new Date();
    const refs = API_INVENTORY.map(api => db.collection('api_inventory').doc(api.id));
    const snapshots = await Promise.all(refs.map(ref => ref.get()));

    for (let i = 0; i < API_INVENTORY.length; i++) {
        const api = API_INVENTORY[i];
        if (snapshots[i].exists) {
            console.log(`   ⏭️  Skipping ${api.id} (already exists)`);
            skipped++;
            continue;
        }
        const ref = db.collection('api_inventory').doc(api.id);
        batch.set(ref, {

        batch.set(refs[i], {
            ...api,
            lastChecked: now,
            createdAt: now
        });
    }

    if (API_INVENTORY.length - skipped > 0) {
        await batch.commit();
    }
    console.log(`   ✅ Migrated ${API_INVENTORY.length - skipped} APIs (${skipped} skipped)`);
}

async function verifyMigration() {
    console.log('\n🔍 Verifying Migration...');

    const merchandiseSnap = await db.collection('merchandise_catalog').get();
    const platformsSnap = await db.collection('sample_platforms').get();
    const apisSnap = await db.collection('api_inventory').get();

    console.log(`   merchandise_catalog: ${merchandiseSnap.size} documents`);
    console.log(`   sample_platforms: ${platformsSnap.size} documents`);
    console.log(`   api_inventory: ${apisSnap.size} documents`);

    const allGood = merchandiseSnap.size > 0 && platformsSnap.size > 0 && apisSnap.size > 0;
    return allGood;
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('🚀 Starting Mock Data Migration to Firestore\n');
    console.log('=' .repeat(50));

    try {
        await migrateMerchandiseCatalog();
        await migrateSamplePlatforms();
        await migrateApiInventory();

        console.log('\n' + '='.repeat(50));
        const success = await verifyMigration();

        if (success) {
            console.log('\n✨ Migration Complete!\n');
            console.log('Next steps:');
            console.log('1. Update services to query Firestore instead of using hardcoded data');
            console.log('2. Remove seedDatabase functions from services');
            console.log('3. Deploy updated Firestore rules');
        } else {
            console.log('\n⚠️  Migration completed but verification found issues');
        }
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

main();
