import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/core/store';
import { MerchandiseService, CatalogProduct } from '@/services/merchandise/MerchandiseService';
import { MerchProduct } from '../types';

export const useMerchandise = () => {
    const { userProfile } = useStore();
    const [products, setProducts] = useState<MerchProduct[]>([]);
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [catalogError, setCatalogError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userProfile?.id) return;

        setLoading(true);
        setCatalogError(null);

        // Subscribe to user's products
        const unsubscribe = MerchandiseService.subscribeToProducts(userProfile.id, (data) => {
            setProducts(data);
            setLoading(false);
        });

        // Load product catalog templates
        MerchandiseService.getCatalog()
            .then((data) => {
                setCatalog(data);
                // If products are also loaded (or if we track catalog loading separately),
                // we might want to ensure loading is false here too, but the product subscription handles the main loading state.
            })
            .catch((error) => {
                console.error("Failed to load merchandise catalog:", error);
                // Ideally set an error state here, but for now just logging as per review feedback to avoid silent failure
            .then(setCatalog)
            .catch((err) => {
                console.error("Failed to load catalog:", err);
                setCatalogError(err);
                setLoading(false);
            });

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
        catalogError,
        addProduct: MerchandiseService.addProduct,
        deleteProduct: MerchandiseService.deleteProduct,
        createFromCatalog
    };
};
