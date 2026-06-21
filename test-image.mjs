import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

// Get config from .env or mock
const firebaseConfig = {
  apiKey: "AIzaSyD4VdBp0id8y5o...", // mock
  projectId: "indii-music-founder"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
connectFunctionsEmulator(functions, "127.0.0.1", 5001);

const generateImageV3 = httpsCallable(functions, 'generateImageV3');

async function test() {
  try {
    const res = await generateImageV3({
      prompt: "A fluffy puppy",
      aspectRatio: "1:1",
      model: "fast"
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error calling generateImageV3:");
    console.error(err.code);
    console.error(err.message);
  }
}
test();
