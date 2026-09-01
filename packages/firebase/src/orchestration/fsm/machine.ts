import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

// Lazy Firestore handle: a bare getFirestore() at module top level throws at
// import time in test environments (import-crash class, see 2179e43a).
function getDb() {
  return getFirestore();
}

// PACKAGE_STAGED (ISSUE-860): DDEX payloads exist in Storage but nothing has
// been delivered to a DSP. MONITORING requires a real delivery/acknowledgement.
export type FSMState = 'IDLE' | 'ANALYZING' | 'GENERATING_ASSETS' | 'DISTRIBUTING' | 'PACKAGE_STAGED' | 'MONITORING' | 'COMPLETED' | 'FAILED';

export interface CampaignContext {
    releaseId: string;
    state: FSMState;
    retries: number;
    error?: string;
    lastUpdated: string;
}

/**
 * Finite State Machine for Campaign/Audience/Pitch Agents
 * Manages autonomous transitions between states based on asynchronous task completion.
 */
export class CampaignFSM {
    constructor(private releaseId: string) {}

    async getState(): Promise<CampaignContext> {
        const doc = await getDb().collection('campaign_fsm').doc(this.releaseId).get();
        if (!doc.exists) {
            return { releaseId: this.releaseId, state: 'IDLE', retries: 0, lastUpdated: new Date().toISOString() };
        }
        return doc.data() as CampaignContext;
    }

    async transition(newState: FSMState, error?: string): Promise<void> {
        const db = getDb();
        const docRef = db.collection('campaign_fsm').doc(this.releaseId);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            let context: CampaignContext;
            if (!snap.exists) {
                context = { releaseId: this.releaseId, state: 'IDLE', retries: 0, lastUpdated: new Date().toISOString() };
            } else {
                context = snap.data() as CampaignContext;
            }

            // Basic state validation rules
            if (context.state === 'COMPLETED') {
                throw new HttpsError('failed-precondition', 'Cannot transition a completed campaign.');
            }

            const updates: Partial<CampaignContext> = {
                releaseId: this.releaseId,
                state: newState,
                retries: newState === 'FAILED' && error ? context.retries + 1 : context.retries,
                lastUpdated: new Date().toISOString()
            };

            if (error) {
                updates.error = error;
            }

            tx.set(docRef, updates, { merge: true });
        });
        console.log(`Campaign ${this.releaseId} transitioned to ${newState}`);
    }
}
