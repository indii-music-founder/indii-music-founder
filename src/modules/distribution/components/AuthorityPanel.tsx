import React, { useState } from 'react';
import { distributionService } from '@/services/distribution/DistributionService';
import { Loader2, Key, Barcode, FileCode, Send } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';

export const AuthorityPanel: React.FC = () => {
    const { success, error: toastError } = useToast();
    const [isrc, setIsrc] = useState<string | null>(null);
    const [upc, setUpc] = useState<string | null>(null);
    const [ddexXml, setDdexXml] = useState<string | null>(null);
    const [loading, setLoading] = useState<'isrc' | 'upc' | 'ddex' | null>(null);

    const handleGenerateISRC = async () => {
        setLoading('isrc');
        try {
            const result = await distributionService.assignISRCs();
            setIsrc(result);
            success(`ISRC Generated: ${result}`);
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'ISRC generation failed');
        } finally {
            setLoading(null);
        }
    };

    const handleGenerateUPC = async () => {
        setLoading('upc');
        try {
            const result = await distributionService.generateUPC();
            setUpc(result);
            success(`UPC Generated: ${result}`);
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'UPC generation failed');
        } finally {
            setLoading(null);
        }
    };

    const handleGenerateDDEX = async () => {
        setLoading('ddex');
        try {
            // Auto-generate identifiers if not already present
            let activeIsrc = isrc;
            let activeUpc = upc;

            if (!activeIsrc) {
                activeIsrc = await distributionService.assignISRCs();
                setIsrc(activeIsrc);
            }

            if (!activeUpc) {
                activeUpc = await distributionService.generateUPC();
                setUpc(activeUpc);
            }

            const mockRelease = {
                releaseId: 'REL-MOCK-001',
                title: 'indii Authority Test',
                artists: ['Narrow Channel'],
                tracks: [
                    { id: '1', title: 'Industrial Test Track', isrc: activeIsrc || 'US-S1Z-25-00001' }
                ],
                upc: activeUpc || '123456789012',
                label: 'indii Records'
            };
            const result = await distributionService.generateDDEX(mockRelease);
            setDdexXml(result);
            success('DDEX ERN 4.3 Message Generated');
        } catch (error) {
            toastError(error instanceof Error ? error.message : 'DDEX generation failed');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white">Authority Layer</h2>
                <p className="text-gray-400">
                    Industrial identity management. Generate ISRCs, UPCs, and DDEX ERN 4.3 messages for direct DSP delivery.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ISRC Generator */}
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-purple-400">
                        <Key className="w-5 h-5" />
                        <span className="font-bold uppercase tracking-wider text-sm">ISRC Manager</span>
                    </div>
                    <p className="text-xs text-gray-500">International Standard Recording Code. Unique identity for each sound recording.</p>

                    <button
                        onClick={handleGenerateISRC}
                        disabled={loading === 'isrc'}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading === 'isrc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                        Generate ISRC
                    </button>

                    {isrc && (
                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
                            <span className="font-mono text-purple-300 text-lg">{isrc}</span>
                        </div>
                    )}
                </div>

                {/* UPC Generator */}
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-blue-400">
                        <Barcode className="w-5 h-5" />
                        <span className="font-bold uppercase tracking-wider text-sm">UPC Registry</span>
                    </div>
                    <p className="text-xs text-gray-500">Universal Product Code. Required for album/single retail distribution.</p>

                    <button
                        onClick={handleGenerateUPC}
                        disabled={loading === 'upc'}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading === 'upc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}
                        Generate UPC
                    </button>

                    {upc && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                            <span className="font-mono text-blue-300 text-lg">{upc}</span>
                        </div>
                    )}
                </div>

                {/* DDEX Generator */}
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-orange-400">
                        <FileCode className="w-5 h-5" />
                        <span className="font-bold uppercase tracking-wider text-sm">DDEX Packager</span>
                    </div>
                    <p className="text-xs text-gray-500">Generate ERN 4.3 XML for direct ingestion by Apple, Spotify, and Amazon.</p>

                    <button
                        onClick={handleGenerateDDEX}
                        disabled={loading === 'ddex'}
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading === 'ddex' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Generate DDEX
                    </button>
                </div>
            </div>

            {/* DDEX Output */}
            {ddexXml && (
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">DDEX ERN 4.3 Output</span>
                        <button
                            onClick={() => navigator.clipboard.writeText(ddexXml)}
                            className="text-xs text-gray-500 hover:text-white transition-colors"
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                    <pre className="p-4 bg-black/50 rounded-lg overflow-x-auto text-xs text-green-400 font-mono max-h-64 overflow-y-auto custom-scrollbar">
                        {ddexXml}
                    </pre>
                </div>
            )}
        </div>
    );
};
