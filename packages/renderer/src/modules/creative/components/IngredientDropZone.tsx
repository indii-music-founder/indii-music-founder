import React, { useCallback, useRef } from 'react';
import { X, ImagePlus, Upload, Film, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';

export type IngredientMode = 'reference' | 'base_video' | 'transition';

export interface Ingredient {
    id: string;
    dataUrl: string;
    file: File;
    type: 'image' | 'video';
}

interface IngredientDropZoneProps {
    ingredients: Ingredient[];
    onChange: (ingredients: Ingredient[]) => void;
    mode?: IngredientMode;
}

export function IngredientDropZone({ ingredients, onChange, mode = 'reference' }: IngredientDropZoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { error } = useToast();

    const maxIngredients = mode === 'reference' ? 3 : mode === 'transition' ? 2 : 1;
    const acceptedTypes = mode === 'base_video' ? 'video/*' : 'image/*,video/*';

    const handleFiles = useCallback((files: FileList | File[]) => {
        const currentCount = ingredients.length;
        const availableSlots = maxIngredients - currentCount;
        if (availableSlots <= 0) return;

        const filesToProcess = Array.from(files).slice(0, availableSlots).filter(f => {
            if (mode === 'base_video') return f.type.startsWith('video/');
            return f.type.startsWith('image/') || f.type.startsWith('video/');
        });
        
        Array.from(filesToProcess).forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                // Ignore files over 10MB
                error(`The file ${file.name} exceeds the 10MB limit.`);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    const newIngredient: Ingredient = {
                        id: crypto.randomUUID(),
                        dataUrl: e.target.result as string,
                        file,
                        type: file.type.startsWith('video/') ? 'video' : 'image'
                    };
                    onChange([...ingredients, newIngredient]);
                }
            };
            reader.readAsDataURL(file);
        });
    }, [ingredients, onChange, maxIngredients, mode, error]);

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const droppedId = e.dataTransfer.getData('text/plain');
        if (droppedId) {
            const state = useStore.getState();
            const allItems = [
                ...(state.generatedHistory || []),
                ...(state.uploadedImages || []),
                ...(state.uploadedAudio || [])
            ];
            const foundItem = allItems.find(item => item.id === droppedId);

            if (foundItem) {
                if (ingredients.length >= maxIngredients) {
                    error(`Maximum of ${maxIngredients} ingredients allowed for this mode.`);
                    return;
                }

                if (mode === 'base_video' && foundItem.type !== 'video') {
                    error('Only videos are allowed for base video mode.');
                    return;
                }

                if (foundItem.type !== 'image' && foundItem.type !== 'video') {
                    error('Only images and videos are supported here.');
                    return;
                }

                if (ingredients.find(ing => ing.id === foundItem.id)) {
                    error('This item is already added.');
                    return;
                }

                const newIngredient: Ingredient = {
                    id: foundItem.id,
                    dataUrl: foundItem.url,
                    file: new File([], 'placeholder'),
                    type: foundItem.type as 'image' | 'video'
                };
                onChange([...ingredients, newIngredient]);
                return;
            }
        }

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles, ingredients, maxIngredients, mode, onChange, error]);

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const removeIngredient = (id: string) => {
        onChange(ingredients.filter(ing => ing.id !== id));
    };

    const isFull = ingredients.length >= maxIngredients;

    const getModeIcon = () => {
        if (mode === 'base_video') return <Film size={32} className="opacity-70" />;
        if (mode === 'transition') return <ArrowRightLeft size={32} className="opacity-70" />;
        return <ImagePlus size={32} className="opacity-70" />;
    };

    const getModeHelperText = () => {
        if (mode === 'base_video') return "Upload 1 base video for scene extension";
        if (mode === 'transition') return "Upload Start & End frames for transitions";
        return "Lock in characters, pets, or styles for video generation";
    };

    return (
        <div className="w-full">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={acceptedTypes}
                multiple={maxIngredients > 1}
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            
            <div 
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${
                    isFull 
                    ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed' 
                    : 'border-dept-creative/30 bg-white/5 hover:bg-white/10 hover:border-dept-creative/50 cursor-pointer'
                }`}
                onDrop={!isFull ? onDrop : undefined}
                onDragOver={!isFull ? onDragOver : undefined}
                onClick={() => !isFull && fileInputRef.current?.click()}
                tabIndex={!isFull ? 0 : -1}
                onKeyDown={(e) => {
                    if (!isFull && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }
                }}
                role="button"
                aria-disabled={isFull}
            >
                {ingredients.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        {getModeIcon()}
                        <p className="text-sm font-medium text-center">
                            Drag up to {maxIngredients} {mode === 'base_video' ? 'video' : 'reference image(s)'} here
                        </p>
                        <p className="text-xs opacity-70 text-center max-w-[200px]">
                            {getModeHelperText()}
                        </p>
                    </div>
                ) : (
                    <div className="flex gap-4 w-full justify-center" onClick={(e) => e.stopPropagation()}>
                        {ingredients.map((ing, index) => (
                            <div key={ing.id} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-white/20 bg-black/50 flex items-center justify-center">
                                {ing.type === 'video' ? (
                                    <video src={ing.dataUrl} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                                ) : (
                                    <img src={ing.dataUrl} alt="Ingredient" className="w-full h-full object-cover" />
                                )}
                                {mode === 'transition' && (
                                    <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold text-white/90">
                                        {index === 0 ? 'Start' : 'End'}
                                    </div>
                                )}
                                <button
                                    onClick={() => removeIngredient(ing.id)}
                                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Remove asset"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        {!isFull && (
                            <div 
                                className="w-24 h-24 rounded-lg border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-muted-foreground hover:bg-white/5 hover:border-white/40 cursor-pointer transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={20} className="mb-1" />
                                <span className="text-[10px] font-bold uppercase">{ingredients.length}/{maxIngredients}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
