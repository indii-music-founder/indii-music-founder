const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

admin.initializeApp({ projectId: 'indiios-v-1-1' });
const db = admin.firestore();

async function seed() {
    console.log("Fetching users...");
    const users = await db.collection('users').get();
    const uids = users.docs.map(d => d.id);
    if (!uids.includes('founder-demo-uid')) {
        uids.push('founder-demo-uid');
    }

    for (const uid of uids) {
        await db.collection(`users/${uid}/knowledge_wiki`).doc('project_alpha_specs').set({
            title: 'Project Alpha Specifications',
            content: '# Project Alpha\n\nThis is a **live test** of the new Wiki Knowledge Store.\n\n## Key Capabilities\n- **Markdown Rendering**: Fully supports `react-markdown` and `remark-gfm`.\n- **Real-Time Sync**: Documents are pulled directly from Firestore via `WikiStorageAdapter`.\n- **Styling**: Implements Tailwind Typography (`prose-invert`) for clean readability.\n\n### Example Code Block\n```typescript\nimport { WikiCompiler } from "@/services/agent/memory/WikiCompiler";\n\nconst compiler = new WikiCompiler();\nawait compiler.compileInteraction("user_123", { rawInput: "Hello World!" });\n```\n\n> This document was autonomously generated and verified by Antigravity.',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'verified',
            tags: ['test', 'alpha', 'wiki'],
            type: 'WIKI',
            metadata: { source: 'Seed Script' }
        });
        console.log(`Successfully seeded Wiki document for UID: ${uid}`);
    }
}

seed().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
