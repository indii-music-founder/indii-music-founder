import React from 'react';
import { Box, ScanEye } from 'lucide-react';

export const ARAssetViewer: React.FC<{ assetUrl?: string }> = ({ assetUrl }) => {
    // Mock Augmented Reality Asset Viewing (Item 197)
    return (
        <div className="w-full h-[400px] bg-gray-900 rounded-2xl border border-gray-800 flex flex-col items-center justify-center relative overflow-hidden group">
            {/* Fake 3D environment grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [transform:perspective(500px)_rotateX(60deg)] origin-bottom opacity-50" />

            <div className="z-10 bg-black/50 p-4 rounded-full border border-white/10 mb-4 backdrop-blur-md">
                <Box size={48} className="text-teal-400" />
            </div>
            <h3 className="text-xl font-bold text-white z-10 mb-2">AR Model Viewer Ready</h3>
            <p className="text-gray-400 text-sm z-10 max-w-sm text-center mb-6">
                WebXR API is initialized. Drop a physical merch mockup here to view it in your physical space.
            </p>
            <button className="z-10 flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-black px-6 py-3 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(45,212,191,0.3)]">
                <ScanEye size={20} /> Launch AR Mode
            </button>
        </div>
    );
};
