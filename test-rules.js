const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const fs = require('fs');

async function run() {
  try {
    const rules = fs.readFileSync('packages/firebase/firestore.rules', 'utf8');
    const testEnv = await initializeTestEnvironment({
      projectId: 'indii-music-founder',
      firestore: { rules, host: '127.0.0.1', port: 8080 },
    });
    console.log("Rules loaded successfully!");
    await testEnv.cleanup();
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
