import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Palette, Ruler, Truck, DollarSign, Calculator, Loader2 } from 'lucide-react';
import { MerchTheme } from '@/modules/merchandise/themes';
import { MerchandiseService, CatalogProduct } from '@/services/merchandise/MerchandiseService';
import { useToast } from '@/core/context/ToastContext';
import { ProductType, CatalogProductSchema } from '../types';

interface ManufacturingPanelProps {
    theme: MerchTheme;
    productType: ProductType;
    productId?: string; // Optional: If missing, treated as draft
    onClose?: () => void;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const COLORS = [
    { name: 'Midnight Black', hex: '#000000' },
    { name: 'Arctic White', hex: '#ffffff' },
    { name: 'Heather Grey', hex: '#808080' },
    { name: 'Navy Blue', hex: '#000080' },
];

const RETAIL_MULTIPLIER = 2.2;

// Fallback pricing if catalog fetch fails
const DEFAULT_COSTS: Record<ProductType, number> = {
    'T-Shirt': 12.50,
    'Hoodie': 24.00,
    'Mug': 6.50,
    'Bottle': 8.00,
    'Poster': 4.00,
    'Phone Screen': 2.00
};

export default function ManufacturingPanel({ theme, productType, productId, onClose }: ManufacturingPanelProps) {
    const [selectedSize, setSelectedSize] = React.useState('L');
    const [selectedColor, setSelectedColor] = React.useState(COLORS[0]);
    const [quantity, setQuantity] = React.useState(100);
    const toast = useToast();

    const [baseCost, setBaseCost] = React.useState(DEFAULT_COSTS[productType] || 10.00);
    const [isLoadingPrices, setIsLoadingPrices] = React.useState(true);

    // Fetch catalog prices on mount
    useEffect(() => {
        let mounted = true;

        // We set loading state here, but wrap in a function to avoid direct set loop
        const fetchPrices = async () => {
             setIsLoadingPrices(true);
             try {
                const catalog = await MerchandiseService.getCatalog();
                if (!mounted) return;

                // Validate catalog items safely
                const validItems = catalog.filter(item => {
                    const result = CatalogProductSchema.safeParse(item);
                    return result.success;
                });

                // Find a matching product in the catalog
                const match = validItems.find(p =>
                    p.title.toLowerCase().includes(productType.toLowerCase()) ||
                    (p.category === 'standard' && productType === 'T-Shirt') // Fallback assumption
                );

                if (match) {
                    setBaseCost(match.basePrice);
                } else {
                    // Fallback to default if not found
                    setBaseCost(DEFAULT_COSTS[productType] || 10.00);
                }
             } catch (err: unknown) {
                console.warn("[ManufacturingPanel] Failed to fetch live pricing:", err);
                if (mounted) setBaseCost(DEFAULT_COSTS[productType] || 10.00);
             } finally {
                if (mounted) setIsLoadingPrices(false);
             }
        };

        fetchPrices();

        return () => {
            mounted = false;
        };
    }, [productType]);

    // Bulk discount: 5% off for every 50 units, max 20%
    const discount = Math.min(Math.floor(quantity / 50) * 0.05, 0.20);
    const unitCost = baseCost * (1 - discount);
    const retailPrice = baseCost * RETAIL_MULTIPLIER;
    const profitPerUnit = retailPrice - unitCost;
    const totalProfit = profitPerUnit * quantity;

    const handleSubmission = async () => {
        try {
            toast.info("Initializing production line...");

            // Use provided ID or generate a draft ID
            const effectiveProductId = productId || `DRAFT-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

            const result = await MerchandiseService.submitToProduction({
                productId: effectiveProductId,
                variantId: `${selectedSize}-${selectedColor.name}`,
                quantity: quantity
            });

            if (result.success) {
                toast.success(`Production Started! Order ID: ${result.orderId}`);
                if (!productId) {
                    toast.info("Note: This order was created from a draft design.");
                }
            }
            onClose?.();
        } catch (e: unknown) {
            console.error("Production submission failed:", e);
            if (e instanceof Error) {
                toast.error(e.message || "Failed to start production.");
            } else {
                toast.error("Failed to start production.");
            }
        }
    };

    return (
        <div className="flex flex-col h-full relative font-sans text-left">
            <div className="flex items-center gap-3 mb-6">
                <div className={`h-8 w-1 rounded-full bg-gradient-to-b ${theme.name === 'pro' ? 'from-yellow-400 to-yellow-600' : 'from-yellow-400 to-orange-500'}`} />
                <h2 className={`text-xl font-bold tracking-tight ${theme.colors.text}`}>Production</h2>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
                {/* Brand Selection */}
                <section>
                    <label className={`text-xs font-medium uppercase tracking-wider mb-3 block flex items-center gap-2 ${theme.colors.textSecondary}`}>
                        <ShoppingBag className="w-3 h-3" />
                        Item Spec
                    </label>
                    <div className={`p-4 rounded-xl border transition-colors cursor-pointer group ${theme.colors.surfaceHighlight} ${theme.colors.border} hover:border-yellow-400/50`}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className={`font-medium ${theme.colors.text}`}>{productType} Premium</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/20">
                                In Stock
                            </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${theme.colors.textSecondary}`}>
                            High-quality blank suited for DTG and screen printing. Preshrunk.
                        </p>
                    </div>
                </section>

                {/* Color Selection */}
                <section>
                    <label
                        id="color-label"
                        className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2"
                    >
                        <Palette className="w-3 h-3" aria-hidden="true" />
                        Base Color
                    </label>
                    <div
                        role="radiogroup"
                        aria-labelledby="color-label"
                        className="flex gap-3"
                    >
                        {COLORS.map((color) => (
                            <motion.button
                                key={color.name}
                                role="radio"
                                aria-checked={selectedColor.name === color.name}
                                aria-label={color.name}
                                onClick={() => setSelectedColor(color)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor.name === color.name
                                    ? 'border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                                    : 'border-transparent opacity-70 hover:opacity-100'
                                    }`}
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            />
                        ))}
                    </div>
                </section>

                {/* Size Selection */}
                <section>
                    <label
                        id="size-label"
                        className={`text-xs font-medium uppercase tracking-wider mb-3 block flex items-center gap-2 ${theme.colors.textSecondary}`}
                    >
                        <Ruler className="w-3 h-3" aria-hidden="true" />
                        Size Run
                    </label>
                    <div
                        role="radiogroup"
                        aria-labelledby="size-label"
                        className="grid grid-cols-3 gap-2"
                    >
                        {SIZES.map((size) => (
                            <button
                                key={size}
                                role="radio"
                                aria-checked={selectedSize === size}
                                onClick={() => setSelectedSize(size)}
                                className={`py-2 rounded-lg text-xs font-medium border transition-all ${selectedSize === size
                                    ? 'bg-yellow-400 text-black border-yellow-400'
                                    : `${theme.colors.surfaceHighlight} ${theme.colors.textSecondary} ${theme.colors.border} hover:bg-white/20 hover:text-white`
                                    }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Quantity Selection */}
                <section>
                    <label
                        htmlFor="run-quantity"
                        className={`text-xs font-medium uppercase tracking-wider mb-3 block flex items-center gap-2 ${theme.colors.textSecondary}`}
                    >
                        <Calculator className="w-3 h-3" aria-hidden="true" />
                        Run Quantity
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            id="run-quantity"
                            type="range"
                            min="50"
                            max="1000"
                            step="50"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                        />
                        <span className={`font-mono font-bold ${theme.colors.text}`}>{quantity}</span>
                    </div>
                </section>

                {/* Cost Estimation */}
                <div className={`p-4 rounded-xl border mt-auto ${theme.colors.background} ${theme.colors.border}`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className={`${theme.colors.textSecondary} text-xs`}>
                            Unit Cost
                            {isLoadingPrices && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
                            {discount > 0 && !isLoadingPrices && <span className="text-green-400 ml-1">(-{(discount * 100).toFixed(0)}%)</span>}
                        </span>
                        <span className={`${theme.colors.text} font-mono`}>${unitCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                        <span className={`${theme.colors.textSecondary} text-xs`}>Suggested Retail</span>
                        <span className="text-green-500 font-mono">${retailPrice.toFixed(2)}</span>
                    </div>
                    <div className={`h-px w-full mb-4 ${theme.colors.border}`} />
                    <div className="flex justify-between items-center">
                        <span className={`${theme.colors.text} font-medium text-sm`}>Est. Project Profit</span>
                        <span className="text-green-500 font-bold font-mono text-lg flex items-center">
                            <DollarSign className="w-4 h-4" />
                            {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                        toast.info("Requesting physical sample...");
                        // Mock sample request for now, can be bound later
                        await new Promise(r => setTimeout(r, 1000));
                        toast.success("Sample request sent to warehouse!");
                        onClose?.();
                    }}
                    className={`w-full py-3 ${theme.name === 'pro' ? 'bg-white text-black' : 'bg-yellow-950 text-white'} rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-white/10 hover:opacity-90 transition-all flex items-center justify-center gap-2`}
                >
                    <Truck className="w-4 h-4" />
                    Order Sample
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmission}
                    className="w-full py-3 bg-green-500 text-black rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-green-500/20 hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
                >
                    <DollarSign className="w-4 h-4" />
                    Send to Production
                </motion.button>
            </div>
        </div>
    );
}
