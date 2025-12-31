
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DEMO_EARNINGS = [
    {
        distributorId: 'distrokid',
        releaseId: 'DK-DEMO-001',
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        streams: 15420,
        downloads: 45,
        grossRevenue: 125.50,
        distributorFee: 0,
        netRevenue: 125.50,
        currencyCode: 'USD',
        lastUpdated: new Date().toISOString(),
        breakdown: [
            { platform: 'Spotify', territoryCode: 'US', streams: 10000, downloads: 0, revenue: 40.00 },
            { platform: 'Apple Music', territoryCode: 'US', streams: 5000, downloads: 0, revenue: 80.00 },
            { platform: 'iTunes', territoryCode: 'US', streams: 0, downloads: 45, revenue: 5.50 },
        ],
    },
    {
        distributorId: 'cdbaby',
        releaseId: 'CDB-DEMO-001',
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        streams: 8500,
        downloads: 120,
        grossRevenue: 95.00,
        distributorFee: 8.55,
        netRevenue: 86.45,
        currencyCode: 'USD',
        lastUpdated: new Date().toISOString(),
        breakdown: [],
    },
    {
        distributorId: 'tunecore',
        releaseId: 'TC-DEMO-001',
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        streams: 12500,
        downloads: 30,
        grossRevenue: 98.50,
        distributorFee: 0,
        netRevenue: 98.50,
        currencyCode: 'USD',
        lastUpdated: new Date().toISOString(),
        breakdown: [],
    },
    {
        distributorId: 'symphonic',
        releaseId: 'SYM-DEMO-001',
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        streams: 5000,
        downloads: 10,
        grossRevenue: 45.00,
        distributorFee: 6.75,
        netRevenue: 38.25,
        currencyCode: 'USD',
        lastUpdated: new Date().toISOString(),
        breakdown: [],
    }
];

async function seedEarnings() {
    console.log('Seeding earnings data...');

    try {
        // Attempt to load admin sdk from functions directory if possible, or just standard `firebase-admin`
        let admin;
        try {
            admin = require('firebase-admin');
        } catch (e) {
            console.warn("Module 'firebase-admin' not found. Ensure it is installed or run inside functions environment.");
            throw e;
        }

        // Check if already initialized
        if (admin.apps.length === 0) {
            try {
                admin.initializeApp();
            } catch (e) {
                console.warn("Could not initialize Admin SDK (expected in local env without creds).");
                console.log("Dumping data to 'seed_data.json' instead.");
                const fs = require('fs');
                fs.writeFileSync('seed_data.json', JSON.stringify(DEMO_EARNINGS, null, 2));
                return;
            }
        }

        const db = admin.firestore();
        const collectionRef = db.collection('earnings');

        for (const record of DEMO_EARNINGS) {
            await collectionRef.add({
                ...record,
                createdAt: Date.now()
            });
            console.log(`Added record for ${record.distributorId}`);
        }

        console.log('Seeding complete.');

    } catch (e) {
        console.error('Seeding failed:', e.message);
        // Fallback to writing to disk so the user can import it manually if needed
        const fs = require('fs');
        fs.writeFileSync('seed_data.json', JSON.stringify(DEMO_EARNINGS, null, 2));
        console.log("Data written to seed_data.json");
    }
}

seedEarnings();
