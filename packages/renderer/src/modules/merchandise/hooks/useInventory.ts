import { useState, useEffect } from 'react';
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
}

export const useInventory = () => {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userProfile?.id) {
            const timer = setTimeout(() => {
                setInventory([]);
                setLoading(false);
            }, 0);
            return () => clearTimeout(timer);
        }

        const timer2 = setTimeout(() => {
            setLoading(true);
            setError(null);
        }, 0);

        const q = query(
            collection(db, 'merchandise_inventory'),
            where('userId', '==', userProfile.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as InventoryItem));
            setInventory(items);
            setLoading(false);
        }, (err) => {
            logger.error('[useInventory] Subscription failed:', err);
            setError('Could not load inventory.');
            setLoading(false);
        });

        return () => {
            clearTimeout(timer2);
            safeUnsubscribe(unsubscribe);
        };
    }, [userProfile?.id]);

    return { inventory, loading, error };
};
