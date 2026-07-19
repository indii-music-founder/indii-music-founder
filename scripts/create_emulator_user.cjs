const admin = require('firebase-admin');

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

admin.initializeApp({ projectId: 'indii-music-founder' });

async function create() {
  try {
    const user = await admin.auth().createUser({
      email: 'wiil@indii.music',
      password: 'password123', // I assume they used something basic, but let's just create it. 
      // If it exists, it will throw, which is fine!
    });
    console.log('Successfully created user:', user.uid);
  } catch (error) {
    console.error('Error creating user:', error.message);
    if (error.code === 'auth/email-already-exists') {
      const user = await admin.auth().getUserByEmail('wiil@indii.music');
      console.log('User already exists. Updating password to password123');
      await admin.auth().updateUser(user.uid, { password: 'password123' });
    }
  }
  process.exit(0);
}

create();
