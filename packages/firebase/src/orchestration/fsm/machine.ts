import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const db = getFirestore();

export type FSMState = 'IDLE' | 'ANALYZING' | 'GENERATING_ASSETS' | 'DISTRIBUTING' | 'MONITORING' | 'COMPLETED' | 'FAILED';

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
        const doc = await db.collection('campaign_fsm').doc(this.releaseId).get();
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

        await db.collection('campaign_fsm').doc(this.releaseId).set(updates, { merge: true });
        console.log(`Campaign ${this.releaseId} transitioned to ${newState}`);
    }
}
