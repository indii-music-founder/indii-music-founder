import { StateCreator } from 'zustand';
import { FirestoreService } from '@/services/FirestoreService';
import { type StoreState } from '../index';
import { logger } from '@/utils/logger';
import { where } from 'firebase/firestore';

export interface Campaign {
    id: string;
    userId: string;
    name: string;
    supply: number;
    price: number;
    status: 'active' | 'completed' | 'draft';
    type: 'Digital Vinyl' | 'Exclusive Audio' | 'VIP Package' | 'Merch Bundle';
    createdAt?: any;
    updatedAt?: any;
}

export interface CrmSlice {
    crm: {
        campaigns: Campaign[];
        loading: boolean;
        error: string | null;
    };
    fetchCampaigns: () => Promise<void>;
    subscribeToCampaigns: () => () => void;
    createCampaign: (campaign: Omit<Campaign, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
    deleteCampaign: (id: string) => Promise<void>;
}

const campaignFirestoreService = new FirestoreService<Campaign>('campaigns');

export const createCrmSlice: StateCreator<CrmSlice> = (set, get) => ({
    crm: {
        campaigns: [],
        loading: false,
        error: null,
    },
    fetchCampaigns: async () => {
        const { user } = get() as StoreState;
        const userId = user?.uid || 'founder-demo-uid';

        set((state) => ({ crm: { ...state.crm, loading: true } }));
        try {
            const campaigns = await campaignFirestoreService.list([
                where('userId', '==', userId)
            ]);
            set((state) => ({
                crm: {
                    ...state.crm,
                    campaigns: campaigns.sort((a, b) => {
                        const timeA = a.createdAt?.seconds || typeof a.createdAt === 'number' ? a.createdAt : 0;
                        const timeB = b.createdAt?.seconds || typeof b.createdAt === 'number' ? b.createdAt : 0;
                        return timeB - timeA;
                    }),
                    loading: false,
                    error: null,
                }
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to fetch campaigns';
            logger.error('[CrmSlice] fetchCampaigns error:', error);
            set((state) => ({
                crm: {
                    ...state.crm,
                    loading: false,
                    error: message,
                }
            }));
        }
    },
    subscribeToCampaigns: () => {
        const { user } = get() as StoreState;
        const userId = user?.uid || 'founder-demo-uid';

        set((state) => ({ crm: { ...state.crm, loading: true } }));

        return campaignFirestoreService.subscribe(
            [where('userId', '==', userId)],
            (campaigns) => {
                // Parse and sort campaigns by date
                const sorted = [...campaigns].sort((a, b) => {
                    const timeA = a.createdAt?.seconds || typeof a.createdAt === 'number' ? a.createdAt : 0;
                    const timeB = b.createdAt?.seconds || typeof b.createdAt === 'number' ? b.createdAt : 0;
                    return timeB - timeA;
                });
                set((state) => ({
                    crm: {
                        ...state.crm,
                        campaigns: sorted,
                        loading: false,
                        error: null,
                    }
                }));
            },
            (error) => {
                logger.error('[CrmSlice] subscribeToCampaigns error:', error);
                set((state) => ({
                    crm: {
                        ...state.crm,
                        loading: false,
                        error: error.message,
                    }
                }));
            }
        );
    },
    createCampaign: async (campaignData) => {
        const { user } = get() as StoreState;
        const userId = user?.uid || 'founder-demo-uid';

        try {
            const id = await campaignFirestoreService.add({
                ...campaignData,
                userId,
            });
            return id;
        } catch (error) {
            logger.error('[CrmSlice] createCampaign error:', error);
            set((state) => ({
                crm: {
                    ...state.crm,
                    error: error instanceof Error ? error.message : 'Failed to create campaign',
                }
            }));
            return null;
        }
    },
    deleteCampaign: async (id) => {
        try {
            await campaignFirestoreService.delete(id);
        } catch (error) {
            logger.error('[CrmSlice] deleteCampaign error:', error);
            set((state) => ({
                crm: {
                    ...state.crm,
                    error: error instanceof Error ? error.message : 'Failed to delete campaign',
                }
            }));
        }
    }
});
