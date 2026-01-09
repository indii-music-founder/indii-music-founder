import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/core/store';
import { MerchandiseService, CatalogProduct } from '@/services/merchandise/MerchandiseService';
import { revenueService } from '@/services/RevenueService';
import { MerchProduct } from '../types';

interface MerchStats {
    totalRevenue: number;
    unitsSold: number;
    conversionRate: number | null; // Nullable if not available
    revenueChange: number; // Percentage
    unitsChange: number; // Percentage
}

export const useMerchandise = () => {
    const userProfile = useStore(state => state.userProfile);
    const [products, setProducts] = useState<MerchProduct[]>([]);
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [stats, setStats] = useState<MerchStats>({
        totalRevenue: 0,
        unitsSold: 0,
        conversionRate: null,
        revenueChange: 0,
        unitsChange: 0
    });
    const [topSellingProducts, setTopSellingProducts] = useState<(MerchProduct & { revenue: number, units: number })[]>([]);
    const [isProductsLoading, setIsProductsLoading] = useState(true);
    const [isCatalogLoading, setIsCatalogLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load catalog on mount
    useEffect(() => {
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
                    console.warn("[Merchandise] Failed to load catalog:", err);
                    setError(err.message || "Failed to load catalog");
                    setIsCatalogLoading(false);
                }
            });

        // Defensive timeout
        const timer = setTimeout(() => {
            if (mounted && isCatalogLoading) {
                console.warn("[Merchandise] Catalog load timed out, proceeding...");
                setIsCatalogLoading(false);
            }
        }, 5000);

        return () => {
            mounted = false;
            clearTimeout(timer);
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

    // Fetch Revenue Stats and Compute Top Sellers
    useEffect(() => {
        if (!userProfile?.id) {
            setIsProductsLoading(false);
            setIsStatsLoading(false);
            return;
        }

        if (isProductsLoading) return; // Wait for products to load first

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Stats timeout')), 4000)
        );

        const fetchStats = async () => {
            setIsStatsLoading(true);
            try {
                // Race stats against a timeout
                const revenueStats = await Promise.race([
                    revenueService.getUserRevenueStats(userProfile.id, '30d'),
                    timeoutPromise
                ]) as any; // Cast as we know the shape if it wins

                if (revenueStats) {
                    setStats({
                        totalRevenue: revenueStats.sources.merch || 0,
                        unitsSold: revenueStats.sourceCounts.merch || 0,
                        conversionRate: null,
                        revenueChange: revenueStats.revenueChange,
                        unitsChange: 0
                    });

                    const topSellers = products
                        .map(product => ({
                            ...product,
                            revenue: revenueStats.revenueByProduct[product.id] || 0,
                            units: revenueStats.salesByProduct[product.id] || 0
                        }))
                        .filter(p => p.revenue > 0)
                        .sort((a, b) => b.revenue - a.revenue)
                        .slice(0, 4);

                    setTopSellingProducts(topSellers);
                }
            } catch (err) {
                console.warn("[Merchandise] Failed to load merch stats or timed out:", err);
            } finally {
                setIsStatsLoading(false);
            }
        };

        fetchStats();

    }, [userProfile?.id, isProductsLoading, products]);


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

    const loading = isProductsLoading || isCatalogLoading || isStatsLoading;

    return {
        products,
        standardProducts,
        proProducts,
        catalog,
        stats,
        topSellingProducts,
        loading,
        error,
        addProduct: MerchandiseService.addProduct,
        deleteProduct: MerchandiseService.deleteProduct,
        createFromCatalog
    };
};
