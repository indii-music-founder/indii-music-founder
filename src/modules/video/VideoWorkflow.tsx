import React, { useState, useEffect } from 'react';
import { Film, X } from 'lucide-react';
import { useStore } from '../../core/store';
import CreativeGallery from '../creative/components/CreativeGallery';
import { useToast } from '../../core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

export default function VideoWorkflow() {
    const { generatedHistory, selectedItem, uploadedImages, pendingPrompt, setPendingPrompt, addToHistory } = useStore();
    const toast = useToast();
    const [isGenerating, setIsGenerating] = useState(false);

    // Find the most recent video or the selected item if it's a video
    const activeVideo = selectedItem?.type === 'video' ? selectedItem : generatedHistory.find(item => item.type === 'video');

    useEffect(() => {
        if (pendingPrompt) {
            handleGenerate(pendingPrompt);
            setPendingPrompt(null);
        }
    }, [pendingPrompt]);

    const handleGenerate = async (prompt: string) => {
        setIsGenerating(true);
        toast.info('Directing scene...');
        try {
            // Call the Creative Director Agent via Firebase Functions
            const creativeDirectorAgent = httpsCallable(functions, 'creativeDirectorAgent');
            const response = await creativeDirectorAgent({ prompt });
            const data = response.data as any;
            const result = data.result;

            if (result.success && result.data) {
                // Handle different response types (image vs video)
                // The agent might return a video URL or an image URL (storyboard)
                // For now, let's assume it returns a standard format we can adapt

                // Note: The agent tool returns { success, data }
                // We need to parse the inner data

                const assetUrl = result.data.url || result.mockUrl; // Fallback to mockUrl if provided by tool stub

                const newAsset = {
                    id: Date.now().toString(),
                    type: (assetUrl.includes('.mp4') ? 'video' : 'image') as 'video' | 'image',
                    url: assetUrl,
                    prompt: prompt,
                    timestamp: Date.now(),
                    projectId: 'default'
                };

                addToHistory(newAsset);
                toast.success('Scene generated!');
            } else {
                throw new Error(result.error || 'Generation failed');
            }

        } catch (error: any) {
            console.error("Video generation failed:", error);
            toast.error(`Generation failed: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const renderStage = () => {
        if (isGenerating) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-pulse">
                    <div className="w-24 h-24 bg-neon-purple/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(176,38,255,0.3)]">
                        <Film size={48} className="text-neon-purple animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Generating Scene...</h2>
                    <p className="text-gray-500 max-w-md">
                        AI is rendering your vision. This may take a moment.
                    </p>
                </div>
            );
        }

        if (activeVideo) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8">
                    <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800 relative group">
                        {activeVideo.url.startsWith('data:image') ? (
                            <div className="relative w-full h-full">
                                <img src={activeVideo.url} alt={activeVideo.prompt} className="w-full h-full object-contain" />
                                <div className="absolute top-4 left-4 bg-purple-600/90 text-white px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg">
                                    Storyboard Preview
                                </div>
                            </div>
                        ) : (
                            <video
                                src={activeVideo.url}
                                controls
                                autoPlay
                                loop
                                className="w-full h-full object-contain"
                            />
                        )}
                    </div>
                    <div className="mt-6 text-center">
                        <p className="text-gray-400 text-sm max-w-2xl mx-auto italic">"{activeVideo.prompt}"</p>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-24 h-24 bg-gray-800/50 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-purple-900/10">
                    <Film size={48} className="text-gray-600" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Direct</h2>
                <p className="text-gray-500 max-w-md">
                    Enter a prompt in the command bar (Cmd+K) to generate a video.
                </p>
            </div>
        );
    };

    return (
        <div className="flex-1 flex overflow-hidden h-full">
            {/* Stage Area */}
            <div className="flex-1 relative bg-[#0f0f0f] overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1">
                    {renderStage()}
                </div>
            </div>

            {/* Right Sidebar - Gallery */}
            <div className="w-80 border-l border-gray-800 bg-[#111] flex flex-col z-10">
                <CreativeGallery />
            </div>
        </div>
    );
}
