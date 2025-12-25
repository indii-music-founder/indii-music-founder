import { db } from '../firebase';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    getDoc,
    setDoc,
    deleteDoc
} from 'firebase/firestore';
import { SocialPost, SocialComment, SocialConnection } from './types';

export class SocialService {
    private static POSTS_COLLECTION = 'posts';
    private static CONNECTIONS_COLLECTION = 'connections';
    private static COMMENTS_COLLECTION = 'comments';

    /**
     * Follow a user
     */
    static async followUser(followerId: string, followingId: string): Promise<void> {
        const connectionId = `${followerId}_${followingId}`;
        const connectionRef = doc(db, this.CONNECTIONS_COLLECTION, connectionId);

        await setDoc(connectionRef, {
            followerId,
            followingId,
            createdAt: serverTimestamp()
        });
    }

    /**
     * Unfollow a user
     */
    static async unfollowUser(followerId: string, followingId: string): Promise<void> {
        const connectionId = `${followerId}_${followingId}`;
        await deleteDoc(doc(db, this.CONNECTIONS_COLLECTION, connectionId));
    }

    /**
     * Create a new post
     */
    static async createPost(post: Omit<SocialPost, 'id' | 'createdAt' | 'likes' | 'commentCount'>): Promise<string> {
        const postsRef = collection(db, this.POSTS_COLLECTION);
        const newPost = {
            ...post,
            likes: [],
            commentCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(postsRef, newPost);
        return docRef.id;
    }

    /**
     * Get Feed (posts from people you follow)
     * Note: Firestore 'in' queries are limited to 10 items. 
     * For production, we would duplicate posts to user feeds (Fan-out) or use a dedicated feed service.
     * For MVP, we'll fetch connections first, then fetch posts (naive implementation).
     */
    static async getFeed(userId: string, limitCount: number = 20): Promise<SocialPost[]> {
        // 1. Get who I follow
        const connectionsRef = collection(db, this.CONNECTIONS_COLLECTION);
        const qConnections = query(connectionsRef, where('followerId', '==', userId));
        const connectionsSnap = await getDocs(qConnections);

        const followingIds = connectionsSnap.docs.map(d => d.data().followingId);

        if (followingIds.length === 0) {
            return []; // Follow no one
        }

        // 2. Fetch posts from these authors
        // Firestore limitation: cannot filter by > 10 IDs in 'in' clause.
        // We will chunk it or just fetch top posts if the list is small. 
        // For MVP, just fetching recent posts from ALL and filtering in memory if list is small, 
        // OR limiting to top 10 friends.

        const safeFollowingIds = followingIds.slice(0, 10); // Limit for MVP

        const postsRef = collection(db, this.POSTS_COLLECTION);
        const qPosts = query(
            postsRef,
            where('authorId', 'in', safeFollowingIds),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const postsSnap = await getDocs(qPosts);
        return postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));
    }

    /**
     * Get posts for a specific profile (Artist Wall)
     */
    static async getProfilePosts(authorId: string, limitCount: number = 20): Promise<SocialPost[]> {
        const postsRef = collection(db, this.POSTS_COLLECTION);
        const q = query(
            postsRef,
            where('authorId', '==', authorId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));
    }

    /**
     * Like a post
     */
    static async toggleLike(postId: string, userId: string): Promise<boolean> {
        const postRef = doc(db, this.POSTS_COLLECTION, postId);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) return false;

        const data = postSnap.data() as SocialPost;
        const likes = data.likes || [];
        const isLiked = likes.includes(userId);

        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(userId) });
            return false;
        } else {
            await updateDoc(postRef, { likes: arrayUnion(userId) });
            return true;
        }
    }
}
