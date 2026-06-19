import admin from 'firebase-admin';

// Initialize with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

admin.initializeApp({ projectId: "indii-music-founder" });

const db = admin.firestore();

async function run() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  if (snapshot.empty) {
    console.log('No matching documents in users collection.');
    return;
  }

  for (const doc of snapshot.docs) {
    console.log(`Setting founder tier for user: ${doc.id}`);
    await doc.ref.set({ tier: 'founder' }, { merge: true });
  }
  
  console.log('Done!');
}

run().catch(console.error);
