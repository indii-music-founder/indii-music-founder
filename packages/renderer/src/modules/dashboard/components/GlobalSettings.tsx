import React from 'react';
import { Sliders, Monitor, Globe } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { PrivacySettingsPanel } from '@/components/shared/PrivacySettingsPanel';
import { useTranslation } from 'react-i18next';

const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español (es-419)' },
];

export default function GlobalSettings() {
    const { userProfile, setUserProfile } = useStore(
        useShallow(state => ({
            userProfile: state.userProfile,
            setUserProfile: state.setUserProfile,
        }))
    );
    const { i18n } = useTranslation();

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

    return (
        <div className="bg-[#161b22]/50 backdrop-blur-md border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Global Config</h2>

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

            <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Globe size={12} /> Language
                </h3>
                <div className="flex gap-2">
                    {SUPPORTED_LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => i18n.changeLanguage(lang.code)}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${i18n.resolvedLanguage?.startsWith(lang.code)
                                    ? 'bg-white/10 border-white/20 text-white font-semibold'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5">
                <PrivacySettingsPanel />
            </div>
        </div>
    );
}
