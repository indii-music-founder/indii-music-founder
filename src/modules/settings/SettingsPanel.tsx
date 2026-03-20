/**
 * Settings Module — User Profile, Connected Services, Notifications & Preferences
 *
 * This is the central hub for all user-configurable options.
 * Each settings section has been extracted into its own component:
 *
 * - ProfileSection       → Name, avatar, bio editing
 * - ConnectionsSection   → Email integrations, push notifications
 * - NotificationsSection → Alert preferences and digest settings
 * - AppearanceSection    → Theme, compact mode, animations
 * - SecuritySection      → Auth info, audit log, data export, account management
 *
 * Shared UI primitives (SectionHeader, SettingRow, Toggle, SelectDropdown)
 * live in SettingsShared.tsx.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    User,
    Bell,
    Link2,
    Palette,
    Shield,
} from 'lucide-react';

import ProfileSection from './settings-panel/ProfileSection';
import ConnectionsSection from './settings-panel/ConnectionsSection';
import NotificationsSection from './settings-panel/NotificationsSection';
import AppearanceSection from './settings-panel/AppearanceSection';
import SecuritySection from './settings-panel/SecuritySection';

// ---------------------------------------------------------------------------
// Types & Navigation Config
// ---------------------------------------------------------------------------

type SettingsSection = 'profile' | 'connections' | 'notifications' | 'appearance' | 'security';

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: React.ElementType; description: string }> = [
    { id: 'profile', label: 'Profile', icon: User, description: 'Name, avatar, and bio' },
    { id: 'connections', label: 'Connected Services', icon: Link2, description: 'Email, social, and integrations' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Push, email, and sound preferences' },
    { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme, layout, and animations' },
    { id: 'security', label: 'Account & Security', icon: Shield, description: 'Sign out, data export, delete' },
];

// ---------------------------------------------------------------------------
// Main Settings Panel (Thin Shell)
// ---------------------------------------------------------------------------

const SettingsPanel: React.FC = () => {
    const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

    const renderSection = () => {
        switch (activeSection) {
            case 'profile': return <ProfileSection />;
            case 'connections': return <ConnectionsSection />;
            case 'notifications': return <NotificationsSection />;
            case 'appearance': return <AppearanceSection />;
            case 'security': return <SecuritySection />;
        }
    };

    return (
        <div className="h-full flex bg-[--bg]">
            {/* Sidebar Nav */}
            <div className="w-56 flex-shrink-0 border-r border-slate-800 p-4 space-y-1 hidden md:block">
                <h1 className="text-sm font-bold text-white mb-4 px-3">Settings</h1>
                {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                                isActive
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                            }`}
                        >
                            <Icon size={16} />
                            <span className="text-sm font-medium">{section.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Mobile Nav */}
            <div className="md:hidden flex gap-1 p-3 border-b border-slate-800 overflow-x-auto w-full absolute top-0 left-0 bg-[--bg] z-10">
                {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                activeSection === section.id
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-slate-500 hover:text-white'
                            }`}
                        >
                            <Icon size={14} />
                            {section.label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 pt-16 md:pt-8">
                <div className="max-w-2xl">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.15 }}
                        >
                            {renderSection()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
