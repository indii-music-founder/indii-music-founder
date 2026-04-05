/**
 * Item 233: YouTube Data API v3 Service
 *
 * Phase 1: Video metadata management and upload via YouTube Data API v3.
 * Phase 2: Browser agent for Content ID CMS (when partner access obtained).
 *
 * Uses googleapis npm package for YouTube API interactions.
 * OAuth2 is handled via Firebase Auth → Google provider tokens.
 *
 * Setup: Enable YouTube Data API v3 in GCP Console
 * Free quota: 10,000 units/day
 */

export interface YouTubeVideoMetadata {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;         // "10" = Music
    privacyStatus: 'public' | 'private' | 'unlisted';
    defaultLanguage?: string;
    madeForKids?: boolean;
    embeddable?: boolean;
    licenseType?: 'youtube' | 'creativeCommon';
}

export interface YouTubeUploadResult {
    videoId: string;
    channelId: string;
    title: string;
    status: string;
    publishedAt: string;
    thumbnailUrl: string;
}

export interface YouTubeChannel {
    channelId: string;
    title: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    thumbnailUrl: string;
}

export interface YouTubeVideo {
    videoId: string;
    title: string;
    description: string;
    publishedAt: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    duration: string;
    thumbnailUrl: string;
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export class YouTubeDataService {
    private apiKey: string;
    private accessToken: string | null = null;

    constructor() {
        // Uses Firebase API key for read-only operations
        this.apiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
    }

    /**
     * Set an OAuth2 access token for write operations (uploads, updates).
     * Obtained from Firebase Auth Google provider.
     */
    setAccessToken(token: string): void {
        this.accessToken = token;
    }

    /**
     * Check if authenticated for write operations.
     */
    isAuthenticated(): boolean {
        return this.accessToken !== null;
    }

    /**
     * Get headers for API requests.
     */
    private getHeaders(requireAuth: boolean = false): Record<string, string> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };

        if (requireAuth) {
            if (!this.accessToken) {
                throw new Error('OAuth2 access token required for this operation');
            }
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        return headers;
    }

    /**
     * Search for videos on YouTube.
     * Quota cost: 100 units per request.
     */
    async searchVideos(
        query: string,
        maxResults: number = 10,
        type: 'video' | 'channel' | 'playlist' = 'video'
    ): Promise<YouTubeVideo[]> {
        const params = new URLSearchParams({
            part: 'snippet',
            q: query,
            maxResults: maxResults.toString(),
            type,
            key: this.apiKey,
        });

        const response = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);

        if (!response.ok) {
            throw new Error(`YouTube search error: ${response.status}`);
        }

        const data = await response.json();
        return (data.items || []).map((item: Record<string, unknown>) => {
            const snippet = item.snippet as Record<string, unknown>;
            const id = item.id as Record<string, string>;
            return {
                videoId: id.videoId || '',
                title: snippet.title as string || '',
                description: snippet.description as string || '',
                publishedAt: snippet.publishedAt as string || '',
                viewCount: 0,
                likeCount: 0,
                commentCount: 0,
                duration: '',
                thumbnailUrl: ((snippet.thumbnails as Record<string, Record<string, string>>)?.default?.url) || '',
            };
        });
    }

    /**
     * Get detailed video statistics.
     * Quota cost: 1 unit per request.
     */
    async getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
        const params = new URLSearchParams({
            part: 'snippet,statistics,contentDetails',
            id: videoId,
            key: this.apiKey,
        });

        const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);

        if (!response.ok) {
            throw new Error(`YouTube video details error: ${response.status}`);
        }

        const data = await response.json();
        const item = data.items?.[0];
        if (!item) return null;

        const stats = item.statistics as Record<string, string>;
        const content = item.contentDetails as Record<string, string>;
        const snippet = item.snippet as Record<string, unknown>;

        return {
            videoId,
            title: snippet.title as string || '',
            description: snippet.description as string || '',
            publishedAt: snippet.publishedAt as string || '',
            viewCount: parseInt(stats.viewCount || '0'),
            likeCount: parseInt(stats.likeCount || '0'),
            commentCount: parseInt(stats.commentCount || '0'),
            duration: content.duration || '',
            thumbnailUrl: ((snippet.thumbnails as Record<string, Record<string, string>>)?.default?.url) || '',
        };
    }

    /**
     * Get channel details.
     * Quota cost: 1 unit per request.
     */
    async getChannelDetails(channelId: string): Promise<YouTubeChannel | null> {
        const params = new URLSearchParams({
            part: 'snippet,statistics',
            id: channelId,
            key: this.apiKey,
        });

        const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`);

        if (!response.ok) {
            throw new Error(`YouTube channel error: ${response.status}`);
        }

        const data = await response.json();
        const item = data.items?.[0];
        if (!item) return null;

        const stats = item.statistics as Record<string, string>;
        const snippet = item.snippet as Record<string, unknown>;

        return {
            channelId,
            title: snippet.title as string || '',
            subscriberCount: parseInt(stats.subscriberCount || '0'),
            videoCount: parseInt(stats.videoCount || '0'),
            viewCount: parseInt(stats.viewCount || '0'),
            thumbnailUrl: ((snippet.thumbnails as Record<string, Record<string, string>>)?.default?.url) || '',
        };
    }

    /**
     * Update video metadata (requires OAuth2 token).
     * Quota cost: 50 units per request.
     */
    async updateVideoMetadata(
        videoId: string,
        metadata: Partial<YouTubeVideoMetadata>
    ): Promise<void> {
        const body: Record<string, unknown> = {
            id: videoId,
        };

        if (metadata.title || metadata.description || metadata.tags || metadata.categoryId) {
            body.snippet = {
                ...(metadata.title && { title: metadata.title }),
                ...(metadata.description && { description: metadata.description }),
                ...(metadata.tags && { tags: metadata.tags }),
                ...(metadata.categoryId && { categoryId: metadata.categoryId }),
                ...(metadata.defaultLanguage && { defaultLanguage: metadata.defaultLanguage }),
            };
        }

        if (metadata.privacyStatus || metadata.embeddable !== undefined || metadata.madeForKids !== undefined) {
            body.status = {
                ...(metadata.privacyStatus && { privacyStatus: metadata.privacyStatus }),
                ...(metadata.embeddable !== undefined && { embeddableEnabled: metadata.embeddable }),
                ...(metadata.madeForKids !== undefined && { madeForKids: metadata.madeForKids }),
            };
        }

        const params = new URLSearchParams({
            part: Object.keys(body).filter(k => k !== 'id').join(','),
        });

        const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`, {
            method: 'PUT',
            headers: {
                ...this.getHeaders(true),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`YouTube update error: ${response.status} — ${error}`);
        }
    }
}

export const youtubeDataService = new YouTubeDataService();
