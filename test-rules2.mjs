import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import fs from 'fs';

async function run() {
  try {
    const rules = fs.readFileSync('packages/firebase/firestore.rules', 'utf8');
    const testEnv = await initializeTestEnvironment({
      projectId: 'indii-music-founder',
      firestore: { rules, host: '127.0.0.1', port: 8080 },
    });
    
    console.log("Rules loaded successfully!");
    
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'marketplace_drops', 'drop-1'), { ownerId: 'ALICE_UID' });
        console.log("Disabled rules: document written");
    });
    
    const db = testEnv.unauthenticatedContext().firestore();
    try {
      await getDoc(doc(db, 'marketplace_drops', 'drop-1'));
      console.log("unauthCtx marketplace_drops: READ ALLOWED");
    } catch (e) {
      console.log("unauthCtx marketplace_drops: READ DENIED");
    }

    await testEnv.cleanup();
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
