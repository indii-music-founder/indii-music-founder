
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const CONTENT_RULES = [
    {
        type: 'copyright_infringement',
        pattern: 'copyright_infringement',
        matchMessage: 'Detected: "Shake It Off" by Taylor Swift',
        createdAt: Date.now()
    },
    {
        type: 'broad_spectrum',
        pattern: 'sped_up',
        details: 'Detected: Pitch/Tempo shift (+25%) matching known copyright.',
        createdAt: Date.now()
    },
    {
        type: 'broad_spectrum',
        pattern: 'nightcore',
        details: 'Detected: Pitch/Tempo shift (+25%) matching known copyright.',
        createdAt: Date.now()
    },
    {
        type: 'broad_spectrum',
        pattern: 'slowed',
        details: 'Detected: Pitch/Tempo shift (-20%) matching known copyright.',
        createdAt: Date.now()
    },
    {
        type: 'broad_spectrum',
        pattern: 'chopped',
        details: 'Detected: Pitch/Tempo shift (-20%) matching known copyright.',
        createdAt: Date.now()
    }
];

async function seedFraudRules() {
    console.log('Seeding fraud detection rules...');

    try {
        let admin;
        try {
            admin = require('firebase-admin');
        } catch (e) {
            console.warn("Module 'firebase-admin' not found.");
            throw e;
        }

        if (admin.apps.length === 0) {
            try {
                admin.initializeApp();
            } catch (e) {
                console.warn("Could not initialize Admin SDK. Dumping to JSON.");
                const fs = require('fs');
                fs.writeFileSync('seed_fraud_rules.json', JSON.stringify(CONTENT_RULES, null, 2));
                return;
            }
        }

        const db = admin.firestore();
        const collectionRef = db.collection('content_rules');

        for (const rule of CONTENT_RULES) {
            // Check if exists to avoid duplicates (simple check by pattern + type)
            const q = collectionRef.where('type', '==', rule.type).where('pattern', '==', rule.pattern);
            const snapshot = await q.get();

            if (snapshot.empty) {
                await collectionRef.add(rule);
                console.log(`Added rule: ${rule.type} -> ${rule.pattern}`);
            } else {
                console.log(`Skipped existing rule: ${rule.pattern}`);
            }
        }

        console.log('Seeding complete.');

    } catch (e) {
        console.error('Seeding failed:', e.message);
        const fs = require('fs');
        fs.writeFileSync('seed_fraud_rules.json', JSON.stringify(CONTENT_RULES, null, 2));
        console.log("Data written to seed_fraud_rules.json");
    }
}

seedFraudRules();
