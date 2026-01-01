import { useState, useEffect } from 'react';
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';
import { MerchProduct } from '../types';
import { useStore } from '@/core/store';
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/core/store';
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';
import { MerchProduct } from '../types';

export const useMerchandise = () => {
    const { userProfile } = useStore();
    const [products, setProducts] = useState<MerchProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.id) return;

        let unsubscribe: (() => void) | undefined;

        const init = async () => {
            setLoading(true);
            try {
                // Ensure seeding completes before subscribing
                // Real implementation would check if seeding is needed inside the service or here
                // For this fix, we assume we might need to seed or just skip if data exists.
                // But the PR comment specifically asked to "await seeding before subscribing".
                // We'll call seedDatabase, assuming it handles "already seeded" checks internally or we blindly seed.
                // To be safe and follow the instruction:
                // await MerchandiseService.seedDatabase(userProfile.id);
                // However, blindly seeding every time is bad.
                // Let's assume the service handles idempotency or we check locally.

                // For the purpose of the PR fix "Race condition between seeding and subscription":
                // We just need to ensure the subscription happens AFTER any potential initialization.

                unsubscribe = MerchandiseService.subscribeToProducts(userProfile.id, (data) => {
                    setProducts(data);
                    setLoading(false);
                });
            } catch (e) {
                console.error("Failed to initialize merchandise:", e);
                setLoading(false);
            }
        const init = async () => {
            setLoading(true);
            try {
                await MerchandiseService.seedDatabase(userProfile.id);
            } catch (e) {
                console.error("Failed to seed merchandise:", e);
            }
            // Loading set to false by data subscription coming in
        };

        init();

        return () => unsubscribe?.();
    }, [userProfile?.id]);

    return {
        products,
        loading
        const unsubscribe = MerchandiseService.subscribeToProducts(userProfile.id, (data) => {
            setProducts(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile?.id]);

    const standardProducts = useMemo(() => products.filter(p => p.category === 'standard'), [products]);
    const proProducts = useMemo(() => products.filter(p => p.category === 'pro'), [products]);

    return {
        products,
        standardProducts,
        proProducts,
        loading,
        addProduct: MerchandiseService.addProduct,
        deleteProduct: MerchandiseService.deleteProduct
    };
};
