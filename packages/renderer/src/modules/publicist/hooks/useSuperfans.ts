import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
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

        const leads = collection(db, 'users', userProfile.id, 'crmLeads');

        const unsubscribe = onSnapshot(
            leads,
            { includeMetadataChanges: true },
            (snapshot) => {
                if (!isMountedRef.current) return;
                const items = snapshot.docs.map(document => {
                    const data = document.data();
                    const spend = typeof data.totalSpend === 'number' ? Math.max(0, data.totalSpend) : 0;
                    const customerId = typeof data.platformCustomerId === 'string' ? data.platformCustomerId : '';
                    const suffix = customerId.slice(-4).replace(/[^A-Za-z0-9]/g, '') || document.id.slice(0, 4);
                    const tier: FanTier = spend >= 500 ? 'Superfan' : spend >= 100 ? 'VIP' : 'Standard';
                    const updatedAt = data.updatedAt as { toDate?: () => Date } | undefined;
                    return {
                        id: document.id,
                        name: `Instagram customer •${suffix}`,
                        email: 'Identifier protected',
                        tier,
                        totalSpend: spend,
                        streamsThisMonth: 0,
                        lastActive: updatedAt?.toDate?.().toLocaleDateString() ?? 'Pending sync',
                        avatarInitial: 'I',
                        _hasPendingWrites: document.metadata.hasPendingWrites,
                        _isFromCache: document.metadata.fromCache,
                    };
                });
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
