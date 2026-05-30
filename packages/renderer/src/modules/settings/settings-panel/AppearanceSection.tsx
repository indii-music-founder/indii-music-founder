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

    const prefs = (userProfile?.preferences || {}) as any;
    const compactMode = prefs.compactMode ?? false;
    const animationsEnabled = prefs.animationsEnabled ?? true;

    return (
        <div>
            <SectionHeader
                title="Appearance"
                description="Customize the look and feel of indii."
            />

            <div className="space-y-1">
                <SettingRow icon={Palette} label="Compact Mode" description="Reduce spacing for more content density">
                    <Toggle
                        enabled={compactMode}
                        onChange={(v) => updatePreferences({ compactMode: v })}
                    />
                </SettingRow>

                <SettingRow icon={RefreshCw} label="Animations" description="Enable smooth transitions and micro-animations. (Turn off if you experience performance issues on older hardware)">
                    <Toggle
                        enabled={animationsEnabled}
                        onChange={(v) => updatePreferences({ animationsEnabled: v })}
                    />
                </SettingRow>
            </div>
        </div>
    );
};

export default AppearanceSection;
