/**
 * Notifications Settings Section
 *
 * Controls push notifications, sounds, email digest frequency,
 * agent activity alerts, and budget warning thresholds.
 */

import React from 'react';
import {
    Bell,
    Mail,
    Volume2,
    Globe,
    AlertTriangle,
} from 'lucide-react';
import { StoreState, useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { SectionHeader, SettingRow, Toggle, SelectDropdown } from './SettingsShared';

const NotificationsSection: React.FC = () => {
    const { userProfile, updatePreferences } = useStore(useShallow((s: StoreState) => ({
        userProfile: s.userProfile,
        updatePreferences: s.updatePreferences,
    })));

    const prefs = userProfile?.preferences || {};

    // Derive values with defaults
    const pushEnabled = prefs.notifications ?? true;
    const notificationSound = prefs.notificationSound ?? true;
    const emailDigest = prefs.emailDigest ?? 'daily';
    const agentActivityAlerts = prefs.agentActivityAlerts ?? true;
    const budgetAlerts = prefs.budgetAlerts ?? true;

    return (
        <div>
            <SectionHeader
                title="Notifications"
                description="Control how and when you receive alerts."
            />

            <div className="space-y-1">
                <SettingRow icon={Bell} label="Push Notifications" description="Receive browser/mobile push alerts">
                    <Toggle
                        enabled={pushEnabled}
                        onChange={(v) => updatePreferences({ notifications: v })}
                    />
                </SettingRow>

                <SettingRow
                    icon={Volume2}
                    label="Notification Sounds"
                    description="Play a sound for new notifications"
                >
                    <Toggle
                        enabled={notificationSound}
                        onChange={(v) => updatePreferences({ notificationSound: v })}
                    />
                </SettingRow>

                <SettingRow
                    icon={Mail}
                    label="Email Digest"
                    description="Receive summary emails of activity"
                >
                    <SelectDropdown
                        value={emailDigest}
                        options={[
                            { value: 'realtime', label: 'Real-time' },
                            { value: 'daily', label: 'Daily' },
                            { value: 'weekly', label: 'Weekly' },
                            { value: 'off', label: 'Off' },
                        ]}
                        onChange={(v) => updatePreferences({ emailDigest: v as 'realtime' | 'daily' | 'weekly' | 'off' })}
                    />
                </SettingRow>

                <SettingRow
                    icon={Globe}
                    label="Agent Activity Alerts"
                    description="Get notified when agents complete tasks"
                >
                    <Toggle
                        enabled={agentActivityAlerts}
                        onChange={(v) => updatePreferences({ agentActivityAlerts: v })}
                    />
                </SettingRow>

                <SettingRow
                    icon={AlertTriangle}
                    label="Budget Alerts"
                    description="Warn when AI usage nears budget limits"
                >
                    <Toggle
                        enabled={budgetAlerts}
                        onChange={(v) => updatePreferences({ budgetAlerts: v })}
                    />
                </SettingRow>
            </div>
        </div>
    );
};

export default NotificationsSection;
