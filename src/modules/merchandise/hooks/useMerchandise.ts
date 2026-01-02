import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/core/store';
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';
import { MerchProduct } from '../types';

export const useMerchandise = () => {
    const { userProfile } = useStore();
    const [products, setProducts] = useState<MerchProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [catalogError, setCatalogError] = useState<string | null>(null);

    // Load catalog on mount
    useEffect(() => {
        MerchandiseService.getCatalog()
            .then((data) => {
                setCatalog(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to load catalog:", err);
                setCatalogError(err.message);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!userProfile?.id) return;

        let unsubscribe: (() => void) | undefined;

        const init = async () => {
            setLoading(true);
            try {
                // Ensure seeding completes before subscribing to avoid race condition
                await MerchandiseService.seedDatabase(userProfile.id);
            } catch (e) {
                console.error("Failed to seed merchandise:", e);
            }

            // Subscribe after seeding is complete
            unsubscribe = MerchandiseService.subscribeToProducts(userProfile.id, (data) => {
                setProducts(data);
                setLoading(false);
            });
        };

        init();

        return () => unsubscribe?.();
    }, [userProfile?.id]);

    const standardProducts = useMemo(() => products.filter(p => p.category === 'standard'), [products]);
    const proProducts = useMemo(() => products.filter(p => p.category === 'pro'), [products]);

    return {
        products,
        standardProducts,
        proProducts,
        loading,
        catalog,
        catalogError,
        addProduct: MerchandiseService.addProduct,
        deleteProduct: MerchandiseService.deleteProduct
    };
};
