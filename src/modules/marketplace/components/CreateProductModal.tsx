import React, { useRef, useState } from 'react';
import { X, DollarSign, Upload, Music } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { ProductType, StemLabel } from '@/services/marketplace/types';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';

interface CreateProductModalProps {
    onClose: () => void;
    onProductCreated: () => void;
}

const STEM_SLOTS: { label: StemLabel; display: string; hint: string }[] = [
    { label: 'drums', display: 'Drums / Percussion', hint: 'kick, snare, hi-hats' },
    { label: 'bass', display: 'Bass', hint: 'bass line, 808s' },
    { label: 'melody', display: 'Melody / Instruments', hint: 'synths, guitar, piano' },
    { label: 'vocals', display: 'Vocals', hint: 'lead, hooks, ad-libs' },
];

export default function CreateProductModal({ onClose, onProductCreated }: CreateProductModalProps) {
    const toast = useToast();
    const currentUser = useStore(useShallow((state) => state.userProfile));

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('10.00');
    const [type, setType] = useState<ProductType>('song');
    const [isLoading, setIsLoading] = useState(false);

    // Stem pack state — one File per slot
    const [stemFiles, setStemFiles] = useState<Partial<Record<StemLabel, File>>>({});
    const fileRefs = useRef<Partial<Record<StemLabel, HTMLInputElement>>>({});

    const isStemPack = type === 'stem-pack';
    const stemSlotsFilled = isStemPack
        ? STEM_SLOTS.filter(s => stemFiles[s.label]).length
        : 0;

    const handleStemFileChange = (label: StemLabel, file: File | undefined) => {
        setStemFiles(prev => {
            const next = { ...prev };
            if (file) next[label] = file;
            else delete next[label];
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        if (isStemPack && stemSlotsFilled < 4) {
            toast.error('Upload all 4 stems before listing');
            return;
        }

        setIsLoading(true);
        try {
            // For stem packs: upload files first, then create the product doc
            let stemMetadata: Record<string, unknown> = {};
            if (isStemPack) {
                const draftId = `draft_${Date.now()}`;
                const uploadPayload = STEM_SLOTS.map(s => ({
                    label: s.label,
                    file: stemFiles[s.label]!,
                }));

                toast.info('Uploading stems…');
                const uploaded = await MarketplaceService.uploadStemFiles(
                    currentUser.id,
                    draftId,
                    uploadPayload
                );
                stemMetadata = {
                    stemFiles: uploaded,
                    stemCount: uploaded.length,
                    draftId,
                };
            }

            await MarketplaceService.createProduct({
                sellerId: currentUser.id,
                title,
                description,
                price: Math.round(parseFloat(price) * 100),
                currency: 'USD',
                type,
                images: [],
                metadata: stemMetadata,
            });

            toast.success('Product listed!');
            onProductCreated();
            onClose();
        } catch (error) {
            logger.error('CreateProductModal: submit failed', error);
            toast.error('Failed to create listing');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="bg-[#161b22] border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-[#161b22] z-10">
                    <h2 id="modal-title" className="text-lg font-bold text-white">List New Product</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="product-title" className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                        <input
                            id="product-title"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                            placeholder="e.g. Summer Vibes Stem Pack"
                        />
                    </div>

                    <div>
                        <label htmlFor="product-description" className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <textarea
                            id="product-description"
                            required
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none h-20 resize-none"
                            placeholder="What's included, BPM, key, genre..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="product-price" className="block text-sm font-medium text-gray-400 mb-1">Price (USD)</label>
                            <div className="relative">
                                <DollarSign size={16} className="absolute left-3 top-3 text-gray-500" aria-hidden="true" />
                                <input
                                    id="product-price"
                                    type="number"
                                    step="0.01"
                                    min="0.50"
                                    required
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="w-full bg-bg-dark border border-gray-700 rounded-lg pl-9 p-2.5 text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="product-type" className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                            <select
                                id="product-type"
                                value={type}
                                onChange={(e) => setType(e.target.value as ProductType)}
                                className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none appearance-none"
                            >
                                <option value="song">Song (Digital)</option>
                                <option value="album">Album (Digital)</option>
                                <option value="stem-pack">Stem Pack</option>
                                <option value="merch">Merchandise</option>
                                <option value="ticket">Ticket</option>
                                <option value="service">Service</option>
                            </select>
                        </div>
                    </div>

                    {/* Stem Pack Upload Section */}
                    {isStemPack && (
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center gap-2 mb-1">
                                <Music size={15} className="text-purple-400" />
                                <span className="text-sm font-semibold text-gray-300">
                                    Upload 4 Stems
                                </span>
                                <span className="ml-auto text-xs text-gray-500">
                                    {stemSlotsFilled}/4 uploaded
                                </span>
                            </div>

                            {STEM_SLOTS.map(({ label, display, hint }) => {
                                const file = stemFiles[label];
                                return (
                                    <div
                                        key={label}
                                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                                            ${file
                                                ? 'border-purple-500/50 bg-purple-900/10'
                                                : 'border-gray-700 bg-bg-dark hover:border-gray-600'
                                            }`}
                                        onClick={() => fileRefs.current[label]?.click()}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => e.key === 'Enter' && fileRefs.current[label]?.click()}
                                        aria-label={`Upload ${display} stem`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                                            ${file ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-500'}`}
                                        >
                                            {file ? '✓' : label[0]!.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-300">{display}</p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {file ? file.name : hint}
                                            </p>
                                        </div>
                                        <Upload size={15} className="text-gray-500 flex-shrink-0" />
                                        <input
                                            ref={(el) => { if (el) fileRefs.current[label] = el; }}
                                            type="file"
                                            accept="audio/*,.wav,.mp3,.aiff,.flac"
                                            className="hidden"
                                            onChange={(e) => handleStemFileChange(label, e.target.files?.[0])}
                                            aria-hidden="true"
                                        />
                                    </div>
                                );
                            })}

                            <p className="text-xs text-gray-600">
                                Accepted: WAV, MP3, AIFF, FLAC. Buyers receive a zip of all 4 stems.
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || (isStemPack && stemSlotsFilled < 4)}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-400 text-white rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all mt-4"
                    >
                        {isLoading
                            ? isStemPack ? 'Uploading stems…' : 'Creating…'
                            : 'List Product'
                        }
                    </button>
                </form>
            </div>
        </div>
    );
}
