/**
 * Items 306 & 307: Privacy Settings Panel
 *
 * Provides GDPR-compliant account management:
 *   - Item 306: Right to Erasure — "Delete My Account" wired to
 *     `requestAccountDeletion` Cloud Function
 *   - Item 307: Right to Data Portability — "Export My Data" wired to
 *     `DataExportService.exportUserData()` + browser download
 *
 * Rendered inside the Profile / Settings area.
 */
import React, { useState } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { auth } from '@/services/firebase';
import { exportUserData, downloadExport } from '@/services/account/DataExportService';
import { ShieldCheck, Download, Trash2, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ExportState = 'idle' | 'loading' | 'done' | 'error';
type DeleteState = 'idle' | 'confirming' | 'loading' | 'done' | 'error';

// ── Export Section ─────────────────────────────────────────────────────────────

function DataExportSection() {
    const [state, setState] = useState<ExportState>('idle');
    const [error, setError] = useState('');

    const handleExport = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) { setError('Not signed in.'); setState('error'); return; }

        setState('loading');
        setError('');
        try {
            const result = await exportUserData(uid);
            downloadExport(result);
            setState('done');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
            setState('error');
        }
    };

    return (
        <div className="bg-black/30 border border-white/8 rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-dept-royalties/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Download size={16} className="text-dept-royalties" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">Export My Data</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Download a complete copy of all your indiiOS data as a JSON file.
                        Includes your profile, releases, contracts, campaigns, and analytics.
                        Required under GDPR Article 20 (Right to Data Portability).
                    </p>
                </div>
            </div>

            {state === 'done' && (
                <div className="flex items-center gap-2 text-green-400 text-xs bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
                    <CheckCircle2 size={12} aria-hidden="true" />
                    Export downloaded successfully. Check your Downloads folder.
                </div>
            )}
            {state === 'error' && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    <AlertTriangle size={12} aria-hidden="true" />
                    {error}
                </div>
            )}

            <button
                onClick={handleExport}
                disabled={state === 'loading'}
                className="flex items-center gap-2 px-4 py-2 bg-dept-royalties/10 hover:bg-dept-royalties/20 border border-dept-royalties/20 rounded-lg text-sm text-dept-royalties font-medium transition-colors disabled:opacity-50"
                aria-label="Export my data"
            >
                {state === 'loading' ? (
                    <><Loader2 size={14} className="animate-spin" aria-hidden="true" />Exporting…</>
                ) : (
                    <><Download size={14} aria-hidden="true" />Download My Data</>
                )}
            </button>
        </div>
    );
}

// ── Delete Section ─────────────────────────────────────────────────────────────

function AccountDeletionSection() {
    const [state, setState] = useState<DeleteState>('idle');
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState('');
    const CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

    const handleDeleteRequest = async () => {
        if (confirmText !== CONFIRM_PHRASE) return;
        setState('loading');
        setError('');
        try {
            const fn = httpsCallable(getFunctions(), 'requestAccountDeletion');
            await fn({});
            setState('done');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Deletion request failed. Please contact support.');
            setState('error');
        }
    };

    if (state === 'done') {
        return (
            <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-5">
                <div className="flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-semibold text-white">Account deletion complete</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Your data has been permanently removed from indiiOS systems.
                            You have been signed out.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-black/30 border border-red-500/15 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Trash2 size={16} className="text-red-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">Delete My Account</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Permanently delete your indiiOS account and all associated data.
                        This action is irreversible. Required under GDPR Article 17
                        (Right to Erasure).
                    </p>
                </div>
            </div>

            {state === 'idle' && (
                <button
                    onClick={() => setState('confirming')}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm text-red-400 font-medium transition-colors"
                    aria-label="Request account deletion"
                >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete My Account
                </button>
            )}

            {state === 'confirming' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                        <AlertTriangle size={12} aria-hidden="true" />
                        This will permanently delete all your data. This cannot be undone.
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="confirm-delete" className="text-xs text-gray-400">
                            Type <span className="font-mono text-red-400">{CONFIRM_PHRASE}</span> to confirm:
                        </label>
                        <input
                            id="confirm-delete"
                            type="text"
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            placeholder={CONFIRM_PHRASE}
                            aria-label={`Type ${CONFIRM_PHRASE} to confirm deletion`}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-gray-700 focus:outline-none focus:border-red-400"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setState('idle'); setConfirmText(''); }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteRequest}
                            disabled={confirmText !== CONFIRM_PHRASE}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label="Permanently delete account"
                        >
                            <Trash2 size={14} aria-hidden="true" />
                            Permanently Delete
                        </button>
                    </div>
                </div>
            )}

            {state === 'loading' && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    Deleting your account…
                </div>
            )}

            {state === 'error' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                        <AlertTriangle size={12} aria-hidden="true" />
                        {error}
                    </div>
                    <button
                        onClick={() => setState('confirming')}
                        className="text-xs text-gray-400 hover:text-white underline"
                    >
                        Try again
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export function PrivacySettingsPanel() {
    return (
        <section aria-labelledby="privacy-heading" className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={16} className="text-dept-royalties" aria-hidden="true" />
                <h2 id="privacy-heading" className="text-sm font-bold text-white uppercase tracking-widest">
                    Privacy & Data
                </h2>
            </div>
            <p className="text-xs text-gray-500">
                Manage your personal data in accordance with GDPR and applicable privacy laws.
            </p>
            <DataExportSection />
            <AccountDeletionSection />
        </section>
    );
}
