import { StateCreator } from 'zustand';

export interface CartItem {
    productId: string;
    title: string;
    price: number;
    currency: string;
    quantity: number;
    artistId: string;
    imageUrl?: string;
}

export interface MarketplaceSlice {
    cart: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (productId: string) => void;
    clearCart: () => void;
    cartTotal: () => number;
}

export const createMarketplaceSlice: StateCreator<MarketplaceSlice> = (set, get) => ({
    cart: [],
    addToCart: (item: CartItem) => {
        set((state) => {
            const existing = state.cart.find((c) => c.productId === item.productId);
            if (existing) {
                return {
                    cart: state.cart.map((c) =>
                        c.productId === item.productId
                            ? { ...c, quantity: c.quantity + item.quantity }
                            : c
                    ),
                };
            }
            return { cart: [...state.cart, item] };
        });
    },
    removeFromCart: (productId: string) => {
        set((state) => ({
            cart: state.cart.filter((c) => c.productId !== productId),
        }));
    },
    clearCart: () => {
        set({ cart: [] });
    },
    cartTotal: () => {
        return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },
});
