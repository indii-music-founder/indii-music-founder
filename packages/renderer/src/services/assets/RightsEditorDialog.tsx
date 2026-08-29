import React, { useState } from 'react';
import { createCallable } from 'react-call';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { validateRights, type UsageRights } from '@/services/assets/AssetRightsService';

interface RightsEditorProps {
    assetId: string;
    initial?: Partial<{ usageRights: UsageRights; licenseNotes: string; releaseId: string; disclosureRequired: boolean }>;
}

/**
 * Rights editor dialog (Workstream H2). Uses the standardized react-call
 * awaited-dialog pattern (never window.prompt). Returns the chosen rights to
 * the caller so it can be persisted via AssetRightsService.setRights.
 */
export const RightsEditorDialog = createCallable<RightsEditorProps, {
    usageRights: UsageRights;
    licenseNotes?: string;
    releaseId?: string;
    disclosureRequired: boolean;
} | null>(({ call, assetId, initial }) => {
    const [usageRights, setUsageRights] = useState<UsageRights>(initial?.usageRights ?? 'ai-generated');
    const [licenseNotes, setLicenseNotes] = useState(initial?.licenseNotes ?? '');
    const [releaseId, setReleaseId] = useState(initial?.releaseId ?? '');
    const [disclosureRequired, setDisclosureRequired] = useState(initial?.disclosureRequired ?? usageRights === 'ai-generated');
    const [error, setError] = useState<string | null>(null);

    const submit = () => {
        const rights = { usageRights, licenseNotes, releaseId, disclosureRequired };
        const errors = validateRights(rights);
        if (errors.length > 0) {
            setError(errors.join('; '));
            return;
        }
        call.end(rights);
    };

    return (
        <Modal isOpen={true} onClose={() => call.end(null)} titleId="rights-editor-title" maxWidth="max-w-md">
            <div className="p-6">
                <h2 id="rights-editor-title" className="mb-4 text-xl font-bold text-white">Rights · {assetId}</h2>

                <label className="mb-4 block text-xs text-gray-400">
                    Usage rights
                    <select
                        data-testid="rights-select"
                        value={usageRights}
                        onChange={e => {
                            const v = e.target.value as UsageRights;
                            setUsageRights(v);
                            if (v === 'ai-generated') setDisclosureRequired(true);
                            if (v === 'licensed-third-party') setDisclosureRequired(true);
                        }}
                        className="mt-1 block w-full rounded border bg-black/20 p-2 text-sm text-white"
                    >
                        {(['ai-generated', 'ai-assisted', 'owned-licensed', 'licensed-third-party'] as UsageRights[]).map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </label>

                <label className="mb-4 block text-xs text-gray-400">
                    License notes (required for licensed-third-party)
                    <textarea
                        data-testid="license-notes"
                        value={licenseNotes}
                        onChange={e => setLicenseNotes(e.target.value)}
                        className="mt-1 block w-full rounded border bg-black/20 p-2 text-sm text-white"
                        rows={2}
                    />
                </label>

                <label className="mb-4 block text-xs text-gray-400">
                    Release id
                    <input
                        data-testid="release-id"
                        value={releaseId}
                        onChange={e => setReleaseId(e.target.value)}
                        className="mt-1 block w-full rounded border bg-black/20 p-2 text-sm text-white"
                    />
                </label>

                <label className="mb-5 flex items-center gap-2 text-xs text-gray-400">
                    <input type="checkbox" data-testid="disclosure-required" checked={disclosureRequired} onChange={e => setDisclosureRequired(e.target.checked)} />
                    Disclosure required
                </label>

                {error && <p data-testid="rights-error" className="mb-3 text-xs text-red-500">{error}</p>}

                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => call.end(null)}>Cancel</Button>
                    <Button variant="default" onClick={submit} data-testid="rights-save">Save rights</Button>
                </div>
            </div>
        </Modal>
    );
});
