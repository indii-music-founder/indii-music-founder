import { useEffect, useMemo, useState } from 'react';
import { createCallable } from 'react-call';
import {
    PRINT_MEDIA_PRESETS,
    planPrintOutput,
    getPrintPreset,
    type PrintPlan,
    type PrintVerdict,
} from '@/services/print/PrintSpec';
import { Modal } from './Modal';

interface PrintSpecProps {
    srcWidth: number;
    srcHeight: number;
    initialPresetId?: string;
    /** Injectable export sink (tests). Default: no export — callers holding the master deliver the file. */
    sourceUrl?: string;
    exporter?: (plan: PrintPlan, progress: (fraction: number) => void) => Promise<void | { href: string; filename: string }>;
}

const VERDICT_STYLES: Record<PrintVerdict, { badge: string; label: string }> = {
    sufficient: { badge: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30', label: 'Resolution sufficient' },
    upscale: { badge: 'bg-amber-600/20 text-amber-300 border-amber-500/30', label: 'Upscale needed' },
    insufficient: { badge: 'bg-red-600/20 text-red-300 border-red-500/30', label: 'Target not reachable' },
};

/**
 * PrintSpecDialog — pre-flight print verdict for one image (PRD Workstream 1).
 *
 * Awaited dialog: `const plan = await PrintSpecDialog.call({ srcWidth, srcHeight })`.
 * Resolves the selected PrintPlan, or null when dismissed. Pure display over
 * the pure PrintSpec planner — no service calls, no canvas.
 */
export const PrintSpecDialog = createCallable<PrintSpecProps, PrintPlan | null>(({
    call,
    srcWidth,
    srcHeight,
    initialPresetId = 'vinyl_sleeve',
    exporter,
    sourceUrl,
}) => {
    const [presetId, setPresetId] = useState(initialPresetId);
    const preset = getPrintPreset(presetId)!;
    const [dpi, setDpi] = useState(preset.dpi);
    const [progress, setProgress] = useState(0);
    const [download, setDownload] = useState<{ href: string; filename: string } | null>(null);
    useEffect(() => () => { if (download) URL.revokeObjectURL(download.href); }, [download]);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const plan: PrintPlan = useMemo(
        () => planPrintOutput({ srcWidth, srcHeight, presetId, dpi }),
        [srcWidth, srcHeight, presetId, dpi],
    );
    const style = VERDICT_STYLES[plan.verdict];

    return (
        <Modal isOpen={true} onClose={() => { if (!exporting) call.end(download ? plan : null); }} titleId="printspec-dialog-title" maxWidth="max-w-lg">
            <div className="p-6" data-testid="printspec-dialog">
                <h2 id="printspec-dialog-title" className="text-xl font-bold text-white mb-1">Print Size Check</h2>
                <p className="text-xs text-gray-500 mb-4">Source {srcWidth} × {srcHeight} px</p>

                <label className="block text-xs text-gray-400 mb-1" htmlFor="printspec-preset">Print target</label>
                <select
                    id="printspec-preset"
                    data-testid="printspec-preset-select"
                    value={presetId}
                    disabled={exporting}
                    onChange={(e) => { setPresetId(e.target.value); setDpi(getPrintPreset(e.target.value)!.dpi); setDownload(null); setExportError(null); }}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                    {PRINT_MEDIA_PRESETS.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                </select>

                {preset.minDpi < preset.dpi && <label className="block text-xs text-gray-300 mb-3">Resolution
                    <select aria-label="Print resolution" value={dpi} disabled={exporting} onChange={e => { setDpi(Number(e.target.value)); setDownload(null); }} className="ml-2 bg-gray-900 rounded p-1">
                        <option value={preset.dpi}>{preset.dpi} DPI (preferred)</option>
                        <option value={preset.minDpi}>{preset.minDpi} DPI (confirm with printer)</option>
                    </select>
                </label>}
                {sourceUrl && <figure className="mb-3">
                    <div className="relative mx-auto max-h-36 overflow-hidden bg-gray-900" style={{ width: Math.min(250, 144 * plan.required.width / plan.required.height), aspectRatio: `${plan.required.width} / ${plan.required.height}` }}>
                        <img src={sourceUrl} alt="Centered crop preview of the print artwork" className="w-full h-full object-cover" />
                        {plan.foldsIn?.map(fold => <div key={fold} aria-label={`Fold at ${fold} inches`} className="absolute top-0 bottom-0 border-l border-dashed border-amber-300 pointer-events-none" style={{ left: `${100 * (plan.bleedIn + fold) / plan.exportMeta.widthIn}%` }} />)}
                        {plan.bleedIn > 0 && <>
                            <div className="absolute border border-red-400 pointer-events-none" style={{ left: `${100 * plan.bleedIn / plan.exportMeta.widthIn}%`, right: `${100 * plan.bleedIn / plan.exportMeta.widthIn}%`, top: `${100 * plan.bleedIn / plan.exportMeta.heightIn}%`, bottom: `${100 * plan.bleedIn / plan.exportMeta.heightIn}%` }} />
                            <div className="absolute border border-dashed border-green-300 pointer-events-none" style={{ left: `${100 * (plan.bleedIn + plan.safeIn) / plan.exportMeta.widthIn}%`, right: `${100 * (plan.bleedIn + plan.safeIn) / plan.exportMeta.widthIn}%`, top: `${100 * (plan.bleedIn + plan.safeIn) / plan.exportMeta.heightIn}%`, bottom: `${100 * (plan.bleedIn + plan.safeIn) / plan.exportMeta.heightIn}%` }} />
                        </>}
                    </div>
                    <figcaption className="text-xs text-gray-400 text-center mt-1">Centered crop · red: trim · green: safe area · amber: folds. Review text and logos before ordering.</figcaption>
                </figure>}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-semibold mb-3 ${style.badge}`} data-testid="printspec-verdict">
                    {style.label}
                </div>

                <p className="text-white font-mono text-sm mb-1" data-testid="printspec-summary">{plan.summary}</p>
                {plan.bleedIn > 0 && (
                    <p className="text-xs text-gray-300 mb-1">Bleed: {plan.bleedIn}″ each edge · keep important content {plan.safeIn}″ inside trim.</p>
                )}
                {plan.handoff && <p className="text-xs text-amber-200 mb-3">{plan.handoff}</p>}
                <p className="text-xs text-gray-400 mb-4">
                    Source covers {plan.requiredUpscaleFactor <= 1 ? 'fully' : `${plan.requiredUpscaleFactor}× short of`} this target

                </p>

                {plan.warnings.length > 0 && (
                    <ul className="space-y-1.5 mb-4" data-testid="printspec-warnings">
                        {plan.warnings.map(w => (
                            <li key={w} className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded px-2.5 py-1.5">
                                ⚠ {w}
                            </li>
                        ))}
                    </ul>
                )}

                {exporting && <p role="status" className="text-xs text-purple-300 mb-3">{progress > 0 ? `Enlarging artwork: ${Math.round(progress * 100)}%` : 'Loading the enlargement model…'} Keep this tab open.</p>}
                {download && <p role="status" className="text-xs text-emerald-300 mb-3">Prepared {plan.required.width} × {plan.required.height} px at {plan.dpi} DPI. Download includes print settings.</p>}
                {exportError && <p role="alert" className="text-xs text-red-300 mb-3">{exportError}</p>}

                <div className="flex justify-end gap-3">
                    <button
                        className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                        disabled={exporting}
                        onClick={() => call.end(download ? plan : null)}
                    >
                        Close
                    </button>
                    {download ? <a href={download.href} download={download.filename} data-testid="printspec-download" className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white">Download print files</a> : <button
                        className="px-4 py-2 text-sm font-medium rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-60"
                        data-testid="printspec-use-plan"
                        disabled={exporting || plan.verdict === 'insufficient'}
                        onClick={async () => {
                            setExporting(true);
                            setExportError(null);
                            setProgress(0);
                            try {
                                const result = await exporter?.(plan, setProgress);
                                if (result) setDownload(result); else call.end(plan);
                            } catch (error) {
                                setExportError(error instanceof Error ? error.message : 'Print export failed.');
                            } finally {
                                setExporting(false);
                            }
                        }}
                    >
                        {exporting ? 'Preparing…' : plan.verdict === 'upscale' ? 'Upscale & export' : plan.verdict === 'insufficient' ? 'Target unavailable' : 'Export print file'}
                    </button>}
                </div>
            </div>
        </Modal>
    );
});

// E2E seam (ISSUE-328): same precedent as window.useStore — the callable is
// exposed in DEV so structural tests can open the real dialog without
// pixel-hunting nested panel menus. Never exposed in production builds.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__printSpecDialog = PrintSpecDialog;
}
