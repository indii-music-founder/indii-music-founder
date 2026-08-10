import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp({
    apiKey: 'test-key',
    projectId: 'indii-music-founder',
    authDomain: 'indii-music-founder.firebaseapp.com'
});

const auth = getAuth(app);
connectAuthEmulator(auth, 'http://localhost:9099');

const functions = getFunctions(app);
connectFunctionsEmulator(functions, 'localhost', 5001);

const generateImageV3 = httpsCallable(functions, 'generateImageV3');

async function run() {
    try {
        console.log('Signing into auth emulator...');
        try {
            await signInWithEmailAndPassword(auth, 'test-generation@indii.music', 'password123');
        } catch (e) {
            await createUserWithEmailAndPassword(auth, 'test-generation@indii.music', 'password123');
        }

        console.log('Sending generateImageV3 request to emulator...');
        const result = await generateImageV3({
            prompt: "A beautiful sunset over Detroit",
            aspectRatio: "16:9",
            modelTier: "FAST"
        });
        console.log('✅ Generation succeeded!', JSON.stringify(result.data, null, 2));
        process.exit(0);
    } catch (e) {
        console.error('❌ Generation failed:', e);
        process.exit(1);
    }
}

run();
