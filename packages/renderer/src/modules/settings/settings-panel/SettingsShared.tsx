/**
 * Settings Shared UI Primitives
 *
 * Reusable sub-components used across all settings sections:
 * - SectionHeader: Title + description for each settings pane
 * - SettingRow: Consistent layout for a single setting with icon/label/control
 * - Toggle: On/off switch control
 * - SelectDropdown: Styled native <select>
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SettingsSection = 'profile' | 'connections' | 'notifications' | 'appearance' | 'security';

export const SECTIONS: Array<{ id: SettingsSection; label: string; icon: React.ElementType; description: string }> = [];
// NOTE: The actual SECTIONS array is defined below after icon imports in the barrel index.
// This placeholder is here for type safety; the real data lives in the parent SettingsPanel.

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

export const SectionHeader: React.FC<{ title: string; description: string }> = ({ title, description }) => (
    <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
    </div>
);

// ---------------------------------------------------------------------------
// SettingRow
// ---------------------------------------------------------------------------

export const SettingRow: React.FC<{
    icon: React.ElementType;
    label: string;
    description?: string;
    children: React.ReactNode;
}> = ({ icon: Icon, label, description, children }) => (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-800/50 last:border-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-slate-400" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium text-white">{label}</p>
                {description && <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>}
            </div>
        </div>
        <div className="flex-shrink-0">{children}</div>
    </div>
);

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

export const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
    enabled,
    onChange,
    disabled,
}) => (
    <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${enabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
    >
        <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
    </button>
);

// ---------------------------------------------------------------------------
// SelectDropdown
// ---------------------------------------------------------------------------

export const SelectDropdown: React.FC<{
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 cursor-pointer appearance-none"
    >
        {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
        ))}
    </select>
);
