import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '@/core/store';
import { Plus, Trash2, Edit3, Image as ImageIcon, Sparkles, Check, Wand2, Loader2, ChevronDown, ChevronUp, Lock, Film, Video, ImagePlay } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import { WhiskItem, WhiskCategory, TargetMedia } from '@/core/store/slices/creativeSlice';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { WhiskService } from '@/services/WhiskService';
import WhiskPresetStyles, { STYLE_PRESETS } from './WhiskPresetStyles';

// ============================================================================
// WHISK DROP ZONE - Large visual drop area for each category
// ============================================================================
interface WhiskDropZoneProps {
    title: string;
    category: WhiskCategory;
    items: WhiskItem[];
    onAdd: (type: 'text' | 'image', content: string, caption?: string) => void;
    onRemove: (id: string) => void;
    onToggle: (id: string) => void;
    onUpdate: (id: string, updates: Partial<WhiskItem>) => void;
    description: string;
    accentColor?: string; // For video-related categories
}

const WhiskDropZone = ({ title, category, items, onAdd, onRemove, onToggle, onUpdate, description, accentColor = 'purple' }: WhiskDropZoneProps) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isInspiring, setIsInspiring] = useState(false);
    const [inspirations, setInspirations] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const toast = useToast();

    const activeItems = items.filter(i => i.checked);
    const hasItems = items.length > 0;

    // Handle file upload with AI captioning
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            if (ev.target?.result) {
                const dataUrl = ev.target.result as string;
                toast.info(`Analyzing ${category} reference...`);
                const [mimeType, b64] = dataUrl.split(',');
                const pureMime = mimeType.split(':')[1].split(';')[0];

                try {
                    // For motion category, use 'style' for captioning as motion is described visually
                    const captionCategory = category === 'motion' ? 'style' : category as 'subject' | 'scene' | 'style';
                    const caption = await ImageGeneration.captionImage({ mimeType: pureMime, data: b64 }, captionCategory);
                    onAdd('image', dataUrl, caption);
                    toast.success(`${title} reference added!`);
                } catch (err: any) {
                    onAdd('image', dataUrl);
                    if (err?.name === 'QuotaExceededError' || err?.code === 'QUOTA_EXCEEDED') {
                        toast.error(err.message || 'Quota exceeded.');
                    } else {
                        toast.warning('Reference added, but analysis failed.');
                    }
                }
            }
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Handle drop from gallery
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const id = e.dataTransfer.getData('text/plain');
        if (!id) return;

        const { useStore } = await import('@/core/store');
        const { generatedHistory, uploadedImages } = useStore.getState();
        const item = [...generatedHistory, ...uploadedImages].find(i => i.id === id);

        if (item && item.type === 'image') {
            toast.info(`Analyzing ${category} reference...`);
            try {
                const [mimeType, b64] = item.url.split(',');
                const pureMime = mimeType?.split(':')[1]?.split(';')[0] || 'image/png';
                // For motion category, use 'style' for captioning as motion is described visually
                const captionCategory = category === 'motion' ? 'style' : category as 'subject' | 'scene' | 'style';
                const caption = await ImageGeneration.captionImage({ mimeType: pureMime, data: b64 }, captionCategory);
                onAdd('image', item.url, caption);
                toast.success(`${title} reference set!`);
            } catch (err: any) {
                onAdd('image', item.url);
                if (err?.name === 'QuotaExceededError') {
                    toast.error(err.message);
                } else {
                    toast.warning('Reference added, but analysis failed.');
                }
            }
        }
    };

    // Generate AI inspiration
    const handleInspire = async () => {
        setIsInspiring(true);
        try {
            const ideas = await WhiskService.generateInspiration(category);
            setInspirations(ideas);
        } catch (err) {
            toast.error('Failed to get inspiration');
        } finally {
            setIsInspiring(false);
        }
    };

    // Select an inspiration
    const selectInspiration = (idea: string) => {
        onAdd('text', idea);
        setInspirations([]);
        toast.success(`Added: ${idea.slice(0, 30)}...`);
    };

    return (
        <div className="mb-4">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-2 px-1">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 group"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title} section`}
                    aria-label={isExpanded ? `Collapse ${title} section` : `Expand ${title} section`}
                    aria-label={`Toggle ${title} section`}
                >
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">
                        {title}
                    </h3>
                    {activeItems.length > 0 && (
                        <span className="flex items-center gap-1 text-[9px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
                            <Lock size={8} />
                            {activeItems.length}
                        </span>
                    )}
                    {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                </button>
                <div className="flex gap-1">
                    <button
                        onClick={handleInspire}
                        disabled={isInspiring}
                        className="p-1.5 text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors disabled:opacity-50"
                        title="Inspire Me"
                        aria-label="Inspire Me - Generate ideas with AI"
                        aria-label="Inspire me"
                        aria-label={isInspiring ? "Generating inspiration..." : `Inspire me with ${title} ideas`}
                    >
                        {isInspiring ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    </button>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`p-1.5 rounded transition-all ${isAdding ? 'text-red-400 rotate-45 bg-red-500/10' : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'}`}
                        aria-label={isAdding ? "Cancel adding item" : `Add new ${category}`}
                        aria-label={isAdding ? "Cancel add" : "Add item"}
                        aria-label={isAdding ? "Cancel adding item" : `Add new ${title}`}
                        aria-expanded={isAdding}
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        {/* Inspirations Dropdown */}
                        <AnimatePresence>
                            {inspirations.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="mb-2 p-2 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30"
                                >
                                    <p className="text-[9px] text-yellow-400 font-bold mb-1.5 uppercase tracking-wider">✨ AI Suggestions</p>
                                    <div className="space-y-1">
                                        {inspirations.map((idea, i) => (
                                            <button
                                                key={i}
                                                onClick={() => selectInspiration(idea)}
                                                className="w-full text-left text-[10px] text-gray-300 p-1.5 rounded bg-black/30 hover:bg-purple-500/20 hover:text-white transition-colors"
                                            >
                                                {idea}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setInspirations([])}
                                        className="mt-2 text-[9px] text-gray-500 hover:text-gray-300"
                                    >
                                        Dismiss
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Add Input */}
                        <AnimatePresence>
                            {isAdding && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-2 overflow-hidden"
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
                                            placeholder={`Describe ${category}...`}
                                            className="flex-1 bg-black/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none placeholder:text-gray-600"
                                            autoFocus
                                            aria-label={`Enter ${category} description`}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
                                            title="Upload image"
                                            aria-label="Upload image"
                                            aria-label="Upload reference image"
                                        >
                                            <ImageIcon size={16} />
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Drop Zone / Items Container */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            className={`relative min-h-[80px] rounded-xl border-2 border-dashed transition-all duration-200 ${isDragOver
                                ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(147,51,234,0.3)]'
                                : hasItems
                                    ? 'border-transparent bg-[#111]'
                                    : 'border-gray-700 bg-[#0d0d0d] hover:border-gray-600'
                                }`}
                        >
                            {/* Empty State */}
                            {!hasItems && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
                                    <ImageIcon size={24} className={`mb-2 ${isDragOver ? 'text-purple-400' : 'text-gray-600'}`} />
                                    <p className={`text-[10px] text-center ${isDragOver ? 'text-purple-300' : 'text-gray-500'}`}>
                                        {isDragOver ? 'Drop to add reference' : description}
                                    </p>
                                </div>
                            )}

                            {/* Items Grid */}
                            {hasItems && (
                                <div className="p-2 space-y-2">
                                    {items.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className={`group relative flex items-center gap-3 p-2 rounded-lg transition-all ${item.checked
                                                ? 'bg-gradient-to-r from-purple-900/30 to-purple-900/10 border border-purple-500/40 shadow-[0_0_10px_rgba(147,51,234,0.15)]'
                                                : 'bg-[#1a1a1a] border border-gray-800/50 opacity-50'
                                                }`}
                                        >
                                            {/* Toggle Checkbox */}
                                            <button
                                                onClick={() => onToggle(item.id)}
                                                className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${item.checked
                                                    ? 'bg-purple-500 border-purple-400 text-white shadow-[0_0_8px_rgba(147,51,234,0.5)]'
                                                    : 'bg-transparent border-gray-600 hover:border-gray-400'
                                                    }`}
                                                role="checkbox"
                                                aria-checked={item.checked}
                                                aria-label={`Select ${item.type === 'text' ? item.content : (item.aiCaption || 'Image reference')}`}
                                            >
                                                {item.checked && <Check size={12} strokeWidth={3} />}
                                            </button>

                                            {/* Thumbnail/Content */}
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                {item.type === 'image' ? (
                                                    <>
                                                        <div className="w-12 h-12 rounded-lg border border-gray-700 overflow-hidden bg-black flex-shrink-0 shadow-inner">
                                                            <img src={item.content} className="w-full h-full object-cover" alt="" />
                                                        </div>
                                                        <span className="text-[10px] text-gray-300 truncate flex-1">
                                                            {item.aiCaption || 'Image reference'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-gray-200 truncate flex-1">{item.content}</span>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        const newCaption = window.prompt('Edit description:', item.aiCaption || item.content);
                                                        if (newCaption !== null) onUpdate(item.id, { aiCaption: newCaption });
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
                                                    title="Edit"
                                                    aria-label={`Edit ${item.type === 'text' ? 'text' : 'caption'}`}
                                                >
                                                    <Edit3 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => onRemove(item.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Remove"
                                                    aria-label={`Remove ${item.content}`}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================================================
// MAIN WHISK SIDEBAR COMPONENT
// ============================================================================
export default function WhiskSidebar() {
    const { whiskState, addWhiskItem, removeWhiskItem, toggleWhiskItem, updateWhiskItem, setPreciseReference, setTargetMedia } = useStore();
    const toast = useToast();

    const handleAddPreset = useCallback((preset: typeof STYLE_PRESETS[number]) => {
        // Check if preset already exists
        const exists = whiskState.styles.some(s => s.content === preset.prompt);
        if (exists) {
            // Toggle it instead
            const item = whiskState.styles.find(s => s.content === preset.prompt);
            if (item) toggleWhiskItem('style', item.id);
        } else {
            addWhiskItem('style', 'text', preset.prompt, preset.label);
        }
        toast.success(`Style: ${preset.label}`);
    }, [whiskState.styles, addWhiskItem, toggleWhiskItem, toast]);

    const totalLockedItems =
        whiskState.subjects.filter(i => i.checked).length +
        whiskState.scenes.filter(i => i.checked).length +
        whiskState.styles.filter(i => i.checked).length +
        whiskState.motion.filter(i => i.checked).length;

    return (
        <div className="w-full md:w-72 border-r border-gray-800/50 bg-gradient-to-b from-[#0a0a0a] to-[#080808] flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-800/50 bg-gradient-to-r from-purple-900/10 to-transparent">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-500/20 rounded-lg">
                            <Sparkles className="text-purple-400" size={16} />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-white tracking-wide">Reference Mixer</span>
                            {totalLockedItems > 0 && (
                                <p className="text-[9px] text-purple-400">{totalLockedItems} locked reference{totalLockedItems !== 1 ? 's' : ''}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 uppercase font-bold">Precise</span>
                        <button
                            onClick={() => setPreciseReference(!whiskState.preciseReference)}
                            className={`w-9 h-5 rounded-full relative transition-all ${whiskState.preciseReference
                                ? 'bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]'
                                : 'bg-gray-800'
                                }`}
                            title={whiskState.preciseReference ? 'Precise: ON - Strict adherence to references' : 'Precise: OFF - Creative freedom'}
                            aria-label="Toggle Precise Reference Mode"
                            aria-pressed={whiskState.preciseReference}
                            role="switch"
                            aria-checked={whiskState.preciseReference}
                        >
                            <motion.div
                                animate={{ x: whiskState.preciseReference ? 18 : 2 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                className={`absolute top-1 left-0 w-3 h-3 rounded-full ${whiskState.preciseReference ? 'bg-white' : 'bg-gray-500'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
                {/* Media Type Toggle */}
                <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg">
                    <button
                        onClick={() => setTargetMedia('image')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium uppercase transition-all ${whiskState.targetMedia === 'image'
                            ? 'bg-purple-500/30 text-purple-300 shadow-[0_0_8px_rgba(147,51,234,0.3)]'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <ImageIcon size={12} />
                        Image
                    </button>
                    <button
                        onClick={() => setTargetMedia('video')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium uppercase transition-all ${whiskState.targetMedia === 'video'
                            ? 'bg-blue-500/30 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <Film size={12} />
                        Video
                    </button>
                    <button
                        onClick={() => setTargetMedia('both')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[10px] font-medium uppercase transition-all ${whiskState.targetMedia === 'both'
                            ? 'bg-gradient-to-r from-purple-500/30 to-blue-500/30 text-white shadow-[0_0_8px_rgba(147,51,234,0.2)]'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <ImagePlay size={12} />
                        Both
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                <WhiskDropZone
                    title="Subject"
                    category="subject"
                    items={whiskState.subjects}
                    onAdd={(type, content, cap) => addWhiskItem('subject', type, content, cap)}
                    onRemove={(id) => removeWhiskItem('subject', id)}
                    onToggle={(id) => toggleWhiskItem('subject', id)}
                    onUpdate={(id, updates) => updateWhiskItem('subject', id, updates)}
                    description="Drop an image or describe your main subject"
                />

                <WhiskDropZone
                    title="Scene"
                    category="scene"
                    items={whiskState.scenes}
                    onAdd={(type, content, cap) => addWhiskItem('scene', type, content, cap)}
                    onRemove={(id) => removeWhiskItem('scene', id)}
                    onToggle={(id) => toggleWhiskItem('scene', id)}
                    onUpdate={(id, updates) => updateWhiskItem('scene', id, updates)}
                    description="Drop an image or describe the background"
                />

                <WhiskDropZone
                    title="Style"
                    category="style"
                    items={whiskState.styles}
                    onAdd={(type, content, cap) => addWhiskItem('style', type, content, cap)}
                    onRemove={(id) => removeWhiskItem('style', id)}
                    onToggle={(id) => toggleWhiskItem('style', id)}
                    onUpdate={(id, updates) => updateWhiskItem('style', id, updates)}
                    description="Drop a style reference or describe the aesthetic"
                />

                {/* Motion Category - For Video */}
                {(whiskState.targetMedia === 'video' || whiskState.targetMedia === 'both') && (
                    <WhiskDropZone
                        title="Motion"
                        category="motion"
                        items={whiskState.motion}
                        onAdd={(type, content, cap) => addWhiskItem('motion', type, content, cap)}
                        onRemove={(id) => removeWhiskItem('motion', id)}
                        onToggle={(id) => toggleWhiskItem('motion', id)}
                        onUpdate={(id, updates) => updateWhiskItem('motion', id, updates)}
                        description="Describe camera movements, speed, and energy"
                        accentColor="blue"
                    />
                )}

                {/* Preset Styles */}
                <div className="pt-2 border-t border-gray-800/50">
                    <WhiskPresetStyles onSelectPreset={handleAddPreset} />
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-gradient-to-t from-[#0a0a0a] to-transparent border-t border-gray-800/30">
                <p className="text-[9px] text-gray-500 leading-tight">
                    🔒 Locked references are combined with your prompt for consistent generations.
                    {whiskState.preciseReference && (
                        <span className="text-purple-400"> Precise mode is ON – AI will closely follow image references.</span>
                    )}
                </p>
            </div>
        </div>
    );
}
