import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';

export interface InventoryItem {
    id: string;
    name: string;
    physical: number;
    virtual: number;
    reorderThreshold: number;
    channel: 'Printful' | 'Printify' | 'Shopify' | 'Direct';
    _hasPendingWrites?: boolean;
    _isFromCache?: boolean;
}

export const useInventory = () => {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
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
            setInventory([]);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        const q = query(
            collection(db, 'merchandise_inventory'),
            where('userId', '==', userProfile.id)
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
                } as InventoryItem));
                setInventory(items);
                setHasPendingWrites(snapshot.metadata.hasPendingWrites);
                setLoading(false);
            },
            (err) => {
                if (!isMountedRef.current) return;
                logger.error('[useInventory] Subscription failed:', err);
                setError('Could not load inventory.');
                setLoading(false);
            }
        );

        return () => {
            safeUnsubscribe(unsubscribe);
        };
    }, [userProfile?.id]);

    return useMemo(() => ({
        inventory,
        loading,
        error,
        hasPendingWrites,
    }), [inventory, loading, error, hasPendingWrites]);
};
