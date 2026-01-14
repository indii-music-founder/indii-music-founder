import React, { useState } from 'react';
import { X, DollarSign, Package, Tag, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { ProductType } from '@/services/marketplace/types';
import { useStore } from '@/core/store';

interface CreateProductModalProps {
    onClose: () => void;
    onProductCreated: () => void;
}

export default function CreateProductModal({ onClose, onProductCreated }: CreateProductModalProps) {
    const toast = useToast();
    const currentUser = useStore((state) => state.userProfile);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('10.00');
    const [type, setType] = useState<ProductType>('merch');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        setIsLoading(true);
        try {
            await MarketplaceService.createProduct({
                sellerId: currentUser.id,
                title,
                description,
                price: Math.round(parseFloat(price) * 100), // Convert to cents
                currency: 'USD',
                type,
                images: [], // Placeholder for now
                inventory: 100, // Default inventory
                metadata: {}
            });

            toast.success("Product created!");
            onProductCreated();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create product");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#161b22] border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">List New Product</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                        <input
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                            placeholder="e.g. Limited Edition T-Shirt"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <textarea
                            required
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none h-24 resize-none"
                            placeholder="Describe your product..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Price (USD)</label>
                            <div className="relative">
                                <DollarSign size={16} className="absolute left-3 top-3 text-gray-500" />
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="w-full bg-bg-dark border border-gray-700 rounded-lg pl-9 p-2.5 text-white focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as ProductType)}
                                className="w-full bg-bg-dark border border-gray-700 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none appearance-none"
                            >
                                <option value="merch">Merchandise</option>
                                <option value="song">Song (Digital)</option>
                                <option value="album">Album (Digital)</option>
                                <option value="ticket">Ticket</option>
                                <option value="service">Service</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all mt-4"
                    >
                        {isLoading ? 'Creating...' : 'List Product'}
                    </button>
                </form>
            </div>
        </div>
    );
}
