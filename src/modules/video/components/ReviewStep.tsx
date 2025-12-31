import React from 'react';
import { ArrowLeft, Video, Loader2, Image as ImageIcon, Trash2, PenTool } from 'lucide-react';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

interface ReviewStepProps {
    finalPrompt: string;
    onBack: () => void;
    onGenerate: () => void;
    isGenerating: boolean;
    startFrameData: string | null;
    endFrameData: string | null;
    onDesignFrame: (type: 'start' | 'end') => void;
    onClearFrame: (type: 'start' | 'end') => void;
    ingredients: HistoryItem[];
    onAddIngredient: () => void;
    onRemoveIngredient: (index: number) => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
    finalPrompt,
    onBack,
    onGenerate,
    isGenerating,
    startFrameData,
    endFrameData,
    onDesignFrame,
    onClearFrame,
    ingredients,
    onAddIngredient,
    onRemoveIngredient
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
                <h3 className="text-lg font-bold text-white mb-4">Final Production Brief</h3>
                <div className="bg-black/50 p-4 rounded-lg border border-gray-700 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {finalPrompt}
                </div>
            </div>

            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Visual Control</h3>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Optional</span>
                </div>

                <div className="flex gap-4">
                    {/* Start Frame */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Start Frame</label>
                        {startFrameData ? (
                            <div className="relative group w-40 aspect-video rounded-lg overflow-hidden border border-gray-700">
                                <img src={startFrameData} alt="Start Frame" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => onDesignFrame('start')} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 text-white" title="Edit">
                                        <PenTool size={14} />
                                    </button>
                                    <button onClick={() => onClearFrame('start')} className="p-2 bg-red-600 rounded-full hover:bg-red-500 text-white" title="Remove">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => onDesignFrame('start')}
                                className="w-40 aspect-video rounded-lg border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-purple-500/5 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-purple-400 transition-all"
                            >
                                <ImageIcon size={24} />
                                <span className="text-xs font-medium">Add Start Frame</span>
                            </button>
                        )}
                    </div>

                    {/* End Frame */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">End Frame</label>
                        {endFrameData ? (
                            <div className="relative group w-40 aspect-video rounded-lg overflow-hidden border border-gray-700">
                                <img src={endFrameData} alt="End Frame" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => onDesignFrame('end')} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 text-white" title="Edit">
                                        <PenTool size={14} />
                                    </button>
                                    <button onClick={() => onClearFrame('end')} className="p-2 bg-red-600 rounded-full hover:bg-red-500 text-white" title="Remove">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => onDesignFrame('end')}
                                className="w-40 aspect-video rounded-lg border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-purple-500/5 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-purple-400 transition-all"
                            >
                                <ImageIcon size={24} />
                                <span className="text-xs font-medium">Add End Frame</span>
                            </button>
                        )}
                    </div>

                    <div className="flex-1 text-sm text-gray-400 ml-4">
                        <p className="mb-2">Control the opening and closing shots of your video.</p>
                        <p className="text-xs text-gray-500">
                            Use the Frame Designer to sketch, upload, or generate the exact composition for the start and end of the sequence.
                        </p>
                    </div>
                </div>
            </div>

            {/* Ingredients Section */}
            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Ingredients (Character/Style Reference)</h3>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Veo 3.1</span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {ingredients.map((img, idx) => (
                        <div key={img.id || idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-700">
                            <img src={img.url} alt="Ingredient" className="w-full h-full object-cover" />
                            <button
                                onClick={() => onRemoveIngredient(idx)}
                                className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    {ingredients.length < 3 && (
                        <button
                            onClick={onAddIngredient}
                            className="aspect-square rounded-lg border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-purple-500/5 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-purple-400 transition-all"
                        >
                            <ImageIcon size={24} />
                            <span className="text-xs font-medium">Add Reference</span>
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-2">Upload up to 3 images to guide the character or style consistency.</p>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} /> Back
                </button>
                <button
                    onClick={onGenerate}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg font-bold transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Rendering Video...
                        </>
                    ) : (
                        <>
                            <Video size={20} /> Generate Video
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ReviewStep;
