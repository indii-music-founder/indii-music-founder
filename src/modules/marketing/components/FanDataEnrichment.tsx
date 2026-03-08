import React, { useState } from 'react';
import {
    Upload, Users, Database, Download, Loader2,
    CheckCircle, BarChart2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type EnrichmentProvider = 'Clearbit' | 'Apollo';

interface EnrichedRow {
    email: string;
    name: string;
    location: string;
    age_range: string;
    income_bracket: string;
    top_genre: string;
}

const MOCK_ENRICHED_DATA: EnrichedRow[] = [
    { email: 'maya.chen@gmail.com', name: 'Maya Chen', location: 'Los Angeles, CA', age_range: '25-34', income_bracket: '$60k-$80k', top_genre: 'R&B' },
    { email: 'marcus.jones@outlook.com', name: 'Marcus Jones', location: 'Atlanta, GA', age_range: '18-24', income_bracket: '$30k-$45k', top_genre: 'Hip-Hop' },
    { email: 'sara.morales@icloud.com', name: 'Sara Morales', location: 'Miami, FL', age_range: '25-34', income_bracket: '$45k-$60k', top_genre: 'Afrobeats' },
    { email: 'tyler.scott@yahoo.com', name: 'Tyler Scott', location: 'New York, NY', age_range: '35-44', income_bracket: '$80k-$120k', top_genre: 'Jazz/Soul' },
    { email: 'priya.patel@gmail.com', name: 'Priya Patel', location: 'Chicago, IL', age_range: '18-24', income_bracket: '$25k-$35k', top_genre: 'Electronic' },
];

const MOCK_CONTACT_COUNT = 547;

export default function FanDataEnrichment() {
    const [provider, setProvider] = useState<EnrichmentProvider>('Clearbit');
    const [fileLoaded, setFileLoaded] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [progress, setProgress] = useState(0);
    const [enriched, setEnriched] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFileLoaded(true);
            setEnriched(false);
            setProgress(0);
        }
    };

    const handleEnrich = () => {
        setEnriching(true);
        setProgress(0);

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setEnriching(false);
                    setEnriched(true);
                    return 100;
                }
                return prev + 8;
            });
        }, 120);
    };

    const handleExport = () => {
        const header = 'email,name,location,age_range,income_bracket,top_genre\n';
        const rows = MOCK_ENRICHED_DATA
            .map(r => `${r.email},${r.name},${r.location},${r.age_range},${r.income_bracket},${r.top_genre}`)
            .join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'enriched_fans.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-3xl">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database size={18} className="text-dept-marketing" />
                    Fan Data Enrichment
                </h2>
                <p className="text-xs text-gray-500 mt-1">Upload fan emails and enrich with demographic data via Clearbit or Apollo.</p>
            </div>

            {/* Upload CSV */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Upload Fan Email CSV
                </label>
                <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-dept-marketing/30 transition-all cursor-pointer bg-white/[0.02] group">
                    <Upload size={24} className="text-gray-600 group-hover:text-dept-marketing transition-colors" />
                    <span className="text-xs text-gray-500 text-center">
                        {fileLoaded
                            ? <span className="text-dept-marketing font-semibold flex items-center gap-1.5"><CheckCircle size={13} /> {MOCK_CONTACT_COUNT} contacts loaded</span>
                            : 'Drop your CSV here or click to browse'
                        }
                    </span>
                    <input type="file" accept=".csv" className="sr-only" onChange={handleFileUpload} />
                </label>
            </div>

            {/* Provider Toggle */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Enrichment Provider
                </label>
                <div className="flex gap-2">
                    {(['Clearbit', 'Apollo'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setProvider(p)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                provider === p
                                    ? 'bg-dept-marketing text-white shadow-lg shadow-dept-marketing/20'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Enrich Button */}
            <button
                onClick={handleEnrich}
                disabled={!fileLoaded || enriching}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-dept-marketing text-white font-semibold text-sm hover:bg-dept-marketing/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-dept-marketing/20"
            >
                {enriching ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Enriching via {provider}...
                    </>
                ) : (
                    <>
                        <BarChart2 size={16} />
                        Enrich Data
                    </>
                )}
            </button>

            {/* Progress */}
            <AnimatePresence>
                {enriching && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex justify-between text-xs text-gray-400 mb-2">
                                <span>Enriching {MOCK_CONTACT_COUNT} contacts...</span>
                                <span>{Math.min(progress, 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-dept-marketing rounded-full"
                                    animate={{ width: `${Math.min(progress, 100)}%` }}
                                    transition={{ duration: 0.1 }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Enriched Preview Table */}
            <AnimatePresence>
                {enriched && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-3"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white flex items-center gap-2">
                                <CheckCircle size={14} className="text-green-400" />
                                {MOCK_CONTACT_COUNT} contacts enriched via {provider}
                            </p>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:border-white/20 transition-all"
                            >
                                <Download size={12} />
                                Export CSV
                            </button>
                        </div>

                        {/* Table */}
                        <div className="rounded-xl border border-white/5 overflow-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/[0.03]">
                                        {['Email', 'Name', 'Location', 'Age Range', 'Income', 'Top Genre'].map(col => (
                                            <th key={col} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOCK_ENRICHED_DATA.map((row, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="px-3 py-2.5 text-gray-400 font-mono">{row.email}</td>
                                            <td className="px-3 py-2.5 text-white font-medium">{row.name}</td>
                                            <td className="px-3 py-2.5 text-gray-400">{row.location}</td>
                                            <td className="px-3 py-2.5 text-gray-400">{row.age_range}</td>
                                            <td className="px-3 py-2.5 text-gray-400">{row.income_bracket}</td>
                                            <td className="px-3 py-2.5">
                                                <span className="px-2 py-0.5 rounded bg-dept-marketing/15 text-dept-marketing font-medium">
                                                    {row.top_genre}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="border-b border-white/5 bg-white/[0.01]">
                                        <td colSpan={6} className="px-3 py-2.5 text-center text-[10px] text-gray-600">
                                            Showing 5 of {MOCK_CONTACT_COUNT} enriched contacts
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
