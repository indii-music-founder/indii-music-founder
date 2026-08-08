import { useEffect, useMemo, useState } from 'react';
import {
    ORGANIZATION_ACCESS_MODULES,
    ORGANIZATION_ACCESS_MODULE_LABELS,
    defaultModulesForOrganizationRole,
    type OrganizationAccessModule,
    type OrganizationRole,
} from '@indii/shared';
import { AlertTriangle, Loader2, RefreshCw, Save, ShieldCheck } from 'lucide-react';

import { useOrganizationAccess } from '@/core/context/OrganizationAccessContext';

type EditableRole = Exclude<OrganizationRole, 'owner'>;

interface DraftPolicy {
    role: EditableRole;
    allowedModules: OrganizationAccessModule[];
}

const EDITABLE_ROLES: EditableRole[] = ['manager', 'producer', 'member'];

function memberLabel(member: { userId: string; displayName: string | null; email: string | null }): string {
    return member.displayName || member.email || `Member ${member.userId.slice(0, 8)}`;
}

export function AccessControlPane() {
    const {
        activeOrganizationId,
        status,
        error,
        matrix,
        currentMember,
        refresh,
        updateMember,
    } = useOrganizationAccess();
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [draft, setDraft] = useState<DraftPolicy | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const visibleMembers = useMemo(() => matrix?.members ?? [], [matrix?.members]);
    const selectedMember = useMemo(
        () => visibleMembers.find(member => member.userId === selectedUserId)
            ?? currentMember
            ?? visibleMembers[0]
            ?? null,
        [currentMember, selectedUserId, visibleMembers],
    );

    useEffect(() => {
        if (!selectedMember) {
            setDraft(null);
            return;
        }
        setSelectedUserId(selectedMember.userId);
        setDraft(selectedMember.role === 'owner'
            ? null
            : {
                role: selectedMember.role,
                allowedModules: [...selectedMember.allowedModules],
            });
        setSaveError(null);
        setSaved(false);
    }, [selectedMember]);

    if (!activeOrganizationId) {
        return (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-gray-500 px-4">
                Select an organization to view its permission matrix.
            </div>
        );
    }

    if (status === 'loading' || status === 'idle') {
        return (
            <div className="flex-1 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                Verifying organization permissions…
            </div>
        );
    }

    if (status === 'error' || !matrix || !selectedMember) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-4">
                <AlertTriangle size={24} className="text-red-400" />
                <p className="text-xs text-red-300">{error || 'Organization permissions are unavailable.'}</p>
                <button
                    type="button"
                    onClick={() => void refresh()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white"
                >
                    <RefreshCw size={13} /> Retry verification
                </button>
            </div>
        );
    }

    const canEditSelected = matrix.canManage && selectedMember.role !== 'owner' && draft !== null;
    const effectiveModules = selectedMember.role === 'owner'
        ? selectedMember.allowedModules
        : draft?.allowedModules ?? selectedMember.allowedModules;

    const toggleModule = (moduleId: OrganizationAccessModule) => {
        if (!canEditSelected || !draft) return;
        setSaved(false);
        setDraft({
            ...draft,
            allowedModules: draft.allowedModules.includes(moduleId)
                ? draft.allowedModules.filter(current => current !== moduleId)
                : ORGANIZATION_ACCESS_MODULES.filter(current =>
                    current === moduleId || draft.allowedModules.includes(current)),
        });
    };

    const savePolicy = async () => {
        if (!canEditSelected || !draft || saving) return;
        setSaving(true);
        setSaveError(null);
        setSaved(false);
        try {
            await updateMember({
                targetUserId: selectedMember.userId,
                role: draft.role,
                allowedModules: draft.allowedModules,
            });
            setSaved(true);
        } catch (updateError) {
            setSaveError(updateError instanceof Error ? updateError.message : 'Permission update failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
            {matrix.canManage && visibleMembers.length > 1 ? (
                <label className="text-[10px] uppercase tracking-wider text-gray-500">
                    Member
                    <select
                        value={selectedMember.userId}
                        onChange={event => setSelectedUserId(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs normal-case tracking-normal text-white"
                    >
                        {visibleMembers.map(member => (
                            <option key={member.userId} value={member.userId}>
                                {memberLabel(member)} — {member.role}
                            </option>
                        ))}
                    </select>
                </label>
            ) : (
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-xs font-medium text-white">{memberLabel(selectedMember)}</div>
                    <div className="text-[10px] text-gray-500">Your effective organization access</div>
                </div>
            )}

            <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 flex-1">
                    Role
                    {canEditSelected && draft ? (
                        <select
                            value={draft.role}
                            onChange={event => {
                                const role = event.target.value as EditableRole;
                                setDraft({
                                    role,
                                    allowedModules: defaultModulesForOrganizationRole(role),
                                });
                                setSaved(false);
                            }}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs normal-case tracking-normal text-white"
                        >
                            {EDITABLE_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                    ) : (
                        <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs normal-case tracking-normal text-white">
                            {selectedMember.role === 'owner' && <ShieldCheck size={13} className="text-emerald-400" />}
                            {selectedMember.role}
                        </div>
                    )}
                </label>
                <div className="self-end pb-2 text-[9px] uppercase tracking-wider text-gray-600">
                    {selectedMember.source === 'explicit' ? 'custom' : selectedMember.source.replace('-', ' ')}
                </div>
            </div>

            <fieldset className="min-h-0 flex-1 overflow-y-auto custom-scrollbar rounded-xl border border-white/5 bg-black/10 p-3">
                <legend className="px-1 text-[10px] uppercase tracking-wider text-gray-500">Module access</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ORGANIZATION_ACCESS_MODULES.map(moduleId => {
                        const checked = effectiveModules.includes(moduleId);
                        return (
                            <label
                                key={moduleId}
                                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                                    checked ? 'bg-blue-500/10 text-blue-200' : 'bg-white/[0.02] text-gray-500'
                                } ${canEditSelected ? 'cursor-pointer hover:bg-white/[0.06]' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!canEditSelected}
                                    onChange={() => toggleModule(moduleId)}
                                    className="accent-blue-500"
                                />
                                <span>{ORGANIZATION_ACCESS_MODULE_LABELS[moduleId]}</span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            {canEditSelected && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => void savePolicy()}
                        className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save access
                    </button>
                    {saved && <span className="text-[10px] text-emerald-400">Saved and enforced</span>}
                    {saveError && <span className="text-[10px] text-red-400">{saveError}</span>}
                </div>
            )}
        </div>
    );
}
