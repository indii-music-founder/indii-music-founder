import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { logger } from '@/utils/logger';
import type { EvidencePacket, IdentityProtectionProfile, ReplicaIncident, TakedownCase } from './types';

export async function saveIdentityProtectionProfile(profile: IdentityProtectionProfile): Promise<string> {
  const ref = await addDoc(collection(db, 'users', profile.userId, 'identityProtectionProfiles'), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getIdentityProtectionProfile(userId: string, profileId: string): Promise<IdentityProtectionProfile | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'identityProtectionProfiles', profileId));
  return snap.exists() ? snap.data() as IdentityProtectionProfile : null;
}

export async function getLatestIdentityProtectionProfile(userId: string): Promise<IdentityProtectionProfile | null> {
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'identityProtectionProfiles'));
    if (snap.empty) return null;
    const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<IdentityProtectionProfile, 'id'>) } as IdentityProtectionProfile & { createdAt?: { toMillis?: () => number } }));
    docs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
    return docs[0];
  } catch (err) {
    logger.error('[CreatorProtectionStorage] Failed to load latest profile:', err);
    return null;
  }
}

export async function updateIdentityProtectionProfile(userId: string, profileId: string, updates: Partial<IdentityProtectionProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'identityProtectionProfiles', profileId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function saveReplicaIncident(incident: ReplicaIncident): Promise<string> {
  const ref = await addDoc(collection(db, 'users', incident.userId, 'replicaIncidents'), {
    ...incident,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveEvidencePacket(packet: EvidencePacket): Promise<string> {
  const ref = await addDoc(collection(db, 'users', packet.userId, 'evidencePackets'), {
    ...packet,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveTakedownCase(takedownCase: TakedownCase): Promise<string> {
  const ref = await addDoc(collection(db, 'users', takedownCase.userId, 'takedownCases'), {
    ...takedownCase,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

