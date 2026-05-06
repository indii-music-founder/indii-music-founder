import React, { useState, useEffect } from 'react';
import { X, Search, ShoppingBag, Music, Check, Filter } from 'lucide-react';
import { Product } from '@/services/marketplace/types';
import { MarketplaceService } from '@/services/marketplace/MarketplaceService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { logger } from '@/utils/logger';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductPickerModalProps {
  onClose: () => void;
  onSelect: (productId: string) => void;
  selectedId?: string | null;
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({ 
  onClose, 
  onSelect, 
  selectedId 
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'merch' | 'stem-pack'>('all');
  
  const userProfile = useStore(useShallow((state) => state.userProfile));

  useEffect(() => {
    const loadProducts = async () => {
      if (!userProfile?.id) return;
      try {
        setLoading(true);
        const data = await MarketplaceService.getProductsByArtist(userProfile.id);
        setProducts(data);
      } catch (error) {
        logger.error('[ProductPickerModal] Error loading products:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [userProfile?.id]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || p.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#161b22] border border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="text-dept-creative" size={24} />
              Attach Social Drop
            </h2>
            <p className="text-gray-400 text-sm mt-1">Select a product to feature in your social post.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-6 bg-gray-900/50 border-b border-gray-800 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your products..."
              className="w-full bg-black/50 border border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-dept-creative transition-colors"
            />
          </div>
          
          <div className="flex gap-2">
            {(['all', 'merch', 'stem-pack'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filter === f 
                    ? 'bg-dept-creative border-dept-creative text-black' 
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-800">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-800/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-800/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="text-gray-600" size={32} />
              </div>
              <h3 className="text-white font-medium">No products found</h3>
              <p className="text-gray-500 text-sm mt-1">Try a different search or filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => onSelect(product.id!)}
                  className={`flex items-center gap-4 p-3 rounded-2xl border transition-all group relative overflow-hidden ${
                    selectedId === product.id 
                      ? 'bg-dept-creative/10 border-dept-creative shadow-[0_0_20px_rgba(0,255,102,0.1)]' 
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="w-16 h-16 rounded-xl bg-gray-800 flex-shrink-0 overflow-hidden relative">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        {product.type === 'stem-pack' ? <Music size={24} /> : <ShoppingBag size={24} />}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 text-left min-w-0">
                    <h4 className="font-bold text-white truncate">{product.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        product.type === 'stem-pack' ? 'bg-purple-900/50 text-purple-400' : 'bg-blue-900/50 text-blue-400'
                      }`}>
                        {product.type}
                      </span>
                      <span className="text-gray-500 text-xs">• {product.inventory} units left</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-green-400 font-bold">{product.currency} {product.price}</div>
                    <div className="mt-1">
                      {selectedId === product.id ? (
                        <div className="bg-dept-creative text-black p-1 rounded-full">
                          <Check size={14} />
                        </div>
                      ) : (
                        <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-900/30 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {filteredProducts.length} products available
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-dept-creative hover:bg-dept-creative/90 text-black font-bold rounded-xl transition-all shadow-lg shadow-dept-creative/10"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ProductPickerModal;
