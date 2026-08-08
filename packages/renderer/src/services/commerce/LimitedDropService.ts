import { z } from 'zod';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

export const LIMITED_DROP_NOTIFICATION_STATUS = 'setup_required' as const;

const LimitedDropDraftInputSchema = z.object({
    selectedProductIds: z.array(z.string().trim().min(1)).min(1).max(50),
    dropName: z.string().trim().min(1, 'Enter a drop name.').max(200),
    dropDateTime: z.date().refine(
        value => Number.isFinite(value.getTime()) && value.getTime() > Date.now(),
        'Choose a future drop date and time.',
    ),
    presaleEnabled: z.boolean(),
    superfanOnly: z.boolean(),
    countdownMessage: z.string().trim().max(500),
}).strict();

export type LimitedDropDraftInput = z.input<typeof LimitedDropDraftInputSchema>;

export interface LimitedDropDraftResult {
    dropId: string;
    status: 'draft';
    notificationStatus: typeof LIMITED_DROP_NOTIFICATION_STATUS;
}

export class LimitedDropService {
    async createDraft(input: LimitedDropDraftInput): Promise<LimitedDropDraftResult> {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            throw new Error('Sign in to save a limited-drop draft.');
        }

        const parsed = LimitedDropDraftInputSchema.parse(input);
        const selectedProductIds = [...new Set(parsed.selectedProductIds)];

        const dropRef = await addDoc(collection(db, 'limitedDrops'), {
            userId: uid,
            selectedProductIds,
            dropName: parsed.dropName,
            dropDateTime: Timestamp.fromDate(parsed.dropDateTime),
            presaleEnabled: parsed.presaleEnabled,
            superfanOnly: parsed.superfanOnly,
            countdownMessage: parsed.countdownMessage,
            status: 'draft',
            notificationStatus: LIMITED_DROP_NOTIFICATION_STATUS,
            notificationProvider: 'none',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return {
            dropId: dropRef.id,
            status: 'draft',
            notificationStatus: LIMITED_DROP_NOTIFICATION_STATUS,
        };
    }
}

export const limitedDropService = new LimitedDropService();
