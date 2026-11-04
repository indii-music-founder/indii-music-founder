import { describe, expect, it, vi } from 'vitest';

vi.unmock('firebase/firestore');
import { arrayUnion, increment, serverTimestamp, Timestamp } from 'firebase/firestore';
import { cleanFirestoreData } from './firebase';

describe('cleanFirestoreData', () => {
    it('removes undefined values without copying Firestore sentinels into plain objects', () => {
        const timestamp = serverTimestamp();
        const append = arrayUnion({ title: 'artist note' });
        const count = increment(2);
        const recordedAt = Timestamp.fromMillis(1234);

        const cleaned = cleanFirestoreData({
            missing: undefined,
            createdAt: timestamp,
            recordedAt,
            nested: { append, count, missing: undefined },
            rows: [{ value: 1, missing: undefined }]
        });

        expect(cleaned).not.toHaveProperty('missing');
        expect(cleaned.nested).not.toHaveProperty('missing');
        expect(cleaned.rows).toEqual([{ value: 1 }]);
        expect(cleaned.createdAt).toBe(timestamp);
        expect(cleaned.recordedAt).toBe(recordedAt);
        expect(cleaned.nested.append).toBe(append);
        expect(cleaned.nested.count).toBe(count);
    });
});
