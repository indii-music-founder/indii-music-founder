import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function simulate() {
  try {
    // Try to load service account from the known location the user set up earlier
    const keyPath = join(__dirname, '..', 'admin-sdk.json');
    let serviceAccount;
    
    try {
        serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'));
    } catch (e) {
        console.error("Could not find admin-sdk.json at", keyPath);
        console.error("Please ensure the service account JSON is placed there, or skip this test.");
        process.exit(1);
    }

    initializeApp({
      credential: cert(serviceAccount)
    });

    const db = getFirestore();
    
    // 1. Get the most recently updated session
    const sessionsRef = db.collection('sessions');
    const snapshot = await sessionsRef.orderBy('updatedAt', 'desc').limit(1).get();
    
    if (snapshot.empty) {
        console.log("No active sessions found. Create one in the UI first.");
        process.exit(0);
    }
    
    const sessionDoc = snapshot.docs[0];
    const sessionData = sessionDoc.data();
    
    console.log(`Injecting message into Session: ${sessionData.title} (${sessionDoc.id})`);
    
    // 2. Create a mock Agent message
    const newMessage = {
        id: `msg-${Date.now()}`,
        role: 'model',
        text: `Beep boop! I am a background agent simulation. I injected this message at ${new Date().toLocaleTimeString()} without touching the frontend code. I hope you saw this appear instantly!`,
        timestamp: Date.now(),
        agentId: 'creative-director',
        isStreaming: false
    };
    
    // 3. Update the session document
    await sessionDoc.ref.update({
        messages: FieldValue.arrayUnion(newMessage),
        updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("✅ Message successfully injected into Firestore. Check the app UI!");
    process.exit(0);

  } catch (error) {
    console.error("Simulation failed:", error);
    process.exit(1);
  }
}

simulate();
