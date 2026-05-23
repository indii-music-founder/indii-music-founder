const admin = require('firebase-admin');

const oldKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/old_project_key.json';
const newKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/new_project_key.json';

async function verify() {
  console.log('====================================================');
  console.log('        Firestore DB Verification System');
  console.log('====================================================');

  console.log('Initializing old project source DB...');
  const oldApp = admin.initializeApp({
    credential: admin.credential.cert(oldKeyPath)
  }, 'oldProject');
  const oldDb = oldApp.firestore();

  console.log('Initializing new project target DB...');
  const newApp = admin.initializeApp({
    credential: admin.credential.cert(newKeyPath)
  }, 'newProject');
  const newDb = newApp.firestore();

  console.log('Listing all collections from the source DB...');
  const oldCols = await oldDb.listCollections();

  let matchCount = 0;
  let mismatchCount = 0;

  for (const col of oldCols) {
    const oldSnapshot = await col.get();
    const oldSize = oldSnapshot.size;

    const newCol = newDb.collection(col.id);
    const newSnapshot = await newCol.get();
    const newSize = newSnapshot.size;

    console.log(`Collection "${col.id}":`);
    console.log(`  Source docs:      ${oldSize}`);
    console.log(`  Destination docs: ${newSize}`);

    if (oldSize === newSize) {
      console.log('  Status: MATCHED ✓');
      matchCount++;
    } else {
      console.warn('  Status: MISMATCH ✗');
      mismatchCount++;
    }
  }

  console.log('\n====================================================');
  console.log('           Firestore Verification Summary');
  console.log('====================================================');
  console.log(`Total Collections Verified: ${oldCols.length}`);
  console.log(`Matched Collections:        ${matchCount}`);
  console.log(`Mismatched Collections:     ${mismatchCount}`);
  console.log('====================================================');

  process.exit(mismatchCount > 0 ? 1 : 0);
}

verify().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
