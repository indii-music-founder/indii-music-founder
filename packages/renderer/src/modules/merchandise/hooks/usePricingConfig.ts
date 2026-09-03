import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';
import { safeUnsubscribe } from '@/utils/safeUnsubscribe';

export interface PricingConfig {
    [category: string]: {
        suggested: number;
        benchmark: number;
    };
}

const DEFAULT_INDIE_MARGINS: PricingConfig = {
    'T-Shirt': { suggested: 28, benchmark: 34 },
    'Hoodie': { suggested: 55, benchmark: 45 },
    'Vinyl Record': { suggested: 22, benchmark: 28 },
    'Poster': { suggested: 18, benchmark: 24 },
    'Sticker Sheet': { suggested: 8, benchmark: 65 },
    'Snapback': { suggested: 35, benchmark: 40 },
};

export const usePricingConfig = () => {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const [config, setConfig] = useState<PricingConfig>(DEFAULT_INDIE_MARGINS);
    const [loading, setLoading] = useState(true);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!userProfile?.id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            return;
        }

        setLoading(true);

        const docRef = doc(db, 'merch_config', userProfile.id);

        const unsubscribe = onSnapshot(docRef, { includeMetadataChanges: true }, (docSnap) => {
            if (!isMountedRef.current) return;
            if (docSnap.exists() && docSnap.data().pricing) {
                setConfig({ ...DEFAULT_INDIE_MARGINS, ...docSnap.data().pricing });
            } else {
                setConfig(DEFAULT_INDIE_MARGINS);
            }
            setLoading(false);
        }, (err) => {
            if (!isMountedRef.current) return;
            logger.error('[usePricingConfig] Failed to fetch pricing config:', err);
            setLoading(false);
        });

        return () => {
            safeUnsubscribe(unsubscribe);
        };
    }, [userProfile?.id]);

    return useMemo(() => ({ config, loading }), [config, loading]);
};
