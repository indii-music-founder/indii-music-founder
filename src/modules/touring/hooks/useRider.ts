
import { useState, useEffect } from 'react';
import { RiderService } from '@/services/touring/RiderService';
import { RiderItem } from '../types';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

export const useRider = () => {
    const { userProfile } = useStore();
    const [items, setItems] = useState<RiderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [prevUserId, setPrevUserId] = useState(userProfile?.id);
    if (userProfile?.id !== prevUserId) {
        setPrevUserId(userProfile?.id);
        setLoading(!!userProfile?.id);
    }

    useEffect(() => {
        if (!userProfile?.id) return;

        const unsubscribe = RiderService.subscribeToRiderItems(userProfile.id, (data) => {
            setItems(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile?.id]);

    const addItem = async (label: string, category: RiderItem['category']) => {
        if (!userProfile?.id) return;
        try {
            await RiderService.addItem({
                userId: userProfile.id,
                label,
                category,
                completed: false
            });
            toast.success("Rider item added");
        } catch (error) {
            console.error("Failed to add rider item", error);
            toast.error("Failed to add item");
        }
    };

    const toggleItem = async (id: string, completed: boolean) => {
        try {
            await RiderService.updateItem(id, { completed });
        } catch (error) {
            console.error("Failed to toggle item", error);
            toast.error("Failed to update status");
        }
    };

    const deleteItem = async (id: string) => {
        try {
            await RiderService.deleteItem(id);
            toast.success("Item removed");
        } catch (error) {
            console.error("Failed to delete item", error);
            toast.error("Failed to remove item");
        }
    };

    return {
        items,
        loading,
        addItem,
        toggleItem,
        deleteItem
    };
};
