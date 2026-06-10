import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';

export type FanTier = 'Superfan' | 'VIP' | 'Standard';

export interface FanRecord {
    id: string;
    name: string;
    email: string;
    tier: FanTier;
    totalSpend: number;
    streamsThisMonth: number;
    lastActive: string;
    avatarInitial: string;
}

export const useSuperfans = () => {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const [fans, setFans] = useState<FanRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userProfile?.id) {
            const timer = setTimeout(() => {
                setFans([]);
                setLoading(false);
            }, 0);
            return () => clearTimeout(timer);
        }

        const timer2 = setTimeout(() => {
            setLoading(true);
            setError(null);
        }, 0);

        const q = query(
            collection(db, 'contacts'),
            where('userId', '==', userProfile.id),
            where('isFan', '==', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FanRecord));
            setFans(items);
            setLoading(false);
        }, (err) => {
            logger.error('[useSuperfans] Subscription failed:', err);
            setError('Could not load fans.');
            setLoading(false);
        });

        return () => {
            clearTimeout(timer2);
            unsubscribe();
        };
    }, [userProfile?.id]);

    return { fans, loading, error };
};
