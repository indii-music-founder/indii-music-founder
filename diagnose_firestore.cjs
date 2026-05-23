const admin = require('firebase-admin');

const oldKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/old_project_key.json';
const newKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/new_project_key.json';

async function diagnose() {
  console.log('Initializing old project...');
  const oldApp = admin.initializeApp({
    credential: admin.credential.cert(oldKeyPath)
  }, 'oldProject');
  const oldDb = oldApp.firestore();

  console.log('Initializing new project...');
  const newApp = admin.initializeApp({
    credential: admin.credential.cert(newKeyPath)
  }, 'newProject');
  const newDb = newApp.firestore();

  console.log('\n--- Old Project Root Collections ---');
  const oldCols = await oldDb.listCollections();
  for (const col of oldCols) {
    const snapshot = await col.limit(1).get();
    console.log(`- ${col.id} (${snapshot.size > 0 ? 'not empty' : 'empty'})`);
  }

  console.log('\n--- New Project Root Collections ---');
  const newCols = await newDb.listCollections();
  for (const col of newCols) {
    const snapshot = await col.limit(1).get();
    console.log(`- ${col.id} (${snapshot.size > 0 ? 'not empty' : 'empty'})`);
  }

  console.log('\nDone!');
  process.exit(0);
}

diagnose().catch(err => {
  console.error('Diagnosis failed:', err);
  process.exit(1);
});
