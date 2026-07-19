/**
 * Appearance Settings Section
 *
 * Controls theme (dark/light/system), compact mode, and animation preferences.
 */

import React from 'react';
import {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Moon,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Sun,
    Palette,
    RefreshCw,
    Sparkles,
} from 'lucide-react';
import { StoreState, useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { SectionHeader, SettingRow, Toggle, SelectDropdown } from './SettingsShared';

const AppearanceSection: React.FC = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userProfile, updatePreferences, setTheme: storeSetTheme } = useStore(useShallow((s: StoreState) => ({
        userProfile: s.userProfile,
        updatePreferences: s.updatePreferences,
        setTheme: s.setTheme,
    })));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prefs = (userProfile?.preferences || {}) as any;
    const compactMode = prefs.compactMode ?? false;
    const animationsEnabled = prefs.animationsEnabled ?? true;
    const agentAmbition = prefs.agentAmbition ?? 'balanced';

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

                <SettingRow icon={Sparkles} label="Agent Ideas" description="How many unsolicited ideas your agents offer. They never act on an idea unless you ask.">
                    <SelectDropdown
                        value={agentAmbition}
                        options={[
                            { value: 'focused', label: 'Heads down' },
                            { value: 'balanced', label: 'Balanced' },
                            { value: 'ideas', label: 'Bring me ideas' },
                        ]}
                        onChange={(v) => updatePreferences({ agentAmbition: v as 'focused' | 'balanced' | 'ideas' })}
                    />
                </SettingRow>
            </div>
        </div>
    );
};

export default AppearanceSection;
