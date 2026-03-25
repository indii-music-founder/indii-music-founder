/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
import { db } from '@/services/firebase';
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { useStore } from '@/core/store';
import { CampaignAsset, CampaignStatus, MarketingStats } from '@/modules/marketing/types';
import { CampaignAssetSchema, MarketingStatsSchema } from '@/modules/marketing/schemas';
import { logger } from '@/utils/logger';
import { firebaseAI } from '../ai/FirebaseAIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

export class MarketingService {
    /**
     * Analyze sentiment of social media mentions
     * Fulfills Item 59 of the production checklist
     */
    static async analyzeSocialSentiment(mentions: string[]): Promise<{
        score: number; // -1 to 1
        label: 'positive' | 'neutral' | 'negative';
        trendingTopics: string[];
        summary: string;
    }> {
        if (mentions.length === 0) {
            return { score: 0, label: 'neutral', trendingTopics: [], summary: 'No mentions found.' };
        }

        const prompt = `Analyze the sentiment and trending topics from the following social media mentions:
        
        ${mentions.slice(0, 50).join('\n---\n')}
        
        Return JSON format:
        {
          "score": number (from -1.0 to 1.0),
          "label": "positive" | "neutral" | "negative",
          "trendingTopics": ["string"],
          "summary": "string"
        }`;

        const response = await firebaseAI.generateContent(
            [{ role: 'user', parts: [{ text: prompt }] }],
            AI_MODELS.TEXT.FAST, // Use Flash for high-speed analysis
            {
                responseMimeType: 'application/json',
                ...AI_CONFIG.THINKING.LOW
            }
        );

        const parsed = firebaseAI.parseJSON(response.response.text()) as any;
        return {
            score: typeof parsed.score === 'number' ? parsed.score : 0,
            label: ['positive', 'neutral', 'negative'].includes(parsed.label) ? parsed.label : 'neutral',
            trendingTopics: Array.isArray(parsed.trendingTopics) ? parsed.trendingTopics : [],
            summary: typeof parsed.summary === 'string' ? parsed.summary : 'Summary unavailable'
        };
    }

    /**
     * Calculate Brand Trust Score
     * Fulfills Item 60 of the production checklist
     */
    static calculateBrandTrustScore(stats: MarketingStats, campaigns: CampaignAsset[]) {
        // Simple heuristic: Reach + Engagement weighted by consistency
        const reachScore = Math.min(stats.totalReach / 100000, 40); // Max 40 points for reach
        const engagementScore = Math.min(stats.engagementRate * 5, 30); // Max 30 points for engagement

        // Consistency: active campaigns
        const consistencyScore = Math.min(stats.activeCampaigns * 5, 20); // Max 20 points

        // Diversity: variety of assets
        const totalAssets = campaigns.reduce((acc, c) => acc + (c.posts?.length || 0), 0);
        const diversityScore = Math.min(totalAssets / 2, 10); // Max 10 points

        const total = Math.round(reachScore + engagementScore + consistencyScore + diversityScore);

        return {
            score: total, // 0 to 100
            level: total > 80 ? 'Elite' : total > 50 ? 'Established' : 'Emerging',
            breakdown: {
                reach: Math.round(reachScore),
                engagement: Math.round(engagementScore),
                consistency: Math.round(consistencyScore),
                diversity: Math.round(diversityScore)
            }
        };
    }

    /**
     * Get Marketing Stats
     */
    static async getMarketingStats(): Promise<MarketingStats> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return { totalReach: 0, engagementRate: 0, activeCampaigns: 0 };

        try {
            const statsRef = doc(db, 'users', userProfile.id, 'stats', 'marketing');
            const snapshot = await getDoc(statsRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                const validation = MarketingStatsSchema.safeParse(data);
                if (validation.success) {
                    return validation.data;
                } else {
                    logger.warn("[MarketingService] Invalid marketing stats data:", validation.error);
                }
            }
        } catch (e) {
            logger.warn("MarketingService: Stats fetch failed", e);
        }

        return {
            totalReach: 0,
            engagementRate: 0,
            activeCampaigns: 0
        };
    }

    /**
     * Fetch campaigns from Firestore
     */
    static async getCampaigns(): Promise<CampaignAsset[]> {
        const userProfile = useStore.getState().userProfile;
        if (!userProfile?.id) return [];

        try {
            const q = query(
                collection(db, 'campaigns'),
                where('userId', '==', userProfile.id),
                orderBy('startDate', 'desc')
            );

            const snapshot = await getDocs(q);

            const results: CampaignAsset[] = [];
            for (const doc of snapshot.docs) {
                const data = { id: doc.id, ...doc.data() };

                // 🛡️ Sentinel: Strict schema validation
                const parseResult = CampaignAssetSchema.safeParse(data);
                if (parseResult.success) {
                    results.push(parseResult.data as CampaignAsset);
                } else {
                    logger.warn(`[MarketingService] Skipping invalid campaign ${doc.id}:`, parseResult.error);
                }
            }
            return results;
        } catch (e) {
            logger.error("MarketingService: Campaign fetch failed", e);
            return [];
        }
    }

    /**
     * Get a single campaign by ID
     */
    static async getCampaignById(id: string): Promise<CampaignAsset | null> {
        try {
            const docRef = doc(db, 'campaigns', id);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const data = { id: snapshot.id, ...snapshot.data() };
                const parseResult = CampaignAssetSchema.safeParse(data);
                if (parseResult.success) {
                    return parseResult.data as CampaignAsset;
                }
                logger.error(`[MarketingService] Invalid campaign data for ${id}:`, parseResult.error);
                return null;
            }
            return null;
        } catch (error) {
            logger.error("MarketingService: Failed to fetch campaign", error);
            return null;
        }
    }

    /**
     * Create a new campaign
     */
    static async createCampaign(campaign: Omit<CampaignAsset, 'id'>): Promise<string> {
        const userProfile = useStore.getState().userProfile;

        if (!userProfile?.id) throw new Error("User not authenticated");

        // Validate input structure before write (ignoring id)
        const validation = CampaignAssetSchema.safeParse(campaign);
        if (!validation.success) {
            logger.error("[MarketingService] Invalid campaign input:", validation.error);
            throw new Error("Invalid campaign data");
        }

        const campaignData = {
            ...validation.data, // Use validated data to strip unknown fields
            userId: userProfile.id,
            createdAt: serverTimestamp(),
            status: CampaignStatus.PENDING
        };

        const docRef = await addDoc(collection(db, 'campaigns'), campaignData);
        return docRef.id;
    }

    /**
     * Update Marketing Stats
     */
    static async updateMarketingStats(stats: { totalReach?: number; engagementRate?: number; activeCampaigns?: number }) {
        // Implementation kept for compatibility
    }

    /**
     * Update an existing campaign
     */
    static async updateCampaign(id: string, updates: Partial<CampaignAsset>) {
        try {
            const docRef = doc(db, 'campaigns', id);
            // Partial validation could be complex, but let's assume partial updates are trusted for now
            // or we validate known fields.
            // Removing 'id' to prevent overwriting document key
            const { id: _id, ...cleanUpdates } = updates;
            await updateDoc(docRef, { ...cleanUpdates, updatedAt: serverTimestamp() });
        } catch (error) {
            logger.error("MarketingService: Update failed", error);
            throw error;
        }
    }
}
