import React, { useState } from 'react';
import { Sliders, Monitor, Key, Eye, EyeOff } from 'lucide-react';
import { useStore } from '@/core/store';

export default function GlobalSettings() {
    const { userProfile, setUserProfile } = useStore();
    const [showKey, setShowKey] = useState(false);

    const preferences = userProfile?.preferences || {};
    const darkMode = preferences.theme === 'dark';
    const highFidelity = preferences.highFidelityMode === true;

    const handleThemeToggle = () => {
        const newTheme = darkMode ? 'light' : 'dark';
        setUserProfile({
            ...userProfile,
            preferences: {
                ...preferences,
                theme: newTheme
            }
        });
    };

    const handleFidelityToggle = () => {
        setUserProfile({
            ...userProfile,
            preferences: {
                ...preferences,
                highFidelityMode: !highFidelity
            }
        });
    };

    const maskKey = (key: string) => {
        if (!key) return '';
        if (showKey) return key;
        return `sk-...${key.slice(-4)}`;
    };

    return (
        <div className="bg-[#161b22]/50 backdrop-blur-md border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Global Config</h2>

            <div className="space-y-6">
                {/* API Key Section */}
                <div>
                    <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-2">
                        <Key size={12} /> Gemini API Key
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 bg-[#0d1117] border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono flex justify-between items-center">
                            <span>{maskKey(import.meta.env.VITE_GEMINI_API_KEY || 'AIza...key')}</span>
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Toggles */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300 text-sm">
                            <Sliders size={14} className={highFidelity ? "text-blue-400" : "text-gray-500"} />
                            High Fidelity Mode
                        </div>
                        <button
                            onClick={handleFidelityToggle}
                            className={`w-12 h-7 rounded-full relative transition-colors duration-200 ${highFidelity ? 'bg-blue-600' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${highFidelity ? 'right-1.5' : 'left-1.5'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300 text-sm">
                            <Monitor size={14} className={darkMode ? "text-purple-400" : "text-gray-500"} />
                            Dark Mode (OLED)
                        </div>
                        <button
                            onClick={handleThemeToggle}
                            className={`w-12 h-7 rounded-full relative transition-colors duration-200 ${darkMode ? 'bg-purple-600' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${darkMode ? 'right-1.5' : 'left-1.5'}`}></div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
