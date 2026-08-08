import { Scan, ServerOff } from 'lucide-react';

/** Receipt extraction is unavailable until a protected file-ingestion callable exists. */
export function ReceiptOCR() {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Scan size={14} className="text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white">Receipt OCR</h2>
                    <p className="text-[10px] text-gray-500">Not available in this build</p>
                </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                <ServerOff size={28} className="mx-auto mb-3 text-amber-300" />
                <p className="text-sm font-semibold text-white">Receipt uploads are disabled</p>
                <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-gray-400">
                    A real implementation needs a secured upload route, OCR processing receipt, editable
                    extraction review, and durable expense persistence. No file is accepted or described as
                    analyzed until those pieces are connected.
                </p>
            </div>
        </div>
    );
}
