/**
 * Appearance Settings Section
 *
 * Controls theme (dark/light/system), compact mode, and animation preferences.
 */

import React from 'react';
import {
    Moon,
    Sun,
    Palette,
    RefreshCw,
} from 'lucide-react';
import { StoreState, useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { SectionHeader, SettingRow, Toggle } from './SettingsShared';

const AppearanceSection: React.FC = () => {
    const { userProfile, updatePreferences, setTheme: storeSetTheme } = useStore(useShallow((s: StoreState) => ({
        userProfile: s.userProfile,
        updatePreferences: s.updatePreferences,
        setTheme: s.setTheme,
    })));

    const prefs = userProfile?.preferences || {};
    const theme = prefs.theme ?? 'dark';
    const compactMode = prefs.compactMode ?? false;
    const animationsEnabled = prefs.animationsEnabled ?? true;

    return (
        <div>
            <SectionHeader
                title="Appearance"
                description="Customize the look and feel of indiiOS."
            />

            <div className="space-y-1">
                <SettingRow icon={Moon} label="Theme" description="Choose your preferred color scheme">
                    <div className="flex gap-1">
                        {(['dark', 'light', 'system'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => storeSetTheme(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    theme === t
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                        : 'bg-slate-800/60 text-slate-400 border border-transparent hover:border-slate-700'
                                }`}
                            >
                                {t === 'dark' && <Moon size={12} className="inline mr-1" />}
                                {t === 'light' && <Sun size={12} className="inline mr-1" />}
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                </SettingRow>

                <SettingRow icon={Palette} label="Compact Mode" description="Reduce spacing for more content density">
                    <Toggle
                        enabled={compactMode}
                        onChange={(v) => updatePreferences({ compactMode: v })}
                    />
                </SettingRow>

                <SettingRow icon={RefreshCw} label="Animations" description="Enable smooth transitions and micro-animations">
                    <Toggle
                        enabled={animationsEnabled}
                        onChange={(v) => updatePreferences({ animationsEnabled: v })}
                    />
                </SettingRow>
            </div>

            {/* Theme selector fully functional — dark, light, system modes available */}
        </div>
    );
};

export default AppearanceSection;
