import React from 'react';
import AssetRack, { ProductType } from './AssetRack';
import { BananaTheme } from '../themes';

interface AssetLibraryProps {
    productType: any;
    selectedAsset: string | null;
    onTypeChange: (type: any) => void;
    onAssetUpload: (asset: string) => void;
    theme: BananaTheme;
}

export function AssetLibrary({ productType, selectedAsset, onTypeChange, onAssetUpload, theme }: AssetLibraryProps) {
    return (
        <div className="w-[320px] h-full flex-shrink-0 z-20">
            <AssetRack
                productAsset={selectedAsset}
                productType={productType}
                onAssetUpload={onAssetUpload}
                onTypeChange={onTypeChange}
                theme={theme}
            />
        </div>
    );
}
