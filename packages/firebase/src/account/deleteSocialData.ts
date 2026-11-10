import type { Firestore } from 'firebase-admin/firestore';

/** Remove social records connected to the account before deleting its auth identity. */
export async function deleteSocialData(db: Firestore, userId: string): Promise<number> {
    let deleted = 0;
    for (const [collection, field] of [
        ['posts', 'authorId'],
        ['social_follows', 'followerId'],
        ['social_follows', 'followingId'],
    ] as const) {
        for (;;) {
            const page = await db.collection(collection).where(field, '==', userId).limit(100).get();
            if (page.empty) break;
            for (const document of page.docs) {
                // A post may have child data; deleting only its parent leaves it behind.
                await db.recursiveDelete(document.ref);
                deleted++;
            }
        }
    }
    for (const collection of ['public_profiles', 'social_stats']) {
        await db.recursiveDelete(db.collection(collection).doc(userId));
    }
    return deleted;
}
