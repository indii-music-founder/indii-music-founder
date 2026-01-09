import React, { useState, useRef } from 'react';
import { useStore } from '@/core/store';
import { Plus, Trash2, Edit3, Image as ImageIcon, Sparkles, Shuffle, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import { WhiskItem } from '@/core/store/slices/creativeSlice';
import { ImageGeneration } from '@/services/image/ImageGenerationService';

interface WhiskSectionProps {
    title: string;
    category: 'subject' | 'scene' | 'style';
    items: WhiskItem[];
    onAdd: (type: 'text' | 'image', content: string, caption?: string) => void;
    onRemove: (id: string) => void;
    onToggle: (id: string) => void;
    onUpdate: (id: string, updates: Partial<WhiskItem>) => void;
    allowRandom?: boolean;
}

const WhiskSection = ({ title, category, items, onAdd, onRemove, onToggle, onUpdate, allowRandom }: WhiskSectionProps) => {
    const [isAdding, setIsAdding] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            if (ev.target?.result) {
                const dataUrl = ev.target.result as string;
                toast.info(`Extracting essence from ${category}...`);
                const [mimeType, b64] = dataUrl.split(',');
                const pureMime = mimeType.split(':')[1].split(';')[0];

                try {
                    const caption = await ImageGeneration.captionImage({ mimeType: pureMime, data: b64 }, category);
                    onAdd('image', dataUrl, caption);
                    toast.success(`${title} reference added!`);
                } catch (err) {
                    onAdd('image', dataUrl);
                    toast.warning("Reference added, but captioning failed.");
                }
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-purple-900/20', 'border-purple-500');

        const id = e.dataTransfer.getData('text/plain');
        if (!id) return;

        // Access store directly for history search
        const { useStore } = await import('@/core/store');
        const { generatedHistory, uploadedImages } = useStore.getState();
        const item = [...generatedHistory, ...uploadedImages].find(i => i.id === id);

        if (item && item.type === 'image') {
            toast.info(`Extracting essence for ${category}...`);
            const [mimeType, b64] = item.url.split(',');
            const pureMime = mimeType.split(':')[1].split(';')[0];

            try {
                const caption = await ImageGeneration.captionImage({ mimeType: pureMime, data: b64 }, category);
                onAdd('image', item.url, caption);
                toast.success(`${title} reference updated!`);
            } catch (err) {
                onAdd('image', item.url);
                toast.warning("Reference added, but captioning failed.");
            }
        }
    };

    return (
        <div
            className="mb-6 rounded-xl border border-transparent transition-colors p-2"
            onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('bg-purple-900/20', 'border-purple-500');
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('bg-purple-900/20', 'border-purple-500');
            }}
            onDrop={handleDrop}
        >
            <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
                <div className="flex gap-1">
                    {allowRandom && (
                        <button
                            onClick={() => onAdd('text', 'Random ' + category)}
                            className="p-1 text-gray-500 hover:text-purple-400 transition-colors"
                            title="Randomize"
                        >
                            <Shuffle size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`p-1 transition-colors ${isAdding ? 'text-red-400 rotate-45' : 'text-purple-400 hover:text-purple-300'}`}
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 overflow-hidden"
                    >
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && inputValue.trim()) {
                                        onAdd('text', inputValue);
                                        setInputValue('');
                                        setIsAdding(false);
                                    }
                                }}
                                placeholder={`Enter ${category} text...`}
                                className="flex-1 bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-xs text-white focus:border-purple-500 outline-none"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-white transition-colors"
                            >
                                <ImageIcon size={14} />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-2">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`group relative flex items-center gap-2 p-2 rounded-lg border transition-all ${item.checked ? 'bg-purple-900/10 border-purple-500/30' : 'bg-[#111] border-gray-800 opacity-60'
                            }`}
                    >
                        <button
                            onClick={() => onToggle(item.id)}
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${item.checked ? 'bg-purple-500 border-purple-400 text-white' : 'bg-transparent border-gray-600'
                                }`}
                        >
                            {item.checked && <Check size={10} strokeWidth={4} />}
                        </button>

                        <div className="flex-1 min-w-0">
                            {item.type === 'image' ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded border border-gray-700 overflow-hidden bg-black flex-shrink-0">
                                        <img src={item.content} className="w-full h-full object-cover" />
                                    </div>
                                    <span className="text-[10px] text-gray-400 truncate">
                                        {item.aiCaption || "Image Ref"}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-[10px] text-gray-300 truncate block">
                                    {item.content}
                                </span>
                            )}
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => {
                                    const newCaption = prompt("Edit AI Caption:", item.aiCaption || item.content);
                                    if (newCaption !== null) onUpdate(item.id, { aiCaption: newCaption });
                                }}
                                className="p-1 text-gray-400 hover:text-yellow-400"
                                title="Edit Caption"
                            >
                                <Edit3 size={12} />
                            </button>
                            <button
                                onClick={() => onRemove(item.id)}
                                className="p-1 text-gray-400 hover:text-red-400"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function WhiskSidebar() {
    const { whiskState, addWhiskItem, removeWhiskItem, toggleWhiskItem, updateWhiskItem, setPreciseReference } = useStore();
    const toast = useToast();

    return (
        <div className="w-64 border-r border-gray-800 bg-[#0a0a0a] flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-purple-500" size={16} />
                    <span className="text-xs font-bold text-white tracking-widest uppercase">Creative Director</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold">Precise</span>
                    <button
                        onClick={() => setPreciseReference(!whiskState.preciseReference)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${whiskState.preciseReference ? 'bg-purple-600' : 'bg-gray-800'
                            }`}
                    >
                        <motion.div
                            animate={{ x: whiskState.preciseReference ? 16 : 2 }}
                            className="absolute top-1 left-0 w-2 h-2 rounded-full bg-white"
                        />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <WhiskSection
                    title="Subjects"
                    category="subject"
                    items={whiskState.subjects}
                    onAdd={(type, content, cap) => addWhiskItem('subject', type, content, cap)}
                    onRemove={(id) => removeWhiskItem('subject', id)}
                    onToggle={(id) => toggleWhiskItem('subject', id)}
                    onUpdate={(id, updates) => updateWhiskItem('subject', id, updates)}
                />
                <WhiskSection
                    title="Scenes"
                    category="scene"
                    items={whiskState.scenes}
                    onAdd={(type, content, cap) => addWhiskItem('scene', type, content, cap)}
                    onRemove={(id) => removeWhiskItem('scene', id)}
                    onToggle={(id) => toggleWhiskItem('scene', id)}
                    onUpdate={(id, updates) => updateWhiskItem('scene', id, updates)}
                    allowRandom
                />
                <WhiskSection
                    title="Styles"
                    category="style"
                    items={whiskState.styles}
                    onAdd={(type, content, cap) => addWhiskItem('style', type, content, cap)}
                    onRemove={(id) => removeWhiskItem('style', id)}
                    onToggle={(id) => toggleWhiskItem('style', id)}
                    onUpdate={(id, updates) => updateWhiskItem('style', id, updates)}
                    allowRandom
                />
            </div>

            <div className="p-4 bg-[#0d0d0d] border-t border-gray-800">
                <p className="text-[9px] text-gray-500 font-mono leading-tight">
                    Locked references are combined with your action prompt for consistent generations.
                </p>
            </div>
        </div>
    );
}
