import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { SocialService } from '@/services/social/SocialService';
import { SocialStats, ScheduledPost, SocialPost } from '@/services/social/types';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import * as Sentry from '@sentry/react';

export function useSocial(userId?: string) {
    const { userProfile } = useStore();
    const toast = useToast();

    // State
    const [stats, setStats] = useState<SocialStats>({ followers: 0, following: 0, posts: 0, drops: 0 });
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);

    // Loading States
    const [isLoading, setIsLoading] = useState(true);
    const [isFeedLoading, setIsFeedLoading] = useState(true);

    // Filters
    const [filter, setFilter] = useState<'all' | 'following' | 'mine'>('all');
    const [error, setError] = useState<string | null>(null);

    const loadDashboardData = useCallback(async () => {
        if (!userProfile?.id) return;

        try {
            // Seed if empty
            await SocialService.seedDatabase(userProfile.id);

            const [fetchedStats, fetchedScheduled] = await Promise.all([
                SocialService.getDashboardStats(),
                SocialService.getScheduledPosts(userProfile.id)
            ]);

            setStats(fetchedStats);
            setScheduledPosts(fetchedScheduled);
        } catch (err) {
            console.error("Failed to load social dashboard:", err);
            Sentry.captureException(err);
            toast.error("Failed to load dashboard stats.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile?.id]);

    const loadFeed = useCallback(async () => {
        setIsFeedLoading(true);
        try {
            const targetId = filter === 'mine' ? userProfile?.id : userId;
            const fetchedPosts = await SocialService.getFeed(targetId, filter);
            setPosts(fetchedPosts);
        } catch (err) {
            console.error("Failed to load feed:", err);
            Sentry.captureException(err);
            toast.error("Failed to refresh feed.");
        } finally {
            setIsFeedLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, userId, userProfile?.id]);

    // Real-time Data Sync
    useEffect(() => {
        if (!userProfile?.id) return;
        const targetId = filter === 'mine' ? userProfile.id : userId;

        // 1. Stats Listener (User Document)
        const userUnsub = onSnapshot(doc(db, "users", userProfile.id), (doc) => {
            if (doc.exists() && doc.data().socialStats) {
                setStats(doc.data().socialStats as SocialStats);
            }
        });

        // 2. Scheduled Posts Listener
        const scheduledQuery = query(
            collection(db, "scheduled_posts"),
            where("authorId", "==", userProfile.id),
            where("status", "==", "PENDING"),
            orderBy("scheduledTime", "asc")
        );

        const scheduledUnsub = onSnapshot(scheduledQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ScheduledPost[];
            setScheduledPosts(data);
        });

        // 3. Feed Listener
        const postsRef = collection(db, "posts");
        let postsQuery;

        if (targetId) {
            postsQuery = query(postsRef, where("authorId", "==", targetId), orderBy("timestamp", "desc"), limit(50));
        } else {
            // Fallback/All query
            postsQuery = query(postsRef, orderBy("timestamp", "desc"), limit(50));
        }

        const feedUnsub = onSnapshot(postsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    timestamp: d.timestamp?.toMillis ? d.timestamp.toMillis() : Date.now()
                };
            }) as SocialPost[];
            setPosts(data);
            setIsFeedLoading(false);
            setIsLoading(false);
        }, (err) => {
            console.error("Feed error:", err);
            Sentry.captureException(err);
            setError("Failed to stream feed.");
            setIsFeedLoading(false);
        });

        return () => {
            userUnsub();
            scheduledUnsub();
            feedUnsub();
        };
    }, [userProfile?.id, userId, filter]);

    // Actions
    const schedulePost = useCallback(async (post: Omit<ScheduledPost, 'id' | 'status' | 'authorId'>) => {
        if (!userProfile?.id) {
            toast.error("You must be logged in to schedule posts.");
            return false;
        }

        try {
            await SocialService.schedulePost(post);
            toast.success("Post scheduled successfully!");
            loadDashboardData(); // Refresh calendar data
            return true;
        } catch (err) {
            console.error("Error scheduling post:", err);
            Sentry.captureException(err);
            toast.error("Failed to schedule post.");
            return false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile?.id, loadDashboardData]);

    const createPost = useCallback(async (content: string, mediaUrls: string[] = [], productId?: string) => {
        try {
            await SocialService.createPost(content, mediaUrls, productId);
            toast.success("Post published!");
            loadFeed(); // Refresh feed immediately
            loadDashboardData(); // Update stats
            return true;
        } catch (err) {
            console.error("Failed to create post:", err);
            Sentry.captureException(err);
            toast.error("Failed to publish post.");
            return false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadFeed, loadDashboardData]);

    return {
        // Data
        stats,
        posts,
        scheduledPosts,

        // UI State
        isLoading, // Global initial load
        isFeedLoading, // Specific feed updates
        error,
        filter,
        setFilter,

        // Actions
        actions: {
            schedulePost,
            createPost,
            refreshDashboard: loadDashboardData,
            refreshFeed: loadFeed
        }
    };
}
