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
