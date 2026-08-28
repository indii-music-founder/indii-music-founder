import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import fs from 'fs';

async function run() {
  try {
    const rules = fs.readFileSync('packages/firebase/firestore.rules', 'utf8');
    const testEnv = await initializeTestEnvironment({
      projectId: 'indii-os-rules-test',
      firestore: { rules, host: '127.0.0.1', port: 8080 },
    });
    
    console.log("Rules loaded successfully!");
    
    const db = testEnv.unauthenticatedContext().firestore();
    try {
      await getDoc(doc(db, 'some_unlisted_collection', 'doc-1'));
      console.log("unauthCtx: READ ALLOWED (EXPECTED: DENIED)");
    } catch (e) {
      console.log("unauthCtx: READ DENIED (EXPECTED)");
    }

    await testEnv.cleanup();
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
