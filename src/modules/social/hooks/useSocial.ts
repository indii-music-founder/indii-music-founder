import { useState, useEffect, useCallback } from 'react';
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
    }, [userProfile?.id, toast]);

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
    }, [filter, userId, userProfile?.id, toast]);

    // Initial Data Fetch
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            await Promise.all([loadDashboardData(), loadFeed()]);
            setIsLoading(false);
        };
        init();
    }, [loadDashboardData, loadFeed]);

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
    }, [userProfile?.id, loadDashboardData, toast]);

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
    }, [loadFeed, loadDashboardData, toast]);

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
