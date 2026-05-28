import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { ReleaseHarnessResult } from './types';

export async function saveReleaseHarnessRun(result: ReleaseHarnessResult): Promise<string> {
  const target = result.projectId
    ? collection(db, 'projects', result.projectId, 'releaseHarnessRuns')
    : collection(db, 'users', result.userId, 'releaseHarnessRuns');
  const ref = await addDoc(target, {
    ...result,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getReleaseHarnessRun(params: {
  userId: string;
  runId: string;
  projectId?: string;
}): Promise<ReleaseHarnessResult | null> {
  const ref = params.projectId
    ? doc(db, 'projects', params.projectId, 'releaseHarnessRuns', params.runId)
    : doc(db, 'users', params.userId, 'releaseHarnessRuns', params.runId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() as ReleaseHarnessResult : null;
}
