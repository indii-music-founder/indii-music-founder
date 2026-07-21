import React, { useMemo, useRef, useState } from 'react';
import { FileText, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { endpointService } from '@/core/config/EndpointService';

/**
 * Public, unauthenticated page for a payment collaborator to submit their
 * own W-9/W-8BEN via a single-use token link (ISSUE-1118 Phase 2). Reached
 * directly at /tax-form-upload?token=... — bypasses the normal login gate
 * entirely (see App.tsx's isTaxFormUploadPage branch), since the
 * collaborator has no indii account.
 */

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
        reader.readAsDataURL(file);
    });
}

export function TaxFormUploadPage() {
    const token = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const params = new URLSearchParams(window.location.search);
        const value = params.get('token');
        return value && /^[a-fA-F0-9]{64}$/.test(value) ? value : null;
    }, []);

    const [file, setFile] = useState<File | null>(null);
    const [state, setState] = useState<SubmitState>('idle');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = e.target.files?.[0] ?? null;
        setError(null);
        if (!selected) {
            setFile(null);
            return;
        }
        if (!ALLOWED_MIME_TYPES.includes(selected.type)) {
            setError(`Unsupported file type "${selected.type || 'unknown'}". Upload a PDF, PNG, or JPEG.`);
            setFile(null);
            return;
        }
        if (selected.size > MAX_SIZE_BYTES) {
            setError(`File too large (${(selected.size / 1024 / 1024).toFixed(1)}MB). Max 20MB.`);
            setFile(null);
            return;
        }
        setFile(selected);
    }

    async function handleSubmit() {
        if (!token || !file) return;
        setState('submitting');
        setError(null);
        try {
            const fileBase64 = await fileToBase64(file);
            const response = await fetch(endpointService.getFunctionUrl('submitTaxForm'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    fileBase64,
                    fileName: file.name,
                    contentType: file.type,
                }),
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || `Upload failed (${response.status}).`);
            }

            setState('success');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed.');
            setState('error');
        }
    }

    return (
        <div className="min-h-screen w-screen bg-black text-white flex items-center justify-center px-6">
            <div className="w-full max-w-md">
                <div className="flex items-center gap-2 mb-8 justify-center">
                    <span className="text-lg font-bold">indii.music</span>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                    {!token ? (
                        <div className="text-center">
                            <AlertCircle size={24} className="text-red-400 mx-auto mb-3" />
                            <h1 className="text-sm font-bold mb-1">Invalid Link</h1>
                            <p className="text-xs text-gray-500">
                                This tax form upload link is missing or malformed. Ask the artist to send a new one.
                            </p>
                        </div>
                    ) : state === 'success' ? (
                        <div className="text-center">
                            <CheckCircle size={24} className="text-green-400 mx-auto mb-3" />
                            <h1 className="text-sm font-bold mb-1">Form Submitted</h1>
                            <p className="text-xs text-gray-500">
                                Your tax form was received. You can close this page.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-4">
                                <FileText size={16} className="text-amber-400" />
                                <h1 className="text-sm font-bold">Submit Your Tax Form</h1>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                                Upload your completed W-9 or W-8BEN (PDF, PNG, or JPEG, max 20MB). This link can only be used once.
                            </p>

                            {error && (
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 mb-4">
                                    <AlertCircle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-red-300/80 leading-relaxed">{error}</p>
                                </div>
                            )}

                            <button
                                onClick={() => inputRef.current?.click()}
                                disabled={state === 'submitting'}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 text-xs font-bold transition-colors mb-3"
                            >
                                <Upload size={12} />
                                {file ? file.name : 'Choose File'}
                            </button>
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                aria-label="Tax form file"
                                onChange={handleFileChange}
                            />

                            <button
                                onClick={handleSubmit}
                                disabled={!file || state === 'submitting'}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 text-amber-400 text-xs font-bold transition-colors"
                            >
                                {state === 'submitting' ? <Loader2 size={12} className="animate-spin" /> : null}
                                {state === 'submitting' ? 'Submitting…' : 'Submit Form'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
