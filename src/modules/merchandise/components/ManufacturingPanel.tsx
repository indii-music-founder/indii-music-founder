import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Palette, Ruler, Truck, DollarSign, Calculator, Loader2, ExternalLink, Zap, Package } from 'lucide-react';
import { MerchTheme } from '@/modules/merchandise/themes';
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';
import { PrintOnDemandService, PODProvider } from '@/services/pod/PrintOnDemandService';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { ProductType, CatalogProductSchema } from '../types';
import { logger } from '@/utils/logger';

interface ManufacturingPanelProps {
    theme: MerchTheme;
    productType: ProductType;
    productId?: string; // Optional: If missing, treated as draft
    designUrl?: string; // Design image URL for POD orders
    onClose?: () => void;
}

type FulfillmentMode = 'internal' | 'pod';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const COLORS = [
    { name: 'Midnight Black', hex: '#000000' },
    { name: 'Arctic White', hex: '#ffffff' },
    { name: 'Heather Grey', hex: '#808080' },
    { name: 'Navy Blue', hex: '#000080' },
];

const RETAIL_MULTIPLIER = 2.2;

// Fallback pricing if catalog fetch fails - expanded for indie artists
const DEFAULT_COSTS: Partial<Record<ProductType, number>> = {
    // Apparel
    'T-Shirt': 12.50,
    'Hoodie': 24.00,
    'Cap': 8.00,
    'Beanie': 10.00,
    'Bandana': 6.00,
    // Music Products
    'Vinyl Record': 18.00,
    'CD': 3.50,
    'Cassette': 4.00,
    // Accessories
    'Tote Bag': 8.00,
    'Sticker Sheet': 2.50,
    'Patch': 3.00,
    'Enamel Pin': 4.50,
    'Keychain': 3.50,
    // Home & Print
    'Mug': 6.50,
    'Bottle': 8.00,
    'Poster': 4.00,
    'Flag': 15.00,
    'Phone Screen': 2.00
};

export default function ManufacturingPanel({ theme, productType, productId, designUrl, onClose }: ManufacturingPanelProps) {
    const [selectedSize, setSelectedSize] = React.useState('L');
    const [selectedColor, setSelectedColor] = React.useState(COLORS[0]!);
    const [quantity, setQuantity] = React.useState(100);
    const toast = useToast();
    const { userProfile } = useStore();

    // Fulfillment Mode - Internal (self-managed) or POD (Printful, etc.)
    const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('internal');
    const [selectedPODProvider, setSelectedPODProvider] = useState<PODProvider>('printful');
    const [podConfigured, setPodConfigured] = useState(false);

    // Dynamic Cost Calculation
    const [baseCost, setBaseCost] = React.useState(DEFAULT_COSTS[productType] || 10.00);
    const [isLoadingPrices, setIsLoadingPrices] = React.useState(true);

    // Check if POD is configured
    useEffect(() => {
        const isConfigured = PrintOnDemandService.isConfigured('printful');
        setPodConfigured(isConfigured);
    }, []);

    // ⚡ Bolt Optimization: Combined duplicate useEffect hooks to prevent double-fetching
    // the catalog and potential race conditions.
    useEffect(() => {
        let mounted = true;

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

                const normalizedType = productType.toLowerCase();

                // Find a matching product in the catalog
                const match = validItems.find(p => {
                    const title = p.title.toLowerCase();
                    // Direct match
                    if (title.includes(normalizedType)) return true;
                    // Alias: T-Shirt -> Tee
                    if (normalizedType === 't-shirt' && title.includes('tee')) return true;
                    // Fallback assumption from previous logic
                    if (p.category === 'standard' && productType === 'T-Shirt') return true;
                    return false;
                });

                if (match) {
                    setBaseCost(match.basePrice);
                } else {
                    // Fallback to default if not found
                    setBaseCost(DEFAULT_COSTS[productType] || 10.00);
                }
            } catch (err: unknown) {
                logger.warn("[ManufacturingPanel] Failed to fetch live pricing:", err);
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
            // Use provided ID or generate a draft ID
            const effectiveProductId = productId || `DRAFT-${crypto.randomUUID().split('-')[0]!.toUpperCase()}`;

            if (fulfillmentMode === 'pod' && podConfigured && designUrl) {
                // POD Mode - Use Print-on-Demand service
                toast.info("Creating order with Printful...");

                if (!userProfile?.shippingAddress) {
                    toast.error("Please add a shipping address to your profile.");
                    return;
                }

                const order = await PrintOnDemandService.createOrder(
                    [{
                        productId: effectiveProductId,
                        variantId: `${selectedSize}-${selectedColor.name}`,
                        quantity: quantity,
                        designUrl: designUrl,
                        printArea: 'front'
                    }],
                    {
                        name: userProfile.displayName || userProfile.email || 'Customer',
                        address1: userProfile.shippingAddress.street,
                        city: userProfile.shippingAddress.city,
                        stateCode: userProfile.shippingAddress.state,
                        countryCode: userProfile.shippingAddress.country,
                        postalCode: userProfile.shippingAddress.zip
                    },
                    'STANDARD',
                    selectedPODProvider
                );

                toast.success(`POD Order Created! ID: ${order.id}`);
                toast.info(`Estimated delivery: ${order.estimatedDelivery || '5-7 business days'}`);
            } else {
                // Internal Mode - Use existing merchandise service
                toast.info("Initializing production line...");

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
            }

            onClose?.();
        } catch (e: unknown) {
            logger.error("Production submission failed:", e);
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

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                {/* Fulfillment Mode Toggle */}
                <section>
                    <label className={`text-xs font-medium uppercase tracking-wider mb-3 block flex items-center gap-2 ${theme.colors.textSecondary}`}>
                        <Package className="w-3 h-3" />
                        Fulfillment
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setFulfillmentMode('internal')}
                            className={`p-3 rounded-lg border text-left transition-all ${
                                fulfillmentMode === 'internal'
                                    ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400'
                                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <ShoppingBag className="w-4 h-4" />
                                <span className="text-xs font-bold">Self-Manage</span>
                            </div>
                            <p className="text-[10px] opacity-70">Handle production yourself</p>
                        </button>
                        <button
                            onClick={() => setFulfillmentMode('pod')}
                            className={`p-3 rounded-lg border text-left transition-all relative ${
                                fulfillmentMode === 'pod'
                                    ? 'bg-purple-500/20 border-purple-400 text-purple-400'
                                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-4 h-4" />
                                <span className="text-xs font-bold">Print-on-Demand</span>
                            </div>
                            <p className="text-[10px] opacity-70">Auto-fulfill via Printful</p>
                            {!podConfigured && (
                                <span className="absolute top-1 right-1 px-1 py-0.5 bg-orange-500/20 text-orange-400 text-[8px] rounded">
                                    Setup Required
                                </span>
                            )}
                        </button>
                    </div>

                    {/* POD Provider Selection (when POD mode is active) */}
                    {fulfillmentMode === 'pod' && (
                        <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            {podConfigured ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-xs text-green-400">Connected to {selectedPODProvider}</span>
                                    <a
                                        href="https://www.printful.com/dashboard"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                                    >
                                        Dashboard <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs text-purple-300">
                                        Connect your Printful account to enable automatic order fulfillment.
                                    </p>
                                    <p className="text-[10px] text-neutral-500">
                                        Add VITE_PRINTFUL_API_KEY to your environment variables.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

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
                            {fulfillmentMode === 'pod'
                                ? 'Fulfilled by Printful with worldwide shipping.'
                                : 'High-quality blank suited for DTG and screen printing. Preshrunk.'
                            }
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
                        try {
                            if (!userProfile?.shippingAddress) {
                                toast.error("Please add a shipping address to your profile to order samples.");
                                return;
                            }

                            toast.info("Requesting physical sample...");
                            const effectiveProductId = productId || `DRAFT-${crypto.randomUUID().split('-')[0]!.toUpperCase()}`;

                            const result = await MerchandiseService.requestSample({
                                productId: effectiveProductId,
                                variantId: `${selectedSize}-${selectedColor.name}`,
                                shippingAddress: userProfile.shippingAddress
                            });

                            if (result.success) {
                                toast.success(`Sample request sent! ID: ${result.requestId}`);
                            }
                            onClose?.();
                        } catch (e) {
                            logger.error("Sample request failed:", e);
                            toast.error("Failed to order sample.");
                        }
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
