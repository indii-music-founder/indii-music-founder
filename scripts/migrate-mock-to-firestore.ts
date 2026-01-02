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
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
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
import { FALLBACK_PLATFORMS as SAMPLE_PLATFORMS } from '../src/services/knowledge/SamplePlatforms';

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

    for (const product of MERCHANDISE_CATALOG) {
        const ref = db.collection('merchandise_catalog').doc(product.id);
        batch.set(ref, {
            ...product,
            updatedAt: new Date()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`   ✅ Migrated ${MERCHANDISE_CATALOG.length} products`);
}

async function migrateSamplePlatforms() {
    console.log('\n🎵 Migrating Sample Platforms...');
    const batch = db.batch();

    for (const platform of SAMPLE_PLATFORMS) {
        const ref = db.collection('sample_platforms').doc(platform.id);
        batch.set(ref, {
            ...platform,
            updatedAt: new Date()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`   ✅ Migrated ${SAMPLE_PLATFORMS.length} platforms`);
}

async function migrateApiInventory() {
    console.log('\n🔧 Migrating API Inventory...');
    const batch = db.batch();

    for (const api of API_INVENTORY) {
        const ref = db.collection('api_inventory').doc(api.id);
        batch.set(ref, {
            ...api,
            lastChecked: new Date()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`   ✅ Migrated ${API_INVENTORY.length} APIs`);
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
    console.log('='.repeat(50));

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
