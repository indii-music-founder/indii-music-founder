import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/core/store';
import { MerchandiseService, CatalogProduct } from '@/services/merchandise/MerchandiseService';
import { MerchProduct } from '../types';

export const useMerchandise = () => {
    const userProfile = useStore(state => state.userProfile);
    const [products, setProducts] = useState<MerchProduct[]>([]);
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [catalogError, setCatalogError] = useState<Error | null>(null);
    const [isProductsLoading, setIsProductsLoading] = useState(true);
    const [isCatalogLoading, setIsCatalogLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load catalog on mount
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
        MerchandiseService.getCatalog().then(setCatalog).catch(console.error);
        MerchandiseService.getCatalog()
            .then(setCatalog)
            .catch((err) => {
                console.error("Failed to load catalog:", err);
                setCatalogError(err);
            })
            .finally(() => {
                // We don't set loading false here because product subscription handles main loading state
                // But we could split loading states if desired. For now, this ensures errors are tracked.
            });
        let mounted = true;
        setIsCatalogLoading(true);

        MerchandiseService.getCatalog()
            .then((data) => {
                if (mounted) {
                    setCatalog(data);
                    setIsCatalogLoading(false);
                }
            })
            .catch((err) => {
                if (mounted) {
                    console.error("Failed to load catalog:", err);
                    setError(err instanceof Error ? err.message : 'Failed to load catalog');
                    setIsCatalogLoading(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, []);

    // Subscribe to user's products
    useEffect(() => {
        if (!userProfile?.id) {
            setProducts([]);
            setIsProductsLoading(false);
            return;
        }

        setIsProductsLoading(true);
        setError(null);

        const unsubscribe = MerchandiseService.subscribeToProducts(userProfile.id, (data) => {
            setProducts(data);
            setIsProductsLoading(false);
        });

        return () => unsubscribe();
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

    const loading = isProductsLoading || isCatalogLoading;

    return {
        products,
        standardProducts,
        proProducts,
        catalog,
        catalogError,
        loading,
        error,
        addProduct: MerchandiseService.addProduct,
        deleteProduct: MerchandiseService.deleteProduct,
        createFromCatalog
    };
};
