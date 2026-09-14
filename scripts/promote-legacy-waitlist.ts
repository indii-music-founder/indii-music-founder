import { createHash } from 'node:crypto';
import admin from 'firebase-admin';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'indii-music-founder';
const FOUNDING_ARTIST_WAITLIST_COLLECTION = 'foundingArtistWaitlist';
const FOUNDING_ARTIST_EMAIL_INDEX_COLLECTION = 'foundingArtistEmailIndex';
const FOUNDING_ARTIST_WAITLIST_META_DOCUMENT = 'foundingArtistWaitlistMeta/sequence';
const FOUNDING_ARTIST_EVENTS_COLLECTION = 'foundingArtistEvents';
const FOUNDING_ARTIST_CONSENT_VERSION = '2026-08-29';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();
const auth = admin.auth();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

async function getOrCreateUid(email: string): Promise<string> {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error?.code === 'auth/user-not-found') {
      try {
        const newUser = await auth.createUser({
          email,
          emailVerified: true,
          displayName: email.split('@')[0],
        });
        return newUser.uid;
      } catch (createErr) {
        console.warn(`[Auth] Could not create auth user for ${email}, generating deterministic UID:`, createErr);
        return `legacy_${hashEmail(email).slice(0, 24)}`;
      }
    }
    console.warn(`[Auth] Error fetching user for ${email}, generating deterministic UID:`, err);
    return `legacy_${hashEmail(email).slice(0, 24)}`;
  }
}

async function runMigration() {
  console.log('Fetching legacy waitlist submissions...');
  const snapshot = await db.collection('waitlist').get();

  const entries: {
    id: string;
    email: string;
    createdAt: admin.firestore.Timestamp | null;
  }[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const email = typeof data.email === 'string' ? normalizeEmail(data.email) : '';
    if (!email || email === 'w@w.com') {
      console.log(`Skipping ignored or invalid entry: "${email}" (${doc.id})`);
      return;
    }
    const createdAt = data.createdAt instanceof admin.firestore.Timestamp
      ? data.createdAt
      : null;
    entries.push({ id: doc.id, email, createdAt });
  });

  // Sort chronologically by original submission date
  entries.sort((a, b) => {
    const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
    return timeA - timeB;
  });

  console.log(`\nPromoting ${entries.length} genuine artists to verified queue:\n`);

  let position = 1;
  for (const entry of entries) {
    const uid = await getOrCreateUid(entry.email);
    const emailHash = hashEmail(entry.email);
    const joinedAt = entry.createdAt || admin.firestore.FieldValue.serverTimestamp();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const artistRef = db.collection(FOUNDING_ARTIST_WAITLIST_COLLECTION).doc(uid);
    const emailIndexRef = db.collection(FOUNDING_ARTIST_EMAIL_INDEX_COLLECTION).doc(emailHash);
    const eventRef = db.collection(FOUNDING_ARTIST_EVENTS_COLLECTION).doc(`${uid}_verified_enrollment`);

    await db.runTransaction(async (transaction) => {
      transaction.set(artistRef, {
        uid,
        email: entry.email,
        emailHash,
        status: 'waitlisted',
        queuePosition: position,
        source: 'legacy_promotion',
        emailVerified: true,
        verifiedAt: now,
        joinedAt,
        communicationPreferences: {
          betaInvitations: true,
          majorMilestoneUpdates: true,
          consentVersion: FOUNDING_ARTIST_CONSENT_VERSION,
          recordedAt: now,
        },
        invitation: null,
        accountId: uid,
        updatedAt: now,
      });

      transaction.set(emailIndexRef, {
        uid,
        emailHash,
        queuePosition: position,
        createdAt: now,
      });

      transaction.set(eventRef, {
        uid,
        type: 'verified_enrollment',
        fromStatus: 'legacy_unverified',
        toStatus: 'waitlisted',
        queuePosition: position,
        source: 'legacy_promotion',
        consentVersion: FOUNDING_ARTIST_CONSENT_VERSION,
        createdAt: now,
      });
    });

    console.log(`  ✓ #${position} | ${entry.email} (UID: ${uid})`);
    position++;
  }

  // Update sequence counter for future signups
  const metaRef = db.doc(FOUNDING_ARTIST_WAITLIST_META_DOCUMENT);
  await metaRef.set({
    nextPosition: position,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`\nSequence counter updated. Next waitlist position will be #${position}.\nMigration completed successfully!`);
}

runMigration().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
