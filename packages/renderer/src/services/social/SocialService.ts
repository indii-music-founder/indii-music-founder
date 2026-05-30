import { db } from "@/services/firebase";
import {
  collection,
  doc,
  addDoc,
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
   * Follow a user
   */
  static async followUser(targetUserId: string): Promise<void> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id) throw new Error("User not authenticated");
    const currentUserId = userProfile.id;

    const connectionRef = doc(
      db,
      "users",
      currentUserId,
      "following",
      targetUserId,
    );
    const followerRef = doc(
      db,
      "users",
      targetUserId,
      "followers",
      currentUserId,
    );

    await runTransaction(db, async (transaction) => {
      const connectionDoc = await transaction.get(connectionRef);
      if (connectionDoc.exists()) return; // Already following

      transaction.set(connectionRef, {
        timestamp: serverTimestamp(),
      });
      transaction.set(followerRef, {
        timestamp: serverTimestamp(),
      });

      // Update stats
      const currentUserRef = doc(db, "users", currentUserId);
      const targetUserRef = doc(db, "users", targetUserId);

      transaction.update(currentUserRef, {
        "socialStats.following": increment(1),
      });
      transaction.update(targetUserRef, {
        "socialStats.followers": increment(1),
      });
    });
  }

  /**
   * Get Social Dashboard Stats
   */
  static async getDashboardStats(): Promise<SocialStats> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id)
      return { followers: 0, following: 0, posts: 0, drops: 0 };

    const userRef = doc(db, "users", userProfile.id);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists() && snapshot.data().socialStats) {
      return snapshot.data().socialStats as SocialStats;
    }

    // Return calculated/real stats if no specific stats exist
    // Note: Real reach/engagement would come from an aggregation document or external API
    return {
      followers:
        snapshot.exists() && snapshot.data().socialStats?.followers
          ? snapshot.data().socialStats.followers
          : 0,
      following:
        snapshot.exists() && snapshot.data().socialStats?.following
          ? snapshot.data().socialStats.following
          : 0,
      posts:
        snapshot.exists() && snapshot.data().socialStats?.posts
          ? snapshot.data().socialStats.posts
          : 0,
      drops:
        snapshot.exists() && snapshot.data().socialStats?.drops
          ? snapshot.data().socialStats.drops
          : 0,
    };
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
    const mediaUrl = validPost.imageAsset?.imageUrl;

    const docRef = await addDoc(collection(db, "scheduledPosts"), {
      userId: userProfile.id,
      authorId: userProfile.id,
      platform: deliveryPlatform,
      copy: validPost.copy,
      text: validPost.copy,
      mediaUrl: mediaUrl || null,
      mediaType: mediaUrl ? "image" : null,
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
    /**
     * Unfollow a user
     */
  static async unfollowUser(targetUserId: string): Promise<void> {
    const { useStore } = await import("@/core/store");
    const userProfile = useStore.getState().userProfile;
    if (!userProfile?.id) throw new Error("User not authenticated");
    const currentUserId = userProfile.id;

    const connectionRef = doc(
      db,
      "users",
      currentUserId,
      "following",
      targetUserId,
    );
    const followerRef = doc(
      db,
      "users",
      targetUserId,
      "followers",
      currentUserId,
    );

    await runTransaction(db, async (transaction) => {
      const connectionDoc = await transaction.get(connectionRef);
      if (!connectionDoc.exists()) return; // Not following

      transaction.delete(connectionRef);
      transaction.delete(followerRef);

      // Update stats
      const currentUserRef = doc(db, "users", currentUserId);
      const targetUserRef = doc(db, "users", targetUserId);

      // Use negative increment
      transaction.update(currentUserRef, {
        "socialStats.following": increment(-1),
      });
      transaction.update(targetUserRef, {
        "socialStats.followers": increment(-1),
      });
    });
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

    // Update user's post count
    const userRef = doc(db, "users", userProfile.id);
    await updateDoc(userRef, {
      "socialStats.posts": increment(1),
      ...(productId && { "socialStats.drops": increment(1) }),
    });

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
      // Fetch the current user's following list, then query posts by those author IDs
      const { useStore } = await import("@/core/store");
      const currentUser = useStore.getState().userProfile;

      if (!currentUser?.id) {
        // Not logged in — return empty feed
        return [];
      }

      // Get all user IDs this user follows
      const followingSnap = await getDocs(
        collection(db, `users/${currentUser.id}/following`),
      );
      const followingIds = followingSnap.docs.map((d) => d.id);

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
          const data = d.data() as any;
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
      const data = doc.data() as any;
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

    const docRef = doc(db, "users", currentUserId, "following", targetUserId);
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
      collection(db, `users/${userId}/following`),
    );

    const stats: SocialStats = {
      posts: postsSnap.size,
      following: followingSnap.size,
      followers: 0, // Need collection for this
      drops: postsSnap.docs.filter((doc) => !!doc.data().productId).length,
    };

    await setDoc(
      doc(db, "users", userId),
      { socialStats: stats },
      { merge: true },
    );
    return stats;
  }

  /**
   * Seed social database logic (REMOVED: Use real data only)
   */
  static async seedDatabase(userId: string): Promise<void> {
    // No-op to prevent hardcoded stub data
  }
}
