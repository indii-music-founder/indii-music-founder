import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { deleteSocialData } from './deleteSocialData';

// Emulator integration only: synthetic data does not prove a production deletion.
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('social deletion in Firestore emulator', () => {
    it('removes the account social records and preserves unrelated records', async () => {
        const app = initializeApp({ projectId: 'demo-indii-social-deletion' }, randomUUID());
        const db = getFirestore(app);
        const suffix = randomUUID();
        const subject = `subject-${suffix}`;
        const other = `other-${suffix}`;
        const ownPost = db.collection('posts').doc(`own-${suffix}`);
        const otherPost = db.collection('posts').doc(`other-${suffix}`);
        const outbound = db.collection('social_follows').doc(`out-${suffix}`);
        const inbound = db.collection('social_follows').doc(`in-${suffix}`);
        const unrelated = db.collection('social_follows').doc(`other-${suffix}`);
        const profile = db.collection('public_profiles').doc(subject);
        const stats = db.collection('social_stats').doc(subject);
        try {
            await Promise.all([
                ownPost.set({ authorId: subject }),
                ownPost.collection('comments').doc('child').set({ text: 'synthetic' }),
                otherPost.set({ authorId: other }),
                outbound.set({ followerId: subject, followingId: other }),
                inbound.set({ followerId: other, followingId: subject }),
                unrelated.set({ followerId: other, followingId: `third-${suffix}` }),
                profile.set({ displayName: 'synthetic' }),
                stats.set({ posts: 1 }),
            ]);
            await deleteSocialData(db, subject);
            for (const ref of [ownPost, ownPost.collection('comments').doc('child'), outbound, inbound, profile, stats]) {
                expect((await ref.get()).exists).toBe(false);
            }
            expect((await otherPost.get()).exists).toBe(true);
            expect((await unrelated.get()).exists).toBe(true);
        } finally {
            await Promise.all([db.recursiveDelete(ownPost), db.recursiveDelete(otherPost), db.recursiveDelete(outbound), db.recursiveDelete(inbound), db.recursiveDelete(unrelated), db.recursiveDelete(profile), db.recursiveDelete(stats)]);
            await deleteApp(app);
        }
    });
});
