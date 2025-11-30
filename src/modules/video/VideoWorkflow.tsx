import React, { useState } from 'react';
import { Film, X } from 'lucide-react';
import { useStore } from '../../core/store';
import CreativeGallery from '../creative/components/CreativeGallery';
import { useToast } from '../../core/context/ToastContext';

export default function VideoWorkflow() {
    const { generatedHistory, selectedItem, uploadedImages } = useStore();
    const toast = useToast();

    // Find the most recent video or the selected item if it's a video
    const activeVideo = selectedItem?.type === 'video' ? selectedItem : generatedHistory.find(item => item.type === 'video');

    // Local state for frame designer (if we still need it, but the user wanted to remove the wizard)
    // The previous code had a frame designer modal, let's keep it if it's useful for the gallery, 
    // but the main request was to remove the wizard steps.
    // Actually, the frame selection is now handled in the Navbar via the modal I added earlier.
    // So we might not need the frame designer modal here anymore, or at least not the wizard part.
    // The previous code had `showFrameDesigner` state but it was triggered by the ReviewStep which is now gone.
    // So I will remove the frame designer modal from here as it's likely redundant or unreachable without the ReviewStep.
    // If the user needs to select frames, they do it in the Navbar now.

    const renderStage = () => {
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
                    Enter a prompt above, select your frames, and hit Generate to create your video.
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
