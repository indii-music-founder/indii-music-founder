import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize Firebase Admin
try {
  const serviceAccount = JSON.parse(fs.readFileSync('/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/indiios-v-1-1-4e76d9bc5462.json', 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
} catch (e) {
  initializeApp(); // Try default ADC
}

const db = getFirestore();

async function checkJobs() {
  console.log("Checking recent video jobs...");
  const snapshot = await db.collection('videoJobs').orderBy('createdAt', 'desc').limit(3).get();
  
  if (snapshot.empty) {
    console.log("No jobs found.");
    return;
  }
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\nJob ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Progress: ${data.progress || 0}%`);
    console.log(`Updated At: ${data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt}`);
    if (data.error) console.log(`Error: ${data.error}`);
    if (data.videoUrl) console.log(`✅ VIDEO URL: ${data.videoUrl}`);
  });
  process.exit(0);
}

checkJobs().catch(console.error);
