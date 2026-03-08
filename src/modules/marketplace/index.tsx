import React, { Suspense } from 'react';
import { useStore } from '@/core/store';
import { ShoppingCart, Store, X, Trash2 } from 'lucide-react';
import MarketplaceStorefront from './components/MarketplaceStorefront';

const CartSidebar: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const cart = useStore((s) => s.cart);
    const removeFromCart = useStore((s) => s.removeFromCart);
    const clearCart = useStore((s) => s.clearCart);
    const cartTotal = useStore((s) => s.cartTotal);

    return (
        <div className="w-80 h-full flex flex-col bg-[--card] border-l border-[--border]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[--border]">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <ShoppingCart size={16} /> Cart ({cart.length})
                </h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center mt-8">Your cart is empty.</p>
                ) : (
                    cart.map((item) => (
                        <div key={item.productId} className="flex items-start gap-3 bg-slate-900 rounded-lg p-3 border border-slate-800">
                            {item.imageUrl && (
                                <img src={item.imageUrl} alt={item.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{item.title}</p>
                                <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                                <p className="text-xs text-emerald-400">${(item.price * item.quantity).toFixed(2)} {item.currency}</p>
                            </div>
                            <button
                                onClick={() => removeFromCart(item.productId)}
                                className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                                aria-label="Remove item"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {cart.length > 0 && (
                <div className="p-4 border-t border-[--border] space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total</span>
                        <span className="text-white font-semibold">${cartTotal().toFixed(2)}</span>
                    </div>
                    <button className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors">
                        Checkout
                    </button>
                    <button
                        onClick={clearCart}
                        className="w-full py-2 text-slate-400 hover:text-white text-xs transition-colors"
                    >
                        Clear cart
                    </button>
                </div>
            )}
        </div>
    );
};

const MarketplaceModule: React.FC = () => {
    const [cartOpen, setCartOpen] = React.useState(false);
    const cartCount = useStore((s) => s.cart.length);

    return (
        <div className="flex h-full bg-[--background]">
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[--border] bg-[--card]">
                    <div className="flex items-center gap-3">
                        <Store size={20} className="text-emerald-400" />
                        <h1 className="text-lg font-semibold text-white">Marketplace</h1>
                    </div>
                    <button
                        onClick={() => setCartOpen((v) => !v)}
                        className="relative flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition-colors border border-slate-700"
                        aria-label="Open cart"
                    >
                        <ShoppingCart size={16} />
                        <span>Cart</span>
                        {cartCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Main content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <Suspense fallback={
                        <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                            Loading storefront...
                        </div>
                    }>
                        <MarketplaceStorefront />
                    </Suspense>
                </div>
            </div>

            {/* Cart sidebar */}
            {cartOpen && <CartSidebar onClose={() => setCartOpen(false)} />}
        </div>
    );
};

export default MarketplaceModule;
