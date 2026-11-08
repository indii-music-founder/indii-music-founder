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
 * - DesktopSection       → App version, auto-update controls, channel/source
 * - SecuritySection      → Auth info, audit log, data export, account management
 *
 * Shared UI primitives (SectionHeader, SettingRow, Toggle, SelectDropdown)
 * live in SettingsShared.tsx.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    User,
    Coins,
    Bell,
    Link2,
    Palette,
    Shield,
    Monitor,
    Smartphone,
    Bot,
    BookOpen,
    LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ProfileSection from './settings-panel/ProfileSection';
import WalletSection from './settings-panel/WalletSection';
import PersonaFadersSection from './settings-panel/PersonaFadersSection';
import MasterPlaybookSection from './settings-panel/MasterPlaybookSection';
import ConnectionsSection from './settings-panel/ConnectionsSection';
import NotificationsSection from './settings-panel/NotificationsSection';
import AppearanceSection from './settings-panel/AppearanceSection';
import SecuritySection from './settings-panel/SecuritySection';
import DesktopSection from './settings-panel/DesktopSection';
import RemoteSection from './settings-panel/RemoteSection';
import AutomationSection from './settings-panel/AutomationSection';
import {
    getRequestedSettingsSection,
    requestSettingsSection,
    SETTINGS_SECTION_REQUEST_EVENT,
    type SettingsSectionId,
} from './SettingsNavigation';
import { getColorForModule } from '@/core/theme/moduleColors';
import { Sliders } from 'lucide-react';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types & Navigation Config
// ---------------------------------------------------------------------------

interface SettingsSectionConfig {
    id: SettingsSectionId;
    label: string;
    icon: LucideIcon;
    description: string;
}

interface SettingsCategoryConfig {
    id: string;
    label: string;
    sections: SettingsSectionConfig[];
}

const SETTING_CATEGORIES: SettingsCategoryConfig[] = [
    {
        id: 'account',
        label: 'Account & Credits',
        sections: [
            { id: 'profile', label: 'Profile', icon: User, description: 'Name, avatar, and bio' },
            { id: 'wallet', label: 'Credit Wallet', icon: Coins, description: 'Balance, top-up packs, and transaction history' },
        ],
    },
    {
        id: 'intelligence',
        label: 'AI & Directives',
        sections: [
            { id: 'playbook', label: 'Master Directive', icon: BookOpen, description: 'Living Artist Playbook and Supreme Directives' },
            { id: 'personas', label: 'Agent Personas', icon: Sliders, description: 'Personality sliders and posture for each agent' },
            { id: 'automation', label: 'Automation', icon: Bot, description: 'Artist Operating Profile — autonomy permissions and boundaries' },
        ],
    },
    {
        id: 'studio',
        label: 'Studio & Devices',
        sections: [
            { id: 'connections', label: 'Connected Services', icon: Link2, description: 'Email, social, and integrations' },
            { id: 'remote', label: 'Mobile Remote', icon: Smartphone, description: 'Pair and sync your phone or tablet' },
            { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Push, email, and sound preferences' },
        ],
    },
    {
        id: 'system',
        label: 'System & Security',
        sections: [
            { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme, layout, and animations' },
            { id: 'desktop', label: 'Desktop & Updates', icon: Monitor, description: 'App version, auto-updates' },
            { id: 'security', label: 'Account & Security', icon: Shield, description: 'Sign out, data export, delete' },
        ],
    },
];

const SECTIONS: SettingsSectionConfig[] = SETTING_CATEGORIES.flatMap((c) => c.sections);

// ---------------------------------------------------------------------------
// Main Settings Panel (Thin Shell)
// ---------------------------------------------------------------------------

const SettingsPanel: React.FC = () => {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState<SettingsSectionId>(getRequestedSettingsSection);
    const moduleColor = getColorForModule('settings');

    useEffect(() => {
        const handleSectionRequest = (event: Event) => {
            const section = (event as CustomEvent<SettingsSectionId>).detail;
            setActiveSection(section);
        };
        window.addEventListener(SETTINGS_SECTION_REQUEST_EVENT, handleSectionRequest);
        return () => window.removeEventListener(SETTINGS_SECTION_REQUEST_EVENT, handleSectionRequest);
    }, []);

    const selectSection = (section: SettingsSectionId) => {
        setActiveSection(section);
        requestSettingsSection(section);
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'profile': return <ProfileSection />;
            case 'wallet': return <WalletSection />;
            case 'personas': return <PersonaFadersSection />;
            case 'playbook': return <MasterPlaybookSection />;
            case 'connections': return <ConnectionsSection />;
            case 'remote': return <RemoteSection />;
            case 'notifications': return <NotificationsSection />;
            case 'appearance': return <AppearanceSection />;
            case 'automation': return <AutomationSection />;
            case 'desktop': return <DesktopSection />;
            case 'security': return <SecuritySection />;
            default:
                logger.warn(`[SettingsPanel] Unrecognized section: ${activeSection}, falling back to ProfileSection`);
                return <ProfileSection />;
        }
    };

    return (
        <div className="h-full flex bg-[--bg]">
            {/* Sidebar Nav */}
            <div className="w-60 flex-shrink-0 border-r border-slate-800 p-4 space-y-5 hidden md:block overflow-y-auto custom-scrollbar">
                <h1 className="text-sm font-bold text-white px-2 tracking-wide uppercase text-xs text-slate-400">{t('settings.title')}</h1>
                {SETTING_CATEGORIES.map((category) => (
                    <div key={category.id} className="space-y-1">
                        <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-2 mb-1.5">
                            {category.label}
                        </div>
                        {category.sections.map((section) => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;
                            return (
                                <button
                                    key={section.id}
                                    data-tab={section.id}
                                    data-testid={`settings-tab-${section.id}`}
                                    onClick={() => selectSection(section.id)}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                                        isActive
                                            ? `${moduleColor.bg} ${moduleColor.text} border ${moduleColor.border}`
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                                    }`}
                                >
                                    <Icon size={15} />
                                    <span className="text-xs font-medium">{t(`settings.sections.${section.id}.label`, { defaultValue: section.label })}</span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Mobile Nav */}
            <div className="md:hidden flex gap-1 p-3 border-b border-slate-800 overflow-x-auto w-full absolute top-0 left-0 bg-[--bg] z-10">
                {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    return (
                        <button
                            key={section.id}
                            data-tab={section.id}
                            data-testid={`settings-tab-${section.id}-mobile`}
                            onClick={() => selectSection(section.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                activeSection === section.id
                                    ? `${moduleColor.bg} ${moduleColor.text}`
                                    : 'text-slate-500 hover:text-white'
                            }`}
                        >
                            <Icon size={14} />
                            {t(`settings.sections.${section.id}.label`, { defaultValue: section.label })}
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
