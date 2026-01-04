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

    // Fetch Revenue Stats and Compute Top Sellers
    useEffect(() => {
        if (!userProfile?.id || isProductsLoading) return; // Wait for products to load first

        const fetchStats = async () => {
            setIsStatsLoading(true);
            try {
                // Fetch real stats using new period filtering
                const revenueStats = await revenueService.getUserRevenueStats(userProfile.id, '30d');

                // 1. Update Aggregate Stats with real data
                setStats({
                    totalRevenue: revenueStats.sources.merch || 0,
                    unitsSold: revenueStats.sourceCounts.merch || 0,
                    conversionRate: null, // Still no visitor tracking, explicitly null
                    revenueChange: revenueStats.revenueChange, // Real calculated change
                    unitsChange: 0 // Placeholder: requires similar diff logic for units if needed, keeping 0 for now to avoid "fake" number
                });

                // 2. Compute Top Sellers
                // Map revenueByProduct to actual product details
                const topSellers = products
                    .map(product => ({
                        ...product,
                        revenue: revenueStats.revenueByProduct[product.id] || 0,
                        units: revenueStats.salesByProduct[product.id] || 0
                    }))
                    .filter(p => p.revenue > 0)
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 4); // Top 4

                setTopSellingProducts(topSellers);

            } catch (err) {
                console.error("Failed to load merch stats:", err);
                // Don't set main error, just log it, stats will be 0
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
