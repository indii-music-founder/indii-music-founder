import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';

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
    _hasPendingWrites?: boolean;
    _isFromCache?: boolean;
}

export const useSuperfans = () => {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const [fans, setFans] = useState<FanRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasPendingWrites, setHasPendingWrites] = useState(false);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!userProfile?.id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFans([]);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        const q = query(
            collection(db, 'contacts'),
            where('userId', '==', userProfile.id),
            where('isFan', '==', true)
        );

        const unsubscribe = onSnapshot(
            q,
            { includeMetadataChanges: true },
            (snapshot) => {
                if (!isMountedRef.current) return;
                const items = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    _hasPendingWrites: doc.metadata.hasPendingWrites,
                    _isFromCache: doc.metadata.fromCache,
                } as FanRecord));
                setFans(items);
                setHasPendingWrites(snapshot.metadata.hasPendingWrites);
                setLoading(false);
            },
            (err) => {
                if (!isMountedRef.current) return;
                logger.error('[useSuperfans] Subscription failed:', err);
                setError('Could not load fans.');
                setLoading(false);
            }
        );

        return () => {
            safeUnsubscribe(unsubscribe);
        };
    }, [userProfile?.id]);

    return useMemo(() => ({
        fans,
        loading,
        error,
        hasPendingWrites,
    }), [fans, loading, error, hasPendingWrites]);
};
