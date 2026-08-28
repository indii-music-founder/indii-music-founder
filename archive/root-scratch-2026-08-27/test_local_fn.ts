import { generateImageV3 } from './packages/firebase/src/functions/creative/gateway.ts';

async function run() {
  const req = {
    auth: { uid: 'testuser' },
    data: {
      prompt: 'A beautiful sunset',
      model: 'fast'
    }
  };

  try {
    const res = await generateImageV3.run(req);
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
    if (e.code) console.error("Code:", e.code);
    if (e.message) console.error("Message:", e.message);
  }
}

run();
