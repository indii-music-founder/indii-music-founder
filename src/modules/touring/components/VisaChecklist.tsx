import React, { useState } from 'react';
import { Globe, Plus, Trash2, CheckSquare, Clock, AlertTriangle, FileText } from 'lucide-react';

/* ================================================================== */
/*  Visa / Immigration Checklist — International Tour Documentation    */
/* ================================================================== */

interface VisaDoc {
    id: string;
    label: string;
    required: boolean;
    checked: boolean;
}

interface CountryEntry {
    id: string;
    country: string;
    visaType: string;
    processingDays: number;
    docs: VisaDoc[];
}

type CountryKey = 'Canada' | 'UK' | 'EU' | 'Japan' | 'Australia' | 'Mexico';

const COUNTRY_DATA: Record<CountryKey, { visaType: string; processingDays: number; docs: { label: string; required: boolean }[] }> = {
    Canada: {
        visaType: 'O-1 Equivalent (International Artist)',
        processingDays: 30,
        docs: [
            { label: 'Valid Passport (6+ months validity)', required: true },
            { label: 'Temporary Work Permit', required: true },
            { label: 'Tour Itinerary Letter', required: true },
            { label: 'Sponsor / Promoter Letter', required: true },
            { label: 'Proof of Earnings / Contracts', required: true },
            { label: 'Travel Insurance', required: false },
            { label: 'Hotel Confirmations', required: false },
        ],
    },
    UK: {
        visaType: 'Creative Worker Visa (T5)',
        processingDays: 15,
        docs: [
            { label: 'Valid Passport', required: true },
            { label: 'Certificate of Sponsorship (CoS)', required: true },
            { label: 'Tour Itinerary', required: true },
            { label: 'Proof of Funding (min £2,530)', required: true },
            { label: 'UK Promoter / Label Sponsor Letter', required: true },
            { label: 'TB Test Results (if applicable)', required: false },
            { label: 'Travel Insurance', required: false },
        ],
    },
    EU: {
        visaType: 'Schengen Artist / Cultural Visa',
        processingDays: 15,
        docs: [
            { label: 'Valid Passport', required: true },
            { label: 'Schengen Visa Application Form', required: true },
            { label: 'Tour Itinerary & Venue Contracts', required: true },
            { label: 'Proof of Accommodation', required: true },
            { label: 'Travel Health Insurance (€30,000 min)', required: true },
            { label: 'Sponsor / Promoter Invitation Letter', required: true },
            { label: 'Round-trip Flight Reservation', required: false },
        ],
    },
    Japan: {
        visaType: 'Entertainer Visa (Article 2, Para 1)',
        processingDays: 45,
        docs: [
            { label: 'Valid Passport', required: true },
            { label: 'Certificate of Eligibility (CoE)', required: true },
            { label: 'Performance Contracts', required: true },
            { label: 'Itinerary & Venue Details', required: true },
            { label: 'Proof of Professional Experience', required: true },
            { label: 'Photos (recent, passport-style)', required: true },
            { label: 'Japanese Promoter Guarantee Letter', required: false },
        ],
    },
    Australia: {
        visaType: 'Temporary Activity Visa (subclass 408)',
        processingDays: 21,
        docs: [
            { label: 'Valid Passport', required: true },
            { label: 'Subclass 408 Visa Application', required: true },
            { label: 'Australian Sponsor Statement', required: true },
            { label: 'Tour Itinerary & Performance Contracts', required: true },
            { label: 'Evidence of Professional Career', required: true },
            { label: 'Police Clearance Certificate', required: false },
            { label: 'Health Insurance', required: false },
        ],
    },
    Mexico: {
        visaType: 'FM3 Artista / No Immigrante',
        processingDays: 10,
        docs: [
            { label: 'Valid Passport', required: true },
            { label: 'FM3 Work Permit Application', required: true },
            { label: 'Promoter / Venue Invitation Letter', required: true },
            { label: 'Tour Itinerary', required: true },
            { label: 'Proof of Immigration Status (if US-based)', required: false },
            { label: 'Travel Insurance', required: false },
        ],
    },
};

const AVAILABLE_COUNTRIES = Object.keys(COUNTRY_DATA) as CountryKey[];

function createEntry(country: CountryKey): CountryEntry {
    const data = COUNTRY_DATA[country];
    return {
        id: Math.random().toString(36).slice(2, 9),
        country,
        visaType: data.visaType,
        processingDays: data.processingDays,
        docs: data.docs.map(d => ({ ...d, id: Math.random().toString(36).slice(2, 9), checked: false })),
    };
}

export function VisaChecklist() {
    const [entries, setEntries] = useState<CountryEntry[]>([createEntry('Canada')]);
    const [selectedCountry, setSelectedCountry] = useState<CountryKey>('UK');

    const handleAddCountry = () => {
        if (entries.some(e => e.country === selectedCountry)) return;
        setEntries(prev => [...prev, createEntry(selectedCountry)]);
        // Advance selection to next unused country
        const unused = AVAILABLE_COUNTRIES.find(c => c !== selectedCountry && !entries.some(e => e.country === c));
        if (unused) setSelectedCountry(unused);
    };

    const handleRemoveEntry = (id: string) => {
        setEntries(prev => prev.filter(e => e.id !== id));
    };

    const handleToggleDoc = (entryId: string, docId: string) => {
        setEntries(prev =>
            prev.map(e =>
                e.id === entryId
                    ? { ...e, docs: e.docs.map(d => d.id === docId ? { ...d, checked: !d.checked } : d) }
                    : e
            )
        );
    };

    const totalDocs = entries.reduce((sum, e) => sum + e.docs.length, 0);
    const checkedDocs = entries.reduce((sum, e) => sum + e.docs.filter(d => d.checked).length, 0);
    const progressPct = totalDocs > 0 ? Math.round((checkedDocs / totalDocs) * 100) : 0;
    const availableToAdd = AVAILABLE_COUNTRIES.filter(c => !entries.some(e => e.country === c));

    return (
        <div className="space-y-5 pb-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Globe size={16} className="text-blue-400" />
                </div>
                <div>
                    <h2 className="text-base font-black text-white uppercase tracking-tight">Visa & Immigration</h2>
                    <p className="text-[10px] text-gray-500">International touring documentation tracker</p>
                </div>
            </div>

            {/* Overall Progress */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">Overall Documentation Progress</span>
                    <span className="text-xs font-black text-blue-400">{progressPct}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">{checkedDocs} of {totalDocs} documents collected across {entries.length} destination{entries.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Add Country */}
            {availableToAdd.length > 0 && (
                <div className="flex gap-2">
                    <select
                        value={selectedCountry}
                        onChange={e => setSelectedCountry(e.target.value as CountryKey)}
                        className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                    >
                        {availableToAdd.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleAddCountry}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-xs text-blue-300 font-bold border border-blue-500/20 transition-colors"
                    >
                        <Plus size={14} />
                        Add Country
                    </button>
                </div>
            )}

            {/* Country Cards */}
            <div className="space-y-4">
                {entries.map(entry => {
                    const entryChecked = entry.docs.filter(d => d.checked).length;
                    const entryTotal = entry.docs.length;
                    const entryPct = Math.round((entryChecked / entryTotal) * 100);
                    const allDone = entryChecked === entryTotal;

                    return (
                        <div
                            key={entry.id}
                            className={`bg-white/[0.02] border rounded-xl overflow-hidden transition-colors ${allDone ? 'border-emerald-500/30' : 'border-white/5'}`}
                        >
                            {/* Card Header */}
                            <div className="p-4 flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-blue-400" />
                                        <h3 className="text-sm font-black text-white">{entry.country}</h3>
                                        {allDone && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">Ready</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{entry.visaType}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                                            <Clock size={10} />
                                            <span className="font-bold">{entry.processingDays} days</span>
                                        </div>
                                        <p className="text-[10px] text-gray-600">to process</p>
                                    </div>
                                    <button onClick={() => handleRemoveEntry(entry.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Progress mini-bar */}
                            <div className="px-4 pb-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-gray-600">{entryChecked}/{entryTotal} docs collected</span>
                                    <span className="text-[10px] font-bold text-white">{entryPct}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                            width: `${entryPct}%`,
                                            backgroundColor: allDone ? '#10b981' : '#3b82f6',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Doc Checklist */}
                            <div className="px-4 pb-4 space-y-1.5">
                                {entry.docs.map(doc => (
                                    <label
                                        key={doc.id}
                                        className="flex items-center gap-3 cursor-pointer group py-1"
                                    >
                                        <div
                                            onClick={() => handleToggleDoc(entry.id, doc.id)}
                                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${doc.checked ? 'bg-blue-500 border-blue-500' : 'border-white/20 group-hover:border-white/40'}`}
                                        >
                                            {doc.checked && <CheckSquare size={10} className="text-white" />}
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className={`text-xs transition-colors ${doc.checked ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                                {doc.label}
                                            </span>
                                            {doc.required && !doc.checked && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold flex-shrink-0">Required</span>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {entries.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                    <Globe size={24} className="text-gray-600" />
                    <p className="text-sm font-bold text-gray-500">No destinations added</p>
                    <p className="text-xs text-gray-600">Select a country above and click "Add Country"</p>
                </div>
            )}

            {/* Advisory */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-[11px] text-amber-300/70 leading-relaxed">
                        Visa requirements change frequently. Always verify with the official embassy or consulate of each destination country. Processing times shown are estimates. Consult an immigration attorney for complex touring scenarios.
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                        <FileText size={10} className="text-blue-400" />
                        <span className="text-[10px] text-blue-400">Musicians' Union (musiciansunion.org.uk) and American Federation of Musicians (afm.org) offer visa assistance.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
