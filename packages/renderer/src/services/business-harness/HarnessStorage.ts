import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { BusinessActivityEvent, HarnessCostLine, HarnessRun } from './types';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined)) as T;
}

export async function saveHarnessRun<TOutput>(run: HarnessRun<TOutput>): Promise<string> {
  const target = run.projectId
    ? collection(db, 'projects', run.projectId, 'harnessRuns')
    : collection(db, 'users', run.userId, 'harnessRuns');

  const ref = await addDoc(target, stripUndefined({
    ...run,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function getHarnessRun(params: {
  userId: string;
  runId: string;
  projectId?: string;
}): Promise<HarnessRun | null> {
  const ref = params.projectId
    ? doc(db, 'projects', params.projectId, 'harnessRuns', params.runId)
    : doc(db, 'users', params.userId, 'harnessRuns', params.runId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() as HarnessRun : null;
}

export async function listRecentHarnessRuns(params: {
  userId: string;
  projectId?: string;
  count?: number;
}): Promise<HarnessRun[]> {
  const target = params.projectId
    ? collection(db, 'projects', params.projectId, 'harnessRuns')
    : collection(db, 'users', params.userId, 'harnessRuns');
  const q = query(target, orderBy('createdAt', 'desc'), limit(params.count ?? 20));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as HarnessRun);
}

export async function saveBusinessActivityEvent(event: BusinessActivityEvent): Promise<string> {
  const ref = await addDoc(collection(db, 'users', event.userId, 'businessActivityEvents'), stripUndefined({
    ...event,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

export async function saveBusinessCostLine(costLine: HarnessCostLine): Promise<string> {
  const ref = await addDoc(collection(db, 'users', costLine.userId, 'businessCostLines'), stripUndefined({
    ...costLine,
    createdAt: serverTimestamp(),
  }));
  return ref.id;
}

