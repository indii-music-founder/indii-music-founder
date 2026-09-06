import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, Sparkles, FileWarning, Unlock } from 'lucide-react';
import {
    scanAsset,
    DEFAULT_COMPLIANCE_CONFIG,
    type BrandComplianceReport,
    type ComplianceViolation,
} from '@/services/brand/BrandComplianceService';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

interface BrandCompliancePanelProps {
    targetImageUrl?: string;
    onScanComplete?: (report: BrandComplianceReport) => void;
    onOverrideApplied?: (reason: string) => void;
}

export default function BrandCompliancePanel({
    targetImageUrl,
    onScanComplete,
    onOverrideApplied,
}: BrandCompliancePanelProps): React.ReactElement {
    const selectedItem = useStore(state => state.selectedItem);
    const userProfile = useStore(state => state.userProfile);

    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [report, setReport] = useState<BrandComplianceReport | null>(null);
    const [overrideReason, setOverrideReason] = useState<string>('');
    const [isOverridden, setIsOverridden] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const activeTarget = targetImageUrl || (selectedItem?.type === 'image' ? selectedItem.url : '');
    const brandKit = userProfile?.brandKit;

    const handleScan = async () => {
        if (!activeTarget) {
            setError('Please select an artwork image to scan for brand compliance.');
            return;
        }

        if (!brandKit) {
            setError('No Brand Kit configured. Set up colors and fonts in Brand Kit first.');
            return;
        }

        setIsScanning(true);
        setError(null);
        setIsOverridden(false);

        try {
            const resolvedTarget = await resolveStorageUrl(activeTarget);
            const scanResult = await scanAsset(resolvedTarget, brandKit, {
                ...DEFAULT_COMPLIANCE_CONFIG,
            });

            setReport(scanResult);
            onScanComplete?.(scanResult);
        } catch (err) {
            logger.error('[BrandCompliancePanel] Scan failed:', err);
            setError(err instanceof Error ? err.message : 'Brand compliance scan failed.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleApplyOverride = () => {
        if (!overrideReason.trim()) {
            setError('An authorizing reason is required to override brand compliance.');
            return;
        }
        setIsOverridden(true);
        setError(null);
        onOverrideApplied?.(overrideReason.trim());
    };

    return (
        <div data-testid="brand-compliance-panel" className="flex flex-col gap-4 text-xs text-gray-300">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-purple-400" />
                    <span className="font-semibold text-white">Brand Compliance Protocols</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">CIEDE2000 Gate</span>
            </div>

            {/* Error Notification */}
            {error && (
                <div
                    data-testid="compliance-error-banner"
                    className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
                >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <div className="flex-1 text-[11px] leading-relaxed">{error}</div>
                </div>
            )}

            {/* Active Target Image Preview */}
            <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-gray-300">Asset Under Audit</label>
                {activeTarget ? (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 aspect-video bg-black/40 flex items-center justify-center">
                        <img
                            src={activeTarget}
                            alt="Audit Asset"
                            className="max-h-full max-w-full object-contain"
                        />
                        <span className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] text-gray-300">
                            Active Artwork
                        </span>
                    </div>
                ) : (
                    <div className="p-4 border border-dashed border-white/10 rounded-lg text-center text-gray-500">
                        Select an image in Creative Studio or Gallery to run compliance scan.
                    </div>
                )}
            </div>

            {/* Brand Kit Profile Quick Look */}
            <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/5 flex flex-col gap-1.5">
                <span className="text-[10px] text-gray-400 font-medium">Brand Kit Targets</span>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">Palette:</span>
                    <div className="flex items-center gap-1">
                        {brandKit?.colors && brandKit.colors.length > 0 ? (
                            brandKit.colors.slice(0, 6).map((c, i) => (
                                <span
                                    key={i}
                                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))
                        ) : (
                            <span className="text-[10px] text-amber-400">No palette defined</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">Font:</span>
                    <span className="text-[10px] text-gray-300 font-mono">
                        {brandKit?.fonts || 'System default'}
                    </span>
                </div>
            </div>

            {/* Scan Action Button */}
            <button
                type="button"
                onClick={handleScan}
                disabled={isScanning || !activeTarget}
                data-testid="scan-compliance-btn"
                className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 font-medium text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
                {isScanning ? (
                    <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Quantizing & Auditing Compliance...</span>
                    </>
                ) : (
                    <>
                        <Sparkles size={14} />
                        <span>Scan Asset for Compliance</span>
                    </>
                )}
            </button>

            {/* Report Results */}
            {report && (
                <div
                    data-testid="compliance-report-section"
                    className="flex flex-col gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 mt-1"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white">Compliance Score</span>
                            <span className="text-[10px] text-gray-500 font-mono">
                                ({report.engine} engine)
                            </span>
                        </div>
                        {report.passed || isOverridden ? (
                            <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 font-medium">
                                <CheckCircle2 size={12} />
                                {isOverridden ? 'Authorized Override' : 'Passed Gate'}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 font-medium">
                                <ShieldAlert size={12} />
                                Non-Compliant
                            </span>
                        )}
                    </div>

                    {/* Score Bar */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-400">Total Score</span>
                            <span
                                data-testid="compliance-score-readout"
                                className={`text-xl font-bold font-mono ${
                                    report.passed || isOverridden ? 'text-green-400' : 'text-red-400'
                                }`}
                            >
                                {report.score} / 100
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] text-gray-400 block">Pass Threshold</span>
                            <span className="text-xs text-gray-300 font-mono">≥ {DEFAULT_COMPLIANCE_CONFIG.passScore}</span>
                        </div>
                    </div>

                    {/* Violations List */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-medium text-gray-400">
                            Violations & Notices ({report.violations.length})
                        </span>
                        {report.violations.length === 0 ? (
                            <div className="p-2 bg-green-500/5 border border-green-500/20 rounded-lg text-green-400 text-[11px] flex items-center gap-2">
                                <CheckCircle2 size={13} />
                                <span>Zero brand deviations detected. 100% compliant.</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                                {report.violations.map((v: ComplianceViolation, idx: number) => (
                                    <div
                                        key={idx}
                                        data-testid={`violation-row-${idx}`}
                                        className={`p-2 rounded border text-[10px] flex flex-col gap-0.5 ${
                                            v.severity === 'error'
                                                ? 'bg-red-500/10 border-red-500/20 text-red-300'
                                                : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold uppercase tracking-wider text-[9px]">
                                                {v.type} ({v.severity})
                                            </span>
                                            {v.evidence?.deltaE !== undefined && (
                                                <span className="font-mono text-[9px]">
                                                    ΔE: {v.evidence.deltaE.toFixed(1)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-200 text-[10px] leading-snug">{v.detail}</p>
                                        {v.evidence?.foundHex && v.evidence?.nearestBrandHex && (
                                            <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-400">
                                                <span>Found: <span className="font-mono text-white">{v.evidence.foundHex}</span></span>
                                                <span>Nearest: <span className="font-mono text-white">{v.evidence.nearestBrandHex}</span></span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Override Form if Failed */}
                    {!report.passed && !isOverridden && (
                        <div
                            data-testid="override-gate-container"
                            className="flex flex-col gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 mt-1"
                        >
                            <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-medium">
                                <FileWarning size={13} />
                                <span>Distribution Gate Locked</span>
                            </div>
                            <p className="text-[10px] text-gray-400">
                                This asset failed brand compliance. To approve it for distribution anyway, provide a written override reason.
                            </p>
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    placeholder="e.g. Approved intentional artistic variation"
                                    value={overrideReason}
                                    onChange={e => setOverrideReason(e.target.value)}
                                    data-testid="compliance-override-input"
                                    className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyOverride}
                                    data-testid="apply-override-btn"
                                    className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/30 text-amber-200 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                    <Unlock size={12} />
                                    <span>Override</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
