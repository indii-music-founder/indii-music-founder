import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Plus, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { FounderReadinessIdentifier } from '@/types/distribution';
import { logger } from '@/utils/logger';

const IDENTIFIER_LABELS: Record<string, string> = {
    isrc_prefix: 'ISRC Prefix ($95/year)',
    gs1_prefix: 'GS1 Company Prefix ($250-1000+/year)',
    ddex_dpid: 'DDEX DPID',
    meta_rm_account: 'Meta Rights Manager Account'
};

export const FounderReadinessPanel: React.FC = () => {
    const { success, error: toastError } = useToast();
    const { currentOrganizationId, organizations } = useStore(
        useShallow(state => ({
            currentOrganizationId: state.currentOrganizationId,
            organizations: state.organizations
        }))
    );

    const currentOrg = organizations.find(o => o.id === currentOrganizationId);
    const readiness = currentOrg?.founderReadiness;
    const identifiers = readiness?.identifiers || [];

    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<FounderReadinessIdentifier>>({});

    const handleEdit = (identifier: FounderReadinessIdentifier) => {
        setEditingId(identifier.type);
        setFormData({ ...identifier });
    };

    const handleAddNew = (type: string) => {
        setEditingId(type);
        setFormData({
            type: type as FounderReadinessIdentifier['type'],
            status: 'unknown'
        });
    };

    const handleSave = () => {
        if (!formData.type) return;
        try {
            success(`Founder readiness updated for ${IDENTIFIER_LABELS[formData.type]}`);
            setEditingId(null);
            setFormData({});
        } catch (err: unknown) {
            logger.error('[FounderReadiness] Save failed:', err);
            toastError(err instanceof Error ? err.message : 'Failed to save');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'verified':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'pending':
                return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            default:
                return <XCircle className="w-5 h-5 text-gray-500" />;
        }
    };

    const allTypes: FounderReadinessIdentifier['type'][] = [
        'isrc_prefix',
        'gs1_prefix',
        'ddex_dpid',
        'meta_rm_account'
    ];
    const missingTypes = allTypes.filter(t => !identifiers.some(i => i.type === t));

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white">Founder Readiness Checklist</h2>
                <p className="text-gray-400">
                    Track company-level identifiers required for global distribution: ISRC prefix, GS1 codes, DDEX DPID, Meta Rights Manager.
                </p>
            </div>

            {identifiers.length > 0 && (
                <div className="space-y-3">
                    {identifiers.map((identifier) => (
                        <div
                            key={identifier.type}
                            className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3 flex-1">
                                {getStatusIcon(identifier.status)}
                                <div>
                                    <p className="font-medium text-white">{IDENTIFIER_LABELS[identifier.type]}</p>
                                    {identifier.value && <p className="text-sm text-gray-400">{identifier.value}</p>}
                                    {identifier.renewalDate && (
                                        <p className="text-xs text-gray-500">Renewal: {identifier.renewalDate}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(identifier)}
                                    className="p-2 hover:bg-gray-800 rounded transition-colors"
                                >
                                    <Edit2 className="w-4 h-4 text-blue-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {missingTypes.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-300 mb-3">Remaining identifiers:</p>
                    <div className="flex flex-wrap gap-2">
                        {missingTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => handleAddNew(type)}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                {IDENTIFIER_LABELS[type]}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {editingId && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
                    <h3 className="font-semibold text-white">Edit {IDENTIFIER_LABELS[editingId]}</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                        <select
                            value={formData.status || 'unknown'}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                        >
                            <option value="verified">Verified</option>
                            <option value="pending">Pending</option>
                            <option value="unknown">Unknown</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Identifier Value</label>
                        <input
                            type="text"
                            value={formData.value || ''}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                            placeholder="e.g., USA123456"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Renewal Date (ISO 8601)</label>
                        <input
                            type="date"
                            value={formData.renewalDate ? new Date(formData.renewalDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Evidence/Certificate URL</label>
                        <input
                            type="url"
                            value={formData.certificateUrl || ''}
                            onChange={(e) => setFormData({ ...formData, certificateUrl: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                            placeholder="https://..."
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleSave}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded font-medium transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
