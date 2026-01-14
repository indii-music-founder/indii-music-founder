import React, { useState, useMemo } from 'react';
import { useStore } from '@/core/store';
import { MerchCard } from './MerchCard';
import { Upload, Search, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export interface AssetLibraryProps {
    onAddAsset: (url: string, name: string) => Promise<void>;
    onGenerateAI?: () => void;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({ onAddAsset, onGenerateAI }) => {
    const { history, currentProjectId } = useStore();
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Filter history for images only
    const imageAssets = useMemo(() => {
        return history
            .filter(item => item.type === 'image')
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [history]);

    // Search filter
    const filteredAssets = useMemo(() => {
        if (!searchQuery.trim()) return imageAssets;

        const query = searchQuery.toLowerCase();
        return imageAssets.filter(asset =>
            asset.prompt?.toLowerCase().includes(query) ||
            asset.id?.toLowerCase().includes(query)
        );
    }, [imageAssets, searchQuery]);

    // Handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        setIsUploading(true);

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) {
                    await onAddAsset(dataUrl, file.name);
                    toast.success('Asset added to canvas');
                }
                setIsUploading(false);
            };
            reader.onerror = () => {
                toast.error('Failed to load image');
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload image');
            setIsUploading(false);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle asset click
    const handleAssetClick = async (asset: typeof imageAssets[0]) => {
        try {
            await onAddAsset(asset.url, asset.prompt || 'Image');
            toast.success('Asset added to canvas');
        } catch (error) {
            console.error('Failed to add asset:', error);
            toast.error('Failed to add asset');
        }
    };

    return (
        <MerchCard className="flex-1 p-4 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="mb-4">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Assets</h4>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#FFE135] transition-colors"
                    />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 hover:border-[#FFE135]/50 rounded-lg text-xs font-medium text-neutral-300 hover:text-white transition-all disabled:opacity-50"
                    >
                        <Upload size={14} />
                        Upload
                    </button>
                    {onGenerateAI && (
                        <button
                            onClick={onGenerateAI}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-[#FFE135]/10 hover:bg-[#FFE135]/20 border border-[#FFE135]/20 hover:border-[#FFE135]/50 rounded-lg text-xs font-medium text-[#FFE135] transition-all"
                        >
                            <Sparkles size={14} />
                            AI Generate
                        </button>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                />
            </div>

            {/* Asset Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredAssets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <ImageIcon size={48} className="text-neutral-700 mb-3" />
                        <p className="text-sm text-neutral-500 mb-2">No assets found</p>
                        <p className="text-xs text-neutral-600">
                            {searchQuery ? 'Try a different search' : 'Upload or generate images to get started'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 pb-2">
                        {filteredAssets.map((asset) => (
                            <button
                                key={asset.id}
                                onClick={() => handleAssetClick(asset)}
                                className="group relative aspect-square bg-neutral-800 rounded-lg border border-white/5 hover:border-[#FFE135] overflow-hidden transition-all cursor-pointer"
                                title={asset.prompt || 'Image'}
                            >
                                <img
                                    src={asset.url}
                                    alt={asset.prompt || 'Asset'}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="text-[10px] text-white font-medium truncate">
                                            {asset.prompt || 'Image'}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-neutral-600">
                    {filteredAssets.length} {filteredAssets.length === 1 ? 'asset' : 'assets'} available
                </p>
            </div>
        </MerchCard>
    );
};
