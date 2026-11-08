import { db } from "@/services/firebase";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  increment,
  Timestamp,
  setDoc,
} from "firebase/firestore";
import {
  SocialPost,
  SocialStats,
  ScheduledPost,
  CampaignStatus,
} from "./types";
import { ScheduledPostSchema, CreatePostRequestSchema } from "@/modules/social/schemas";
import { validateInstagramPublishingPayload, type InstagramPublishingPayload } from '@indii/shared';

type DeliveryPlatform = "twitter" | "instagram";

function toDeliveryPlatform(platform: ScheduledPost["platform"]): DeliveryPlatform {
  if (platform === "Twitter") return "twitter";
  if (platform === "Instagram") return "instagram";
  throw new Error(`Native scheduled delivery is not configured for ${platform}.`);
}

function fromDeliveryDoc(id: string, data: Record<string, unknown>): ScheduledPost {
  const platform = data.platform === "instagram" ? "Instagram" : "Twitter";
  const scheduledAt = data.scheduledAt as { toMillis?: () => number } | undefined;
  const scheduledTime = typeof data.scheduledTime === "number"
    ? data.scheduledTime
    : scheduledAt?.toMillis?.();

  return {
    id,
    platform,
    copy: String(data.copy || data.text || ""),
    imageAsset: data.mediaUrl ? {
      assetType: "image",
      title: "Scheduled media",
      imageUrl: String(data.mediaUrl),
      caption: String(data.copy || data.text || ""),
    } : undefined,
    day: typeof data.day === "number" ? data.day : 1,
    scheduledTime,
    status: CampaignStatus.PENDING,
    errorMessage: typeof data.deliveryError === "string" ? data.deliveryError : undefined,
    postId: typeof data.platformPostId === "string" ? data.platformPostId : undefined,
    authorId: String(data.authorId || data.userId || ""),
  };
}

export class SocialService {
  /**
   * Follow a user using the canonical public social_follows collection
   */
  static async followUser(targetUserId: string): Promise<void> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id) throw new Error("User not authenticated");
    const currentUserId = userProfile.id;
    if (currentUserId === targetUserId) throw new Error("Cannot follow yourself");

    const followId = `${currentUserId}_${targetUserId}`;
    const followDoc = doc(db, "social_follows", followId);
    await setDoc(followDoc, {
      followerId: currentUserId,
      followingId: targetUserId,
      timestamp: serverTimestamp(),
    });
  }

  /**
   * Unfollow a user
   */
  static async unfollowUser(targetUserId: string): Promise<void> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id) throw new Error("User not authenticated");
    const currentUserId = userProfile.id;

    const followId = `${currentUserId}_${targetUserId}`;
    await deleteDoc(doc(db, "social_follows", followId));
  }

  /**
   * Get Social Dashboard Stats
   */
  static async getDashboardStats(): Promise<SocialStats> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id)
      return { followers: 0, following: 0, posts: 0, drops: 0 };

    const statsRef = doc(db, "social_stats", userProfile.id);
    const snapshot = await getDoc(statsRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        followers: typeof data.followers === "number" ? data.followers : 0,
        following: typeof data.following === "number" ? data.following : 0,
        posts: typeof data.posts === "number" ? data.posts : 0,
        drops: typeof data.drops === "number" ? data.drops : 0,
      };
    }

    return this.recalculateStats(userProfile.id);
  }

  /**
   * Schedule a post
   */
  static async schedulePost(
    post: Omit<ScheduledPost, "id" | "status" | "authorId">,
  ): Promise<string> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id) throw new Error("User not authenticated");

    // Prepare data for validation
    const rawPost = {
      ...post,
      authorId: userProfile.id,
      status: CampaignStatus.PENDING
    };

    // Zod Validation
    const validation = ScheduledPostSchema.safeParse(rawPost);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map(i => i.message).join(', ');
      throw new Error(`Invalid post data: ${errorMsg}`);
    }

    const validPost = validation.data;
    const deliveryPlatform = toDeliveryPlatform(validPost.platform);
    const scheduledTime = validPost.scheduledTime || Date.now();
    const brandAssets = userProfile.brandKit?.brandAssets;
    let mediaUrl = validPost.imageAsset?.imageUrl;
    if (deliveryPlatform === 'instagram' && !mediaUrl && brandAssets?.length) {
      mediaUrl = brandAssets[brandAssets.length - 1]?.url;
    }
    const instagramPayload = validPost.instagramPayload as InstagramPublishingPayload | undefined;
    if (deliveryPlatform === 'instagram' && !instagramPayload) {
      throw new Error('Instagram scheduling requires validated publishing metadata from the composer.');
    }
    if (instagramPayload) {
      const policy = validateInstagramPublishingPayload(instagramPayload);
      if (!policy.valid) throw new Error(`Instagram policy rejected this post: ${policy.errors.join(' ')}`);
    }

    const docRef = await addDoc(collection(db, "scheduledPosts"), {
      userId: userProfile.id,
      authorId: userProfile.id,
      platform: deliveryPlatform,
      copy: validPost.copy,
      text: validPost.copy,
      mediaUrl: mediaUrl || null,
      mediaType: mediaUrl ? "image" : null,
      ...(instagramPayload ? {
        mediaType: instagramPayload.surface === 'feed' ? 'image' : instagramPayload.surface,
        hashtags: instagramPayload.hashtags,
        instagramPayload,
        ...(instagramPayload.surface === 'story' ? { storyTtlHours: instagramPayload.storyExtend ? 48 : 24 } : {}),
      } : {}),
      day: validPost.day || 1,
      scheduledTime,
      scheduledAt: Timestamp.fromMillis(scheduledTime),
      status: "pending",
      source: "social_dashboard",
      retryCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Get Scheduled Posts
   */
  static async getScheduledPosts(userId?: string): Promise<ScheduledPost[]> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    const targetUserId = userId || userProfile?.id;

    if (!targetUserId) return [];

    const q = query(
      collection(db, "scheduledPosts"),
      where("userId", "==", targetUserId),
      where("status", "==", "pending"),
      orderBy("scheduledAt", "asc"),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => fromDeliveryDoc(doc.id, doc.data()));
  }

  /**
   * Create a new post
   */
  static async createPost(
    content: string,
    mediaUrls: string[] = [],
    productId?: string,
  ): Promise<string> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id) throw new Error("User not authenticated");
    const authorName = userProfile.displayName?.trim();
    if (!authorName) throw new Error("Display name is required to create a social post.");

    // Validate Input
    const validation = CreatePostRequestSchema.safeParse({ content, mediaUrls, productId });
    if (!validation.success) {
      throw new Error(`Invalid post content: ${validation.error.issues[0]!.message}`);
    }

    const postData = {
      authorId: userProfile.id,
      authorName,
      authorAvatar: userProfile.photoURL || null,
      content,
      mediaUrls,
      productId: productId || null,
      likes: 0,
      commentsCount: 0,
      timestamp: serverTimestamp(),
    };

    // Add to global 'posts' collection (and ideally user's subcollection or performing fan-out)
    // For MVP, global collection indexed by authorId is fine.
    const postRef = await addDoc(collection(db, "posts"), postData);
    return postRef.id;
  }

  /**
   * Get Feed
   * @param userId If provided, gets specific user's posts. If null, gets Home Feed (friends + recommended).
   */
  static async getFeed(
    userId?: string,
    filter: "all" | "following" | "mine" = "all",
  ): Promise<SocialPost[]> {
    const postsRef = collection(db, "posts");
    let q;

    if (userId) {
      // Specific user's feed (Profile or 'Mine' tab)
      q = query(
        postsRef,
        where("authorId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(50),
      );
    } else if (filter === "following") {
      // Fetch the current user's following list from canonical social_follows, then query posts by those author IDs
      const { useStore } = await import("@/core/store");
      const currentUser = useStore.getState().userProfile;

      if (!currentUser?.id) {
        // Not logged in — return empty feed
        return [];
      }

      // Get all user IDs this user follows from canonical social_follows
      const followingSnap = await getDocs(
        query(
          collection(db, "social_follows"),
          where("followerId", "==", currentUser.id),
        ),
      );
      const followingIds = followingSnap.docs
        .map((d) => (d.data()?.followingId as string))
        .filter(Boolean);

      if (followingIds.length === 0) {
        // User doesn't follow anyone — return empty feed
        return [];
      }

      // Firestore 'in' queries support max 30 values, so batch if needed
      const batchSize = 30;
      const allPosts: SocialPost[] = [];

      for (let i = 0; i < followingIds.length; i += batchSize) {
        const batch = followingIds.slice(i, i + batchSize);
        const batchQuery = query(
          postsRef,
          where("authorId", "in", batch),
          orderBy("timestamp", "desc"),
          limit(50),
        );
        const batchSnap = await getDocs(batchQuery);
        batchSnap.docs.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          allPosts.push({
            id: d.id,
            ...data,
            timestamp: (data.timestamp as Timestamp)?.toMillis() || Date.now(),
          } as SocialPost);
        });
      }

      // Sort combined results by timestamp descending and take top 50
      allPosts.sort((a, b) => b.timestamp - a.timestamp);
      return allPosts.slice(0, 50);
    } else {
      // 'all' or fallback Home Feed
      q = query(postsRef, orderBy("timestamp", "desc"), limit(50));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp)?.toMillis() || Date.now(),
      } as SocialPost;
    });
  }

  /**
   * Check if currently following a user
   */
  static async isFollowing(targetUserId: string): Promise<boolean> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id) return false;
    const currentUserId = userProfile.id;

    const followId = `${currentUserId}_${targetUserId}`;
    const docRef = doc(db, "social_follows", followId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists();
  }

  /**
   * Manually recalculate stats for a user.
   */
  static async recalculateStats(userId: string): Promise<SocialStats> {
    const postsSnap = await getDocs(
      query(collection(db, "posts"), where("authorId", "==", userId)),
    );
    const followingSnap = await getDocs(
      query(collection(db, "social_follows"), where("followerId", "==", userId)),
    );
    const followersSnap = await getDocs(
      query(collection(db, "social_follows"), where("followingId", "==", userId)),
    );

    const stats: SocialStats = {
      posts: postsSnap.size,
      following: followingSnap.size,
      followers: followersSnap.size,
      drops: postsSnap.docs.filter((doc) => !!doc.data().productId).length,
    };

    return stats;
  }

  /**
   * Seed social database logic (REMOVED: Use real data only)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async seedDatabase(userId: string): Promise<void> {
    // No-op to prevent hardcoded stub data
  }
}
