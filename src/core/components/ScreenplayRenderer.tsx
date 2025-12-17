import React from 'react';
import { FileText, Clapperboard } from 'lucide-react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

interface ScreenplayElement {
    type: 'slugline' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition';
    text: string;
}

interface ScreenplayData {
    title: string;
    author?: string;
    elements: ScreenplayElement[];
}

interface ScreenplayRendererProps {
    data: ScreenplayData | string;
}

export default function ScreenplayRenderer({ data }: ScreenplayRendererProps) {
    const { setPrompt, setGenerationMode } = useStore();
    const toast = useToast();

    // Parse data if it's a string
    const screenplay: ScreenplayData | null = typeof data === 'string' ? (() => {
        try {
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    })() : data;

    if (!screenplay || !screenplay.elements) return null;

    const handleGenerateScene = (slugline: string) => {
        setPrompt(`Generate a visual script for the scene: ${slugline}`);
        setGenerationMode('image'); // Switch to image mode to generate the visual breakdown
        toast.success(`Analyzing scene: ${slugline}`);
    };

    return (
        <div className="bg-[#fcfaf9] text-black font-mono rounded-lg border border-gray-300 shadow-xl my-6 overflow-hidden max-w-3xl mx-auto">
            {/* Header / Binder Strip */}
            <div className="bg-[#e3dedb] p-3 border-b border-[#d1ccc9] flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 text-gray-700">
                    <FileText size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">
                        {screenplay.title || 'Screenplay Draft'}
                    </span>
                </div>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full bg-gray-400/50"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-400/50"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-400/50"></div>
                </div>
            </div>

            {/* Script Content */}
            <div className="p-8 md:p-12 min-h-[400px] text-sm md:text-base space-y-4 leading-relaxed font-courier">
                {/* Title Page Simulation if first element is title */}
                <div className="text-center mb-12 pb-8 border-b border-gray-200">
                    <h1 className="text-2xl font-bold underline decoration-2 underline-offset-4 uppercase mb-2">{screenplay.title}</h1>
                    {screenplay.author && <p className="text-gray-500">written by {screenplay.author}</p>}
                </div>

                {screenplay.elements.map((el, idx) => {
                    switch (el.type) {
                        case 'slugline':
                            return (
                                <div key={idx} className="group relative mt-8 mb-4">
                                    <button
                                        onClick={() => handleGenerateScene(el.text)}
                                        className="absolute -left-10 top-0 p-1.5 text-gray-400 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Breakdown this scene"
                                    >
                                        <Clapperboard size={16} />
                                    </button>
                                    <h3 className="font-bold uppercase underline decoration-gray-300 underline-offset-2">
                                        {el.text}
                                    </h3>
                                </div>
                            );
                        case 'action':
                            return <p key={idx} className="mb-4">{el.text}</p>;
                        case 'character':
                            return <div key={idx} className="mt-6 mb-0 text-center uppercase tracking-widest font-bold w-1/2 mx-auto">{el.text}</div>;
                        case 'parenthetical':
                            return <div key={idx} className="text-center text-gray-600 w-1/3 mx-auto italic">({el.text})</div>;
                        case 'dialogue':
                            return <div key={idx} className="text-center w-2/3 mx-auto mb-4">{el.text}</div>;
                        case 'transition':
                            return <div key={idx} className="text-right uppercase font-bold mt-4 mb-8">{el.text}</div>;
                        default:
                            return <p key={idx}>{el.text}</p>;
                    }
                })}
            </div>
        </div>
    );
}
