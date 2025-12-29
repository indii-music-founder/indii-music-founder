import { useState, useCallback, useEffect } from 'react';
import { SocialService } from '@/services/social/SocialService';
import { SocialPost, SocialStats, ScheduledPost } from '@/services/social/types';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';

export function useSocial(userId?: string) {
    const toast = useToast();
    const userProfile = useStore((state) => state.userProfile);

    // Feed State
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'following' | 'mine'>('all');

    // Dashboard State
    const [stats, setStats] = useState<SocialStats | null>(null);
    const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
    const [dashboardLoading, setDashboardLoading] = useState(true);

    /**
     * Load Main Feed
     */
    const loadFeed = useCallback(async () => {
        setFeedLoading(true);
        try {
            // Determine target ID based on filter
            // If filter is 'mine', use current user profile ID
            // If filter is 'following', SocialService likely handles logic, but usually needs a user context
            // If userId is passed (viewing another profile), that takes precedence unless filter overrides

            const targetId = filter === 'mine' ? userProfile?.id : userId;

            const fetchedPosts = await SocialService.getFeed(targetId, filter);
            setPosts(fetchedPosts);
        } catch (error) {
            console.error("Failed to load social feed:", error);
            toast.error("Failed to refresh feed");
        } finally {
            setFeedLoading(false);
        }
    }, [filter, userProfile?.id, userId, toast]);

    /**
     * Load Dashboard Stats & Scheduled Posts
     */
    const loadDashboardData = useCallback(async () => {
        setDashboardLoading(true);
        try {
            const [statsData, postsData] = await Promise.all([
                SocialService.getDashboardStats(),
                SocialService.getScheduledPosts()
            ]);
            setStats(statsData);
            setScheduledPosts(postsData);
        } catch (error) {
            console.error("Failed to load dashboard data", error);
            toast.error("Failed to load dashboard stats");
        } finally {
            setDashboardLoading(false);
        }
    }, [toast]);

    /**
     * Create a new post
     */
    const createPost = useCallback(async (content: string, mediaUrls: string[] = [], productId?: string) => {
        try {
            await SocialService.createPost(content, mediaUrls, productId);
            toast.success("Post published!");
            loadFeed(); // Refresh feed
            return true;
        } catch (error) {
            console.error("Failed to create post:", error);
            toast.error("Failed to publish post");
            return false;
        }
    }, [loadFeed, toast]);

    /**
     * Schedule a post
     */
    const schedulePost = useCallback(async (post: Omit<ScheduledPost, 'id' | 'status' | 'authorId'>) => {
        try {
            // Convert Date to number if needed (handled by caller mostly, but type enforces number)
            await SocialService.schedulePost(post);
            toast.success("Post scheduled successfully!");
            loadDashboardData(); // Refresh calendar
            return true;
        } catch (error) {
            console.error("Failed to schedule post:", error);
            toast.error("Failed to schedule post");
            return false;
        }
    }, [loadDashboardData, toast]);

    // Initial Load Effects
    useEffect(() => {
        loadFeed();
    }, [loadFeed]);

    return {
        // Feed
        posts,
        feedLoading,
        filter,
        setFilter,
        refreshFeed: loadFeed,
        createPost,

        // Dashboard
        stats,
        scheduledPosts,
        dashboardLoading,
        refreshDashboard: loadDashboardData,
        schedulePost,
    };
}
