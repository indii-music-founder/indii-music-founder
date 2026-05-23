const admin = require('firebase-admin');

const oldKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/old_project_key.json';
const newKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/new_project_key.json';

async function deleteCollection(collectionRef) {
  const snapshot = await collectionRef.get();
  if (snapshot.size === 0) return;
  console.log(`  Deleting ${snapshot.size} docs from "${collectionRef.id}"...`);
  
  for (const doc of snapshot.docs) {
    const subCols = await doc.ref.listCollections();
    for (const subCol of subCols) {
      await deleteCollection(subCol);
    }
    await doc.ref.delete();
  }
}

async function copyCollection(srcCol, destCol) {
  const snapshot = await srcCol.get();
  if (snapshot.size === 0) {
    console.log(`Skipping empty collection "${srcCol.id}"`);
    return;
  }
  
  console.log(`Migrating "${srcCol.id}" with ${snapshot.size} documents...`);
  const docs = snapshot.docs;
  const batchSize = 50;
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const batch = destCol.firestore.batch();
    
    for (const doc of chunk) {
      const destDocRef = destCol.doc(doc.id);
      batch.set(destDocRef, doc.data());
    }
    
    await batch.commit();
    console.log(`  Written chunk ${Math.floor(i / batchSize) + 1}/${Math.ceil(docs.length / batchSize)} for "${srcCol.id}"`);
    
    // Process subcollections for this chunk
    for (const doc of chunk) {
      const subCols = await doc.ref.listCollections();
      for (const subCol of subCols) {
        const destDocRef = destCol.doc(doc.id);
        const destSubCol = destDocRef.collection(subCol.id);
        await copyCollection(subCol, destSubCol);
      }
    }
  }
}

async function migrate() {
  console.log('====================================================');
  console.log('           Firestore Database Migration');
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

  // 1. Clear boardroom_messages and overwrite-target collections in the new database
  console.log('\nStep 1: Cleaning up garbage / target collections in the new DB...');
  const newCols = await newDb.listCollections();
  const collectionsToDelete = ['boardroom_messages', 'history', 'projects', 'user_rate_limits', 'users'];
  for (const col of newCols) {
    if (collectionsToDelete.includes(col.id)) {
      console.log(`Clearing collection: "${col.id}"`);
      await deleteCollection(col);
    }
  }

  // 2. Export and copy collections from old to new DB
  console.log('\nStep 2: Copying all collections from old DB to new DB...');
  const oldCols = await oldDb.listCollections();
  
  // We'll migrate everything that has docs
  for (const col of oldCols) {
    const destCol = newDb.collection(col.id);
    await copyCollection(col, destCol);
  }

  console.log('\n====================================================');
  console.log('      Firestore Migration Completed Successfully!');
  console.log('====================================================');
  process.exit(0);
}

migrate().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
