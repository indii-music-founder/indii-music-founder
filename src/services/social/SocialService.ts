import { db, auth } from '@/services/firebase';
import {
    collection,
    doc,
    addDoc,
    deleteDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    runTransaction,
    increment,
    Timestamp
} from 'firebase/firestore';
import { SocialPost, SocialConnection, SocialStats } from './types';
import { UserService } from '@/services/UserService';
import { useStore } from '@/core/store';

export class SocialService {

    /**
     * Follow a user
     */
    static async followUser(targetUserId: string): Promise<void> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) throw new Error("Must be logged in to follow");
        if (currentUserId === targetUserId) throw new Error("Cannot follow yourself");

        const connectionRef = doc(db, 'users', currentUserId, 'following', targetUserId);
        const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

        await runTransaction(db, async (transaction) => {
            const connectionDoc = await transaction.get(connectionRef);
            if (connectionDoc.exists()) return; // Already following

            // Add 'following' record for current user
            transaction.set(connectionRef, {
                userId: currentUserId,
                targetId: targetUserId,
                status: 'following',
                timestamp: serverTimestamp()
            });

            // Add 'follower' record for target user
            transaction.set(followerRef, {
                userId: targetUserId, // The user being likely followed (contextual owner)
                followerId: currentUserId,
                status: 'following',
                timestamp: serverTimestamp()
            });

            // Update stats
            const currentUserRef = doc(db, 'users', currentUserId);
            const targetUserRef = doc(db, 'users', targetUserId);

            transaction.update(currentUserRef, { 'socialStats.following': increment(1) });
            transaction.update(targetUserRef, { 'socialStats.followers': increment(1) });
        });
    }

    /**
     * Unfollow a user
     */
    static async unfollowUser(targetUserId: string): Promise<void> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) throw new Error("Must be logged in to unfollow");

        const connectionRef = doc(db, 'users', currentUserId, 'following', targetUserId);
        const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

        await runTransaction(db, async (transaction) => {
            const connectionDoc = await transaction.get(connectionRef);
            if (!connectionDoc.exists()) return; // Not following

            transaction.delete(connectionRef);
            transaction.delete(followerRef);

            // Update stats
            const currentUserRef = doc(db, 'users', currentUserId);
            const targetUserRef = doc(db, 'users', targetUserId);

            // Use negative increment
            transaction.update(currentUserRef, { 'socialStats.following': increment(-1) });
            transaction.update(targetUserRef, { 'socialStats.followers': increment(-1) });
        });
    }

    /**
     * Create a new post
     */
    static async createPost(content: string, mediaUrls: string[] = [], productId?: string): Promise<string> {
        const currentUser = useStore.getState().user;
        if (!currentUser) throw new Error("Must be logged in to post");

        const postData = {
            authorId: currentUser.uid,
            authorName: currentUser.displayName || 'Anonymous',
            authorAvatar: currentUser.photoURL || null,
            content,
            mediaUrls,
            productId: productId || null,
            likes: 0,
            commentsCount: 0,
            timestamp: serverTimestamp()
        };

        // Add to global 'posts' collection (and ideally user's subcollection or performing fan-out)
        // For MVP, global collection indexed by authorId is fine.
        const postRef = await addDoc(collection(db, 'posts'), postData);

        // Update user's post count
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            'socialStats.posts': increment(1),
            ...(productId && { 'socialStats.drops': increment(1) })
        });

        return postRef.id;
    }

    /**
     * Get Feed
     * @param userId If provided, gets specific user's posts. If null, gets Home Feed (friends + recommended).
     */
    static async getFeed(userId?: string): Promise<SocialPost[]> {
        let q;
        const postsRef = collection(db, 'posts');

        if (userId) {
            // Profile Feed
            q = query(
                postsRef,
                where('authorId', '==', userId),
                orderBy('timestamp', 'desc'),
                limit(20)
            );
        } else {
            // Home Feed (MVP: Global Feed or Just recent posts)
            // Real implementation requires fan-out or querying 'following' list.
            // For Alpha, we'll return global latest posts.
            q = query(
                postsRef,
                orderBy('timestamp', 'desc'),
                limit(50)
            );
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: (data.timestamp as Timestamp)?.toMillis() || Date.now()
            } as SocialPost;
        });
    }

    /**
     * Check if currently following a user
     */
    static async isFollowing(targetUserId: string): Promise<boolean> {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return false;

        const docRef = doc(db, 'users', currentUserId, 'following', targetUserId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists();
    }
}
