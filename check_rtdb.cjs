const admin = require('firebase-admin');

const oldKeyPath = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/99d0961b-4202-4447-b399-80811b7e0228/scratch/old_project_key.json';

async function check() {
  console.log('Checking default database...');
  const appDefault = admin.initializeApp({
    credential: admin.credential.cert(oldKeyPath),
    databaseURL: 'https://indii-music-founder-default-rtdb.firebaseio.com'
  }, 'defaultApp');
  
  try {
    const dbDefault = appDefault.database();
    const snapshot = await dbDefault.ref('/').once('value');
    console.log('Default RTDB content:', snapshot.val());
  } catch (err) {
    console.error('Error checking default RTDB:', err.message);
  }

  console.log('\nChecking secondary database...');
  const appSecondary = admin.initializeApp({
    credential: admin.credential.cert(oldKeyPath),
    databaseURL: 'https://indiios-alpha-electron-1.firebaseio.com'
  }, 'secondaryApp');

  try {
    const dbSecondary = appSecondary.database();
    const snapshotSecondary = await dbSecondary.ref('/').once('value');
    console.log('Secondary RTDB content:', snapshotSecondary.val());
  } catch (err) {
    console.error('Error checking secondary RTDB:', err.message);
  }
  
  process.exit(0);
}

check();
