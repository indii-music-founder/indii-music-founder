/**
 * Automation Settings Section — Artist Operating Profile (ISSUE-1172, re-ticketed from ISSUE-1115)
 *
 * First real UI consumer of the Artist Operating Profile: lets the artist opt
 * into (or out of) autonomous computer control, plus record the business
 * goals / creative boundaries / installed software that inform agent decisions.
 * Persisted via ArtistOperatingProfileService to users/{uid}/aop/profile.
 */

import React, { useEffect, useState } from 'react';
import { MousePointerClick, ShieldAlert, Target, ShieldCheck, Laptop2, Plus, X } from 'lucide-react';
import { SectionHeader, SettingRow, Toggle } from './SettingsShared';
import { useToast } from '@/core/context/ToastContext';
import { artistOperatingProfileService } from '@/services/agent/governance/ArtistOperatingProfileService';
import { DEFAULT_ARTIST_OPERATING_PROFILE, type ArtistOperatingProfile } from '@indii/shared';
import { logger } from '@/utils/logger';

type ListField = 'businessGoals' | 'creativeBoundaries' | 'installedSoftware';

const LIST_FIELD_CONFIG: Record<ListField, { label: string; placeholder: string; icon: typeof Target }> = {
    businessGoals: { label: 'Business Goals', placeholder: 'e.g. Grow email list before next release', icon: Target },
    creativeBoundaries: { label: 'Creative Boundaries', placeholder: 'e.g. Never post without review', icon: ShieldCheck },
    installedSoftware: { label: 'Installed Software', placeholder: 'e.g. Ableton Live 12', icon: Laptop2 },
};

const ListEditor: React.FC<{
    field: ListField;
    values: string[];
    onAdd: (field: ListField, value: string) => void;
    onRemove: (field: ListField, value: string) => void;
    busy: boolean;
}> = ({ field, values, onAdd, onRemove, busy }) => {
    const [draft, setDraft] = useState('');
    const config = LIST_FIELD_CONFIG[field];
    const Icon = config.icon;

    const submit = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        onAdd(field, trimmed);
        setDraft('');
    };

    return (
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
                <Icon size={14} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-white">{config.label}</h3>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
                {values.length === 0 && (
                    <p className="text-xs text-slate-500">None recorded yet.</p>
                )}
                {values.map((value) => (
                    <span
                        key={value}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-200 bg-slate-700/60 border border-slate-600/50 rounded-full px-3 py-1"
                    >
                        {value}
                        <button
                            aria-label={`Remove ${value} from ${config.label}`}
                            onClick={() => onRemove(field, value)}
                            disabled={busy}
                            className="text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') submit();
                    }}
                    placeholder={config.placeholder}
                    className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
                <button
                    aria-label={`Add to ${config.label}`}
                    onClick={submit}
                    disabled={busy || !draft.trim()}
                    className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-3 py-1.5 rounded-lg transition-colors border border-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Plus size={14} />
                    Add
                </button>
            </div>
        </div>
    );
};

const AutomationSection: React.FC = () => {
    const { showToast } = useToast();
    const [profile, setProfile] = useState<ArtistOperatingProfile>(DEFAULT_ARTIST_OPERATING_PROFILE);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const unsubscribe = artistOperatingProfileService.onProfileChange((p) => {
            setProfile(p);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const persist = async (updates: Partial<Omit<ArtistOperatingProfile, 'schemaVersion'>>) => {
        setBusy(true);
        try {
            const next = await artistOperatingProfileService.updateProfile(updates);
            setProfile(next);
        } catch (err) {
            logger.error('[AutomationSection] Failed to update Artist Operating Profile', err);
            showToast(err instanceof Error ? err.message : 'Failed to save automation preferences', 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleListAdd = (field: ListField, value: string) => {
        const current = profile[field];
        if (current.includes(value)) return;
        void persist({ [field]: [...current, value] });
    };

    const handleListRemove = (field: ListField, value: string) => {
        void persist({ [field]: profile[field].filter((v) => v !== value) });
    };

    if (loading) {
        return (
            <div>
                <SectionHeader title="Automation" description="Loading your Artist Operating Profile..." />
            </div>
        );
    }

    return (
        <div>
            <SectionHeader
                title="Automation"
                description="Your Artist Operating Profile — the preferences and boundaries agents check before acting autonomously on your behalf."
            />

            <div className="space-y-1 mb-6">
                <SettingRow
                    icon={MousePointerClick}
                    label="Autonomous Computer Control"
                    description="Allow agents to request mouse/keyboard control of this machine (still requires per-action approval)"
                >
                    <Toggle
                        enabled={profile.permissions.autonomousComputerControl}
                        disabled={busy}
                        onChange={(enabled) =>
                            void persist({ permissions: { ...profile.permissions, autonomousComputerControl: enabled } })
                        }
                    />
                </SettingRow>

                <SettingRow
                    icon={ShieldAlert}
                    label="Allow Destructive Tools"
                    description="Permit destructive-tier tools (delete, rotate credentials, deploy) to be requested at all"
                >
                    <Toggle
                        enabled={profile.permissions.allowDestructiveTools}
                        disabled={busy}
                        onChange={(enabled) =>
                            void persist({ permissions: { ...profile.permissions, allowDestructiveTools: enabled } })
                        }
                    />
                </SettingRow>
            </div>

            <div className="space-y-3">
                <ListEditor field="businessGoals" values={profile.businessGoals} onAdd={handleListAdd} onRemove={handleListRemove} busy={busy} />
                <ListEditor field="creativeBoundaries" values={profile.creativeBoundaries} onAdd={handleListAdd} onRemove={handleListRemove} busy={busy} />
                <ListEditor field="installedSoftware" values={profile.installedSoftware} onAdd={handleListAdd} onRemove={handleListRemove} busy={busy} />
            </div>
        </div>
    );
};

export default AutomationSection;
