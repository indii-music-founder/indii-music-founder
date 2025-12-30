import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Shirt, Coffee, Smartphone, Frame, LucideIcon } from 'lucide-react';

export type ProductType = 'T-Shirt' | 'Hoodie' | 'Mug' | 'Bottle' | 'Poster' | 'Phone Screen';

interface AssetRackProps {
    productAsset: string | null;
    productType: ProductType;
    onAssetUpload: (base64: string) => void;
    onTypeChange: (type: ProductType) => void;
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
// of the list when parent state (like isDragging) changes.
// This ensures that the grid of buttons only updates when productType changes.
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

export default function AssetRack({ productAsset, productType, onAssetUpload, onTypeChange }: AssetRackProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

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
        <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-white/5 p-6 backdrop-blur-2xl">
            <div className="flex items-center gap-3 mb-8">
                <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                <h2 className="text-xl font-bold text-white tracking-tight">The Asset</h2>
            </div>

            {/* Product Selector */}
            <ProductSelector productType={productType} onTypeChange={onTypeChange} />

            {/* Asset Dropzone */}
            <div className="flex-1 flex flex-col min-h-0">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1 mb-3">
                    Source Graphic
                </label>
                <motion.div
                    className={`
                        flex-1 relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                        ${isDragging
                            ? 'border-blue-500 bg-blue-500/10'
                            : productAsset
                                ? 'border-white/10 bg-black/20'
                                : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
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
                                    ${isDragging ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-500'}
                                `}>
                                    <Upload className="w-8 h-8" />
                                </div>
                                <p className="text-sm font-medium text-gray-300">Drop Design File</p>
                                <p className="text-xs text-gray-500 mt-2">
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
        </div>
    );
}
