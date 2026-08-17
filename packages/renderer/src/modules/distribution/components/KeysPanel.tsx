
import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, FileText, Key, ShieldCheck } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { distributionService } from '@/services/distribution/DistributionService';
import { isrcService } from '@/services/distribution/ISRCService'; // Import ISRCService
import { MerlinReport, MerlinCheckData, MerlinTrack, BWarmWork } from '@/types/distribution';
import { ISRCRecordDocument } from '@/types/firestore';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

export const KeysPanel: React.FC = () => {
    const { success, error } = useToast();
    const { setModule, setRegistrationFocus } = useStore(
        useShallow(state => ({
            setModule: state.setModule,
            setRegistrationFocus: state.setRegistrationFocus,
        }))
    );
    const [loading, setLoading] = useState(false);
    const [statusReport, setStatusReport] = useState<MerlinReport | null>(null);
    const [bwarmCsv, setBwarmCsv] = useState<string | null>(null);
    const [catalog, setCatalog] = useState<ISRCRecordDocument[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    // ISSUE-1122: Rights evidence checklist — Merlin readiness is never assumed
    // from a locally generated value. Each item must be explicitly confirmed;
    // unconfirmed items are reported as missing proof, not defaults.
    const RIGHTS_EVIDENCE_ITEMS: Array<{ key: string; label: string }> = [
        { key: 'master_owner_confirmed', label: 'I control the master recordings' },
        { key: 'territory_confirmed', label: 'Territory of rights confirmed' },
        { key: 'no_existing_admin_obligations', label: 'No conflicting distributor/admin agreements' },
        { key: 'no_samples_or_loops', label: 'No uncleared samples or loops' },
        { key: 'content_policy_clean', label: 'Catalog complies with content policy' },
        { key: 'no_takedown_or_claim_conflicts', label: 'No takedowns or claim conflicts' },
        { key: 'supporting_documents_uploaded', label: 'Supporting rights documents on file' },
    ];
    const [rightsEvidence, setRightsEvidence] = useState<Record<string, boolean>>({});
    const allEvidenceConfirmed = RIGHTS_EVIDENCE_ITEMS.every(item => rightsEvidence[item.key] === true);

    // Fetch catalog on mount
    React.useEffect(() => {
        const fetchCatalog = async () => {
            try {
                const results = await isrcService.getUserCatalog();
                setCatalog(results);
                setDataLoaded(true);
            } catch (err: unknown) {
                logger.error('[KeysPanel] Failed to load catalog:', err);
                error('Failed to load your ISRC catalog.');
            }
        };
        fetchCatalog();
    }, [error]);

    const handleCheckMerlin = async () => {
        setLoading(true);
        setStatusReport(null);
        try {
            if (catalog.length === 0) {
                success('No tracks in catalog to check. Please assign ISRCs first.');
                return;
            }

            // Map real catalog to MerlinTrack format
            // ISSUE-1122: exclusive_rights is fail-closed (default false).
            // Only set true if explicitly verified in track metadata.
            const tracks: MerlinTrack[] = catalog.map(record => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const meta = (record.metadataSnapshot as Record<string, any>) || {};
                const confirmed = meta.exclusiveRightsConfirmed === true || meta.rights?.exclusive === true;
                return {
                    isrc: record.isrc,
                    title: record.trackTitle,
                    rights_holder: record.artistName,
                    exclusive_rights: confirmed
                };
            });

            const checkData: MerlinCheckData = {
                catalog_id: `CAT-${auth.currentUser?.uid?.substring(0, 8) || 'USER'}`,
                tracks: tracks,
                // ISSUE-1122: Send the explicit evidence checklist. Every item
                // must be confirmed; the engine reports missing proof instead
                // of assuming exclusive rights.
                rights_evidence: Object.fromEntries(
                    RIGHTS_EVIDENCE_ITEMS.map(item => [item.key, rightsEvidence[item.key] === true])
                ),
            };

            const report = await distributionService.checkMerlinStatus(checkData);
            setStatusReport(report);
            success(`Merlin Readiness Check Complete. Status: ${report.status}`);

        } catch (err: unknown) {
            error(err instanceof Error ? err.message : 'Unknown error during Merlin check');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateBWARM = async () => {
        setLoading(true);
        setBwarmCsv(null);
        try {
            if (catalog.length === 0) {
                error('No works to register. Please assign ISRCs first.');
                return;
            }

            // ISSUE-792 FIX: Extract real writer/publisher data from metadata
            // Never use fabricated defaults like "John Doe" or "Self-Published"
            const works: BWarmWork[] = [];
            const skipped: string[] = [];

            for (const record of catalog) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const meta = (record.metadataSnapshot as Record<string, any>) || {};
                const title = record.trackTitle || 'Untitled';

                // Validate splits exist and have real data
                const splits = (meta.splits as Array<{ legalName?: string; percentage?: number; email?: string }>) || [];
                if (!splits || splits.length === 0) {
                    skipped.push(`${title}: No royalty splits defined`);
                    continue;
                }

                // Validate split has real legal names
                const validSplits = splits.filter(s => s.legalName?.trim());
                if (validSplits.length === 0) {
                    skipped.push(`${title}: No valid writer legal names in splits`);
                    continue;
                }

                // Validate publisher (must be real, not "Self-Published")
                const publisher = meta.publisher?.trim();
                if (!publisher || publisher === 'Self-Published') {
                    skipped.push(`${title}: Requires real publisher name (not "Self-Published")`);
                    continue;
                }

                // Validate release date from metadata
                const releaseDate = meta.releaseDate?.trim();
                if (!releaseDate) {
                    skipped.push(`${title}: Requires release date in metadata`);
                    continue;
                }

                // Map each split to a work entry (MLC expects individual writer per row)
                for (const split of validSplits) {
                    const nameParts = (split.legalName || '').split(/\s+/);
                    const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0] || '';
                    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

                    if (!lastName) {
                        logger.warn(`[KeysPanel] Skipping split: "${split.legalName}" requires first and last name`);
                        continue;
                    }

                     
                    works.push({
                        title,
                        isrc: record.isrc,
                        artist: record.artistName,
                        // Split-specific data (ISSUE-792)
                        writer_first: firstName,
                        writer_last: lastName,
                        writer_ipi: ((split as Record<string, unknown>).ipi as string) || '',
                        publisher,
                        publisher_ipi: (meta.publisherIPI as string) || '',
                        collection_share: split.percentage || 0,
                        release_date: releaseDate,
                        id: record.id
                    } as BWarmWork);
                }
            }

            if (works.length === 0) {
                const msg = skipped.length > 0
                    ? `No complete works. Issues:\n${skipped.join('\n')}`
                    : 'No works with valid metadata for BWARM export.';
                error(msg);
                return;
            }

            if (skipped.length > 0) {
                logger.warn('[KeysPanel] Skipped works during BWARM generation:', skipped);
            }

            // DistributionService.generateBWARM returns the CSV string directly (unwrapped)
            const csv = await distributionService.generateBWARM({ works });
            setBwarmCsv(csv);
            success(`BWARM CSV Generated (${works.length} writer entries). Ready for download.`);
        } catch (err: unknown) {
            error(err instanceof Error ? err.message : 'Unknown error during BWARM generation');
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (!bwarmCsv) return;
        const blob = new Blob([bwarmCsv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `indii_BWARM_Export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const openRegistrationCenter = (orgId: 'mlc' | 'soundexchange') => {
        setRegistrationFocus({
            trackId: catalog[0]?.id ?? null,
            orgId,
        });
        setModule('registration');
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Merlin Readiness Card */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-5 h-5 text-dept-creative" />
                        <h3 className="font-bold text-white">Merlin Network Compliance</h3>
                    </div>

                    {!statusReport ? (
                        <div className="text-center py-8 text-gray-500">
                            <p className="text-sm mb-4">
                                {dataLoaded
                                    ? `Check compliance for ${catalog.length} track${catalog.length === 1 ? '' : 's'} in your catalog.`
                                    : 'Loading catalog...'}
                            </p>

                            {/* ISSUE-1122: Rights-evidence checklist */}
                            <div className="text-left max-w-md mx-auto mb-4 bg-black/30 rounded-lg p-3 text-xs space-y-1.5">
                                <p className="text-gray-300 font-semibold mb-2 flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Rights Evidence (required for exclusive-rights confirmation)
                                </p>
                                {RIGHTS_EVIDENCE_ITEMS.map(item => (
                                    <label key={item.key} className="flex items-start gap-2 cursor-pointer text-gray-400 hover:text-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={rightsEvidence[item.key] === true}
                                            onChange={(e) => setRightsEvidence(prev => ({
                                                ...prev,
                                                [item.key]: e.target.checked,
                                            }))}
                                            className="mt-0.5 accent-dept-creative"
                                        />
                                        <span>{item.label}</span>
                                    </label>
                                ))}
                            </div>

                            <button
                                data-testid="keys-run-compliance-audit"
                                onClick={handleCheckMerlin}
                                disabled={loading || !dataLoaded || catalog.length === 0}
                                className="px-4 py-2 bg-dept-creative hover:bg-dept-creative/80 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto disabled:cursor-not-allowed"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Run Compliance Audit
                            </button>
                            <p className="text-[11px] mt-2 text-gray-600">
                                {allEvidenceConfirmed
                                    ? 'All evidence confirmed — exclusive rights will be reported as verified.'
                                    : 'Unconfirmed evidence items are reported as missing proof (never assumed).'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span
                                    data-testid="keys-compliance-status"
                                    className={`text-sm font-bold ${statusReport.status === 'READY' ? 'text-dept-licensing' : 'text-dept-royalties'
                                        }`}>
                                    Status: {statusReport.status}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">
                                    Passed: {statusReport.passed_count} / Failed: {statusReport.failed_count}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-dept-creative h-full rounded-full transition-all duration-500"
                                    style={{ width: `${(statusReport.passed_count / (statusReport.passed_count + statusReport.failed_count)) * 100}%` }}
                                />
                            </div>

                            <div className="bg-black/30 rounded-lg p-3 text-xs space-y-2 max-h-32 overflow-y-auto">
                                {statusReport.issues.length === 0 ? (
                                    <div className="flex items-center gap-2 text-dept-licensing">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>All checks passed. Catalog is ready for registration.</span>
                                    </div>
                                ) : (
                                    statusReport.issues.map((check, i) => (
                                        <div key={i} className="flex items-start gap-2 text-red-300">
                                            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>{check}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button
                                data-testid="keys-run-check-again"
                                onClick={() => setStatusReport(null)}
                                className="w-full mt-4 px-4 py-2 border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg text-sm transition-colors"
                            >
                                Run Check Again
                            </button>
                        </div>
                    )}
                </div>

                {/* MLC / Keys Card */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-dept-distribution/20 rounded-lg">
                            <Key className="w-6 h-6 text-dept-distribution" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">The MLC Bridge</h3>
                            <p className="text-sm text-gray-400">Mechanical Licensing Collective</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                            <h4 className="text-sm font-medium text-white mb-2">BWARM Generation</h4>
                            <p className="text-xs text-gray-400 mb-4">
                                Generate Bulk Works Registration (BWARM) CSV for The MLC. Requires: royalty splits with real writer legal names, publisher, and release dates. No fabricated data.
                            </p>

                            {bwarmCsv ? (
                                <div className="space-y-3">
                                    <div className="p-3 bg-dept-licensing/10 border border-dept-licensing/20 rounded text-xs font-mono text-dept-licensing truncate">
                                        CSV Generated ({bwarmCsv.length} bytes)
                                    </div>
                                    <button
                                        data-testid="keys-download-bwarm-csv"
                                        onClick={downloadCSV}
                                        className="w-full px-3 py-2 bg-dept-licensing hover:bg-dept-licensing/80 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Download CSV
                                    </button>
                                    <button
                                        data-testid="keys-clear-bwarm-csv"
                                        onClick={() => setBwarmCsv(null)}
                                        className="w-full px-3 py-2 text-gray-400 hover:text-white text-xs transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <button
                                    data-testid="keys-generate-bwarm-csv"
                                    onClick={handleGenerateBWARM}
                                    disabled={loading}
                                    className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium border border-white/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    Generate BWARM CSV
                                </button>
                            )}
                        </div>

                        <div className="pt-4 border-t border-gray-800">
                            <h4 className="text-sm font-medium text-white mb-2">External Connections</h4>
                            <div className="flex gap-2">
                                <button
                                    data-testid="keys-open-mlc-registration"
                                    onClick={() => openRegistrationCenter('mlc')}
                                    disabled={catalog.length === 0}
                                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Open MLC Registration
                                </button>
                                <button
                                    data-testid="keys-open-soundexchange-registration"
                                    onClick={() => openRegistrationCenter('soundexchange')}
                                    disabled={catalog.length === 0}
                                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Open SoundExchange
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
