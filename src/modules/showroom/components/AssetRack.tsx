import React, { useRef } from 'react';

interface AssetRackProps {
    productAsset: string | null;
    productType: string;
    onAssetUpload: (base64: string) => void;
    onTypeChange: (type: any) => void;
}

const PRODUCT_TYPES = ['T-Shirt', 'Hoodie', 'Mug', 'Bottle', 'Poster', 'Phone Screen'];

export default function AssetRack({ productAsset, productType, onAssetUpload, onTypeChange }: AssetRackProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onAssetUpload(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#161b22] border-r border-gray-800 p-4">
            <h2 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">1. The Asset</h2>

            {/* Product Selector */}
            <div className="mb-6">
                <label className="block text-xs text-gray-500 mb-2">Product Topology</label>
                <select
                    value={productType}
                    onChange={(e) => onTypeChange(e.target.value)}
                    className="w-full bg-[#0d1117] border border-gray-700 text-white rounded p-2 text-sm focus:border-blue-500 outline-none"
                >
                    {PRODUCT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>

            {/* Asset Dropzone */}
            <div
                className="flex-1 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center relative hover:border-blue-500 transition-colors cursor-pointer bg-[#0d1117]"
                onClick={() => fileInputRef.current?.click()}
            >
                {productAsset ? (
                    <img src={productAsset} alt="Asset" className="max-w-full max-h-64 object-contain" />
                ) : (
                    <div className="text-center p-4">
                        <div className="text-4xl mb-2">📥</div>
                        <p className="text-sm text-gray-400">Drop PNG Graphic</p>
                        <p className="text-xs text-gray-600 mt-1">Transparency Supported</p>
                    </div>
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png,image/jpeg"
                    onChange={handleFileChange}
                />
            </div>
        </div>
    );
}
