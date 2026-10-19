import { createHash } from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { SocietyRecipientSchema, SocietyDeliveryProfileSchema, publicSocietyDeliveryStatus, validateSocietySecretReference } from '@indii/shared';
const ownerHash = (uid: string) => createHash('sha256').update(uid).digest('hex').slice(0, 32);
export async function societyOnboarding(uid: string, admin: boolean, action: string, payload: Record<string, unknown>) {
  const db = getFirestore();
  if (action === 'configure_society_transport') {
    if (!admin) throw new HttpsError('permission-denied', 'Only an authorized operator may approve receiver access.');
    const input = z.object({ ownerUid: z.string().min(1).max(128).refine(id => !id.includes('/')), profile: SocietyDeliveryProfileSchema.omit({ revision: true }) }).strict().parse(payload);
    const ref = db.doc(`users/${input.ownerUid}/rightsSubmitterProfiles/${input.profile.recipient}`);
    await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data();
      const profile = { ...input.profile, revision: (previous?.revision ?? 0) + 1 };
      validateSocietySecretReference(profile, process.env.GCLOUD_PROJECT ?? '', ownerHash(input.ownerUid));
      tx.create(ref.collection('revisions').doc(String(profile.revision)), { ...profile, approvedBy: uid, approvedAt: FieldValue.serverTimestamp() });
      tx.set(ref, { ...profile, approvedBy: uid, approvedAt: FieldValue.serverTimestamp() });
      tx.create(ref.collection('events').doc(), { action: 'approved', revision: profile.revision, actorUid: uid, authorityReceiptId: profile.authorityReceiptId, onboardingReceiptId: profile.onboardingReceiptId, createdAt: FieldValue.serverTimestamp() });
    });
    return { configured: true };
  }
  const recipient = SocietyRecipientSchema.parse(payload.recipient);
  const ref = db.doc(`users/${uid}/rightsSubmitterProfiles/${recipient}`);
  const onboarding = db.doc(`users/${uid}/rightsSocietyOnboarding/${recipient}`);
  if (action === 'save_society_onboarding') {
    const input = z.object({ recipient: SocietyRecipientSchema, senderName: z.string().trim().min(1).max(200), senderIpi: z.string().regex(/^\d{9,11}$/), senderCode: z.string().regex(/^[A-Z0-9]{2,3}$/), authorityDescription: z.string().trim().min(1).max(2000) }).strict().parse(payload);
    // An owner's declaration is a request for review, never receiver approval.
    await onboarding.set({ ...input, state: 'requested', requestedAt: FieldValue.serverTimestamp() });
  } else if (action === 'revoke_society_transport') {
    await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data();
      tx.set(ref, { approved: false, revision: (previous?.revision ?? 0) + 1, revokedBy: uid, revokedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.create(ref.collection('events').doc(), { action: 'revoked', actorUid: uid, revision: (previous?.revision ?? 0) + 1, createdAt: FieldValue.serverTimestamp() });
    });
  } else if (action !== 'society_delivery_status') throw new HttpsError('invalid-argument', 'Unknown onboarding action.');
  const raw = (await ref.get()).data();
  // Remove server audit metadata before strict profile validation.
  const parsed = SocietyDeliveryProfileSchema.safeParse(raw && Object.fromEntries(Object.keys(SocietyDeliveryProfileSchema.shape).map(key => [key, raw[key]])));
  return { ...publicSocietyDeliveryStatus(parsed.success ? parsed.data : undefined, process.env.RIGHTS_CWR_DELIVERY_ENABLED === 'true'), onboarding: (await onboarding.get()).data() ?? null };
}
export { ownerHash as societyOwnerHash };
