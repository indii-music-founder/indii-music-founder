import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin (assumes GOOGLE_APPLICATION_CREDENTIALS is set or gcloud auth application-default login is run)
admin.initializeApp({
  projectId: 'indii-music-founder',
  storageBucket: 'indii-music-founder.firebasestorage.app' // Verify if this is correct, might be indii-music-founder.appspot.com
});

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage();

interface OrphanRecord {
  uid: string;
  creationTime: string;
  lastSignInTime: string;
  hasFirestoreDoc: boolean;
  firestoreData?: any;
  hasStorageFiles: boolean;
  storageFiles?: string[];
}

async function auditAnonymousUsers() {
  const isConfirm = process.argv.includes('--confirm');
  console.log(`\n🔍 Starting Anonymous User Audit (Confirm Mode: ${isConfirm})\n`);

  let anonymousUsers: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined = undefined;

  // 1. Fetch all users in batches
  do {
    const listUsersResult = await auth.listUsers(1000, pageToken);
    const batch = listUsersResult.users.filter(user => user.providerData.length === 0);
    anonymousUsers = anonymousUsers.concat(batch);
    pageToken = listUsersResult.pageToken;
  } while (pageToken);

  console.log(`Found ${anonymousUsers.length} anonymous users (empty providerData).\n`);

  const orphanRecords: OrphanRecord[] = [];
  const bucket = storage.bucket('indii-music-founder.firebasestorage.app');

  // 2. Audit each user for associated data
  for (const user of anonymousUsers) {
    const record: OrphanRecord = {
      uid: user.uid,
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
      hasFirestoreDoc: false,
      hasStorageFiles: false
    };

    // Check Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      record.hasFirestoreDoc = true;
      // We don't fetch all subcollections for the dry-run to save reads, but we note its existence
    }

    // Check Storage
    try {
      const [files] = await bucket.getFiles({ prefix: `users/${user.uid}/` });
      if (files.length > 0) {
        record.hasStorageFiles = true;
        record.storageFiles = files.map(f => f.name);
      }
    } catch (e) {
      // Bucket might be incorrect or missing permissions, ignore for now
    }

    orphanRecords.push(record);
  }

  // 3. Output dry-run results
  const reportPath = path.join(process.cwd(), 'anonymous_users_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(orphanRecords, null, 2));
  console.log(`📝 Audit report saved to: ${reportPath}`);
  console.log(`Users with Firestore data: ${orphanRecords.filter(r => r.hasFirestoreDoc).length}`);
  console.log(`Users with Storage files: ${orphanRecords.filter(r => r.hasStorageFiles).length}\n`);

  // 4. Confirmed Purge
  if (isConfirm) {
    console.log('⚠️ --confirm flag detected. Executing purge...\n');
    for (const record of orphanRecords) {
      console.log(`Purging ${record.uid}...`);
      
      // Delete Storage
      if (record.hasStorageFiles && record.storageFiles) {
        for (const file of record.storageFiles) {
          await bucket.file(file).delete();
        }
        console.log(`  - Deleted ${record.storageFiles.length} storage files.`);
      }

      // Delete Firestore (user doc and shallow subcollections)
      if (record.hasFirestoreDoc) {
        // Warning: Recursive delete in Admin SDK is best done via bulkWriter, but for one-off admin script:
        await db.recursiveDelete(db.collection('users').doc(record.uid));
        console.log(`  - Deleted Firestore document users/${record.uid} and all subcollections.`);
      }

      // Delete Auth Record
      await auth.deleteUser(record.uid);
      console.log(`  - Deleted Firebase Auth identity.`);
    }
    console.log('\n✅ Purge complete.');
  } else {
    console.log('ℹ️ Dry-run only. To execute the purge, run with --confirm.');
  }
}

auditAnonymousUsers().catch(console.error);
