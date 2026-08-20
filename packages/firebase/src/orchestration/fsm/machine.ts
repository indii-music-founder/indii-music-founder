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
        const context = await this.getState();
        
        // Basic state validation rules
        if (context.state === 'COMPLETED') {
            throw new HttpsError('failed-precondition', 'Cannot transition a completed campaign.');
        }

        const updates: Partial<CampaignContext> = {
            state: newState,
            lastUpdated: new Date().toISOString()
        };

        if (error) {
            updates.error = error;
            if (newState === 'FAILED') updates.retries = context.retries + 1;
        }

            const doc = await getDb().collection('campaign_fsm').doc(this.releaseId).get();
            if (!doc.exists) {
                // If it doesn't exist, we must initialize the full default state so merge:true doesn't leave orphaned properties
                Object.assign(updates, {
                    releaseId: this.releaseId,
                    retries: 0
                });
            }

        await getDb().collection('campaign_fsm').doc(this.releaseId).set(updates, { merge: true });
        console.log(`Campaign ${this.releaseId} transitioned to ${newState}`);
    }
}
