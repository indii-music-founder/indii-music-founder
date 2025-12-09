import React, { useState } from 'react';
import { Settings, Key, Sliders, Monitor } from 'lucide-react';

export default function GlobalSettings() {
    const [apiKey, setApiKey] = useState('**********************');

    return (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <Settings className="text-orange-400" size={24} />
                <h2 className="text-lg font-bold text-white">Global Config</h2>
            </div>

            <div className="space-y-6">
                {/* API Key */}
                <div>
                    <label className="flex items-center gap-2 text-xs text-gray-400 mb-2 uppercase tracking-wider">
                        <Key size={12} /> Google API Key
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
                    />
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300 text-sm">
                            <Sliders size={14} /> High Fidelity Mode
                        </div>
                        <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300 text-sm">
                            <Monitor size={14} /> Dark Mode (OLED)
                        </div>
                        <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
