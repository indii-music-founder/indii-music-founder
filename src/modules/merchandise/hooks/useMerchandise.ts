import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/core/store';
import { MerchandiseService, CatalogProduct } from '@/services/merchandise/MerchandiseService';
import { MerchProduct } from '../types';

export const useMerchandise = () => {
    const { userProfile } = useStore();
    const [products, setProducts] = useState<MerchProduct[]>([]);
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.id) return;

        setLoading(true);

        // Subscribe to user's products
        const unsubscribe = MerchandiseService.subscribeToProducts(userProfile.id, (data) => {
            setProducts(data);
            setLoading(false);
        });

        // Load product catalog templates
        MerchandiseService.getCatalog().then(setCatalog).catch(console.error);

        return () => unsubscribe?.();
    }, [userProfile?.id]);

    const standardProducts = useMemo(() => products.filter(p => p.category === 'standard'), [products]);
    const proProducts = useMemo(() => products.filter(p => p.category === 'pro'), [products]);

    const createFromCatalog = useCallback(async (catalogId: string, customizations?: {
        title?: string;
        price?: string;
        image?: string;
    }) => {
        if (!userProfile?.id) throw new Error('User not authenticated');
        return MerchandiseService.createFromCatalog(catalogId, userProfile.id, customizations);
    }, [userProfile?.id]);

    return {
        products,
        standardProducts,
        proProducts,
        catalog,
        loading,
        addProduct: MerchandiseService.addProduct,
        deleteProduct: MerchandiseService.deleteProduct,
        createFromCatalog
    };
};
