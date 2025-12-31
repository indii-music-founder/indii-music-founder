import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Shirt, Coffee, Smartphone, Frame, LucideIcon, Wand2 } from 'lucide-react';
import { BananaTheme } from '../themes';

export type ProductType = 'T-Shirt' | 'Hoodie' | 'Mug' | 'Bottle' | 'Poster' | 'Phone Screen';

interface AssetRackProps {
    productAsset: string | null;
    productType: ProductType;
    onAssetUpload: (base64: string) => void;
    onTypeChange: (type: ProductType) => void;
    theme?: BananaTheme;
}

const PRODUCT_ICONS: Record<ProductType, LucideIcon> = {
    'T-Shirt': Shirt,
    'Hoodie': Shirt,
    'Mug': Coffee,
    'Bottle': Coffee,
    'Poster': Frame,
    'Phone Screen': Smartphone
};

interface ProductSelectorProps {
    productType: ProductType;
    onTypeChange: (type: ProductType) => void;
}

// Optimization: Extract ProductSelector and use React.memo to prevent re-renders
const ProductSelector = React.memo(({ productType, onTypeChange }: ProductSelectorProps) => {
    return (
        <div className="mb-8 space-y-3">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">
                Topology
            </label>
            <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PRODUCT_ICONS) as ProductType[]).map((type) => {
                    const Icon = PRODUCT_ICONS[type];
                    const isSelected = productType === type;
                    return (
                        <motion.button
                            key={type}
                            onClick={() => onTypeChange(type)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`
                                relative p-3 rounded-xl flex flex-col items-center gap-2 transition-all duration-300
                                ${isSelected
                                    ? 'bg-white/10 border-white/20 shadow-lg shadow-blue-500/10'
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}
                                border
                            `}
                        >
                            <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-gray-500'}`} />
                            <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                {type}
                            </span>
                            {isSelected && (
                                <motion.div
                                    layoutId="active-product"
                                    className="absolute inset-0 rounded-xl border border-blue-500/30"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
});
ProductSelector.displayName = 'ProductSelector';

// ... (imports remain)

interface AssetRackProps {
    productAsset: string | null;
    productType: ProductType;
    onAssetUpload: (base64: string) => void;
    onTypeChange: (type: ProductType) => void;
    placement: 'Front' | 'Back' | 'Sleeve';
    onPlacementChange: (val: 'Front' | 'Back' | 'Sleeve') => void;
    scale: number;
    onScaleChange: (val: number) => void;
    theme?: BananaTheme;
}

// ... (ProductSelector remains same)

export default function AssetRack({
    productAsset,
    productType,
    onAssetUpload,
    onTypeChange,
    placement,
    onPlacementChange,
    scale,
    onScaleChange,
    theme
}: AssetRackProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Removed local state for placement/scale

    const accentColorClass = theme?.colors.accent.replace('text', 'bg') || 'bg-blue-500';

    const containerClass = theme
        ? `${theme.colors.surface} ${theme.effects.glass} border-r ${theme.colors.border}`
        : "bg-[#0a0a0a] border-r border-white/5 backdrop-blur-2xl";

    const textClass = theme ? theme.colors.text : "text-white";
    const subTextClass = theme ? theme.colors.textSecondary : "text-gray-400";

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        processFile(file);
    };

    const processFile = (file: File | undefined) => {
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onAssetUpload(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        processFile(file);
    };

    return (
        <div className={`flex flex-col h-full p-6 transition-colors duration-500 ${containerClass}`}>

            <div className="flex items-center gap-3 mb-8">
                <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                <h2 className={`text-xl font-bold tracking-tight ${textClass}`}>The Asset</h2>
            </div>

            {/* Product Selector */}
            <ProductSelector productType={productType} onTypeChange={onTypeChange} />

            {/* Asset Dropzone */}
            <div className="flex-1 flex flex-col min-h-0 mb-6">
                <label className={`text-xs font-medium uppercase tracking-wider ml-1 mb-3 ${subTextClass}`}>
                    Source Graphic
                </label>
                <motion.div
                    className={`
                        flex-1 relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                        ${isDragging
                            ? 'border-blue-500 bg-blue-500/10'
                            : productAsset
                                ? 'border-white/10 bg-black/20'
                                : `${theme ? theme.colors.border : 'border-white/10'} hover:border-white/20 hover:bg-white/5`}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    whileHover="hover"
                    initial="idle"
                    animate={isDragging ? "dragging" : "idle"}
                >
                    <AnimatePresence mode="wait">
                        {productAsset ? (
                            <motion.div
                                key="asset"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute inset-0 p-4 flex items-center justify-center"
                            >
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <img
                                        src={productAsset}
                                        alt="Asset"
                                        className="max-w-full max-h-full object-contain drop-shadow-2xl"
                                    />
                                    <div className="absolute bottom-0 right-0 p-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/10">
                                        <Upload className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="empty"
                                className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
                                variants={{
                                    hover: { scale: 1.02 },
                                    dragging: { scale: 1.05 }
                                }}
                            >
                                <div className={`
                                    w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors duration-300
                                    ${isDragging ? 'bg-blue-500/20 text-blue-400' : `${theme ? theme.colors.surfaceHighlight : 'bg-white/5'} ${theme ? theme.colors.textSecondary : 'text-gray-500'}`}
                                `}>
                                    <Upload className="w-8 h-8" />
                                </div>
                                <p className={`text-sm font-medium ${theme ? theme.colors.text : 'text-gray-300'}`}>Drop Design File</p>
                                <p className={`text-xs mt-2 ${subTextClass}`}>
                                    Supports PNG, JPG (Max 5MB)<br />
                                    Transparency Recommended
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/png,image/jpeg"
                        onChange={handleFileChange}
                    />
                </motion.div>
            </div>

            {/* Placement Controls (NEW) */}
            <div className={`space-y-4 pt-4 border-t ${theme ? theme.colors.border : 'border-white/5'}`}>
                <div className="flex justify-between items-center mb-2">
                    <label className={`text-xs font-medium uppercase tracking-wider ml-1 ${subTextClass}`}>
                        Placement & Scale
                    </label>
                    <button
                        onClick={() => {
                            onPlacementChange('Front');
                            onScaleChange(85);
                        }}
                        className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded-full border transition-all hover:bg-white/10 ${theme ? 'text-purple-400 border-purple-500/30' : 'text-blue-400 border-blue-500/30'}`}
                        title="Auto-Optimize Layout"
                    >
                        <Wand2 className="w-3 h-3" />
                        Smart Layout
                    </button>
                </div>

                <div className="flex gap-2 mb-4">
                    {['Front', 'Back', 'Sleeve'].map((place) => (
                        <button
                            key={place}
                            onClick={() => onPlacementChange(place as any)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors 
                                ${placement === place
                                    ? 'bg-blue-500 text-white border-blue-400'
                                    : `bg-transparent ${subTextClass} ${theme ? theme.colors.border : 'border-white/5'} hover:bg-white/10`
                                }`}
                        >
                            {place}
                        </button>
                    ))}
                </div>

                <div className="space-y-2">
                    <div className={`flex justify-between text-xs ${subTextClass}`}>
                        <span>Scale</span>
                        <span>{scale}%</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        value={scale}
                        onChange={(e) => onScaleChange(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                </div>
            </div>
        </div>
    );
}
