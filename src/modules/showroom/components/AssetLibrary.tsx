import React from 'react';
import AssetRack, { ProductType } from './AssetRack';
import { BananaTheme } from '../themes';

interface AssetLibraryProps {
    theme: BananaTheme;
    selectedAsset: string | null;
    onAssetUpload: (asset: string | null) => void;
    productType: ProductType;
    onTypeChange: (type: ProductType) => void;
    placement: 'Front' | 'Back' | 'Sleeve';
    onPlacementChange: (val: 'Front' | 'Back' | 'Sleeve') => void;
    scale: number;
    onScaleChange: (val: number) => void;
}

export function AssetLibrary({
    theme,
    selectedAsset,
    onAssetUpload,
    productType,
    onTypeChange,
    placement,
    onPlacementChange,
    scale,
    onScaleChange
}: AssetLibraryProps) {
    return (
        <div className="w-[320px] h-full flex-shrink-0 z-20">
            <AssetRack
                productAsset={selectedAsset}
                productType={productType as ProductType}
                onAssetUpload={onAssetUpload}
                onTypeChange={onTypeChange}
                placement={placement}
                onPlacementChange={onPlacementChange}
                scale={scale}
                onScaleChange={onScaleChange}
                theme={theme}
            />
        </div>
    );
}
