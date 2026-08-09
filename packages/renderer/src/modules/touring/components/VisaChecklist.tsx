import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Globe, Plus, Trash2, Sparkles, Send, MessageSquare, Check } from 'lucide-react';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';
import { useToast } from '@/core/context/ToastContext';
import { Logger } from '@/core/logger/Logger';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { AgentMessage } from '@/core/store/slices/agent';
import { createVisaPlanningEntry, loadVisaPlanningEntries, type VisaPlanningEntry } from './VisaPlanning';

type CountryKey = 'Canada' | 'UK' | 'EU' | 'Japan' | 'Australia' | 'Mexico';

const AVAILABLE_COUNTRIES: CountryKey[] = ['Canada', 'UK', 'EU', 'Japan', 'Australia', 'Mexico'];


// Interface Message is replaced by AgentMessage from store

export function VisaChecklist() {
    const { t } = useTranslation();
    const toast = useToast();

    // Load initial state from local storage or fallback to Canada
    const [entries, setEntries] = useState<VisaPlanningEntry[]>(loadVisaPlanningEntries);

    const [selectedCountry, setSelectedCountry] = useState<CountryKey>('UK');
    
    // Custom destination planning input
    const [customCountryName, setCustomCountryName] = useState('');
    const [isCreatingDraft, setIsCreatingDraft] = useState(false);

    const { sessions, createSession, addMessageToSession, clearAgentHistory } = useStore(
        useShallow(state => ({
            sessions: state.sessions,
            createSession: state.createSession,
            addMessageToSession: state.addMessageToSession,
            clearAgentHistory: state.clearAgentHistory
        }))
    );

    // Find existing visa session or fall back to default empty state
    const visaSession = Object.values(sessions).find(s => s.namespace === 'visa-advisor');
    const chatHistory = useMemo(() => visaSession?.messages.length ? visaSession.messages : [
        {
            id: 'welcome',
            role: 'model' as const,
            text: 'I can organize planning notes, but I cannot determine immigration status, required documents, eligibility, or processing time. Verify every destination with its official immigration authority or licensed counsel.'
        }
    ], [visaSession]);
    const [userInput, setUserInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Persist checklists
    useEffect(() => {
        try {
            localStorage.setItem('indii_visa_checklist_entries', JSON.stringify(entries));
        } catch (e) {
            Logger.error('VisaChecklist', 'Failed to save visa checklists', e);
        }
    }, [entries]);

    // Local storage persist for checklists only

    // Auto-scroll chat advisor
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleAddCountry = () => {
        if (entries.some(e => e.country.toLowerCase() === selectedCountry.toLowerCase())) {
            toast.error(`${selectedCountry} has already been added.`);
            return;
        }
        setEntries(prev => [...prev, createVisaPlanningEntry(selectedCountry)]);
        toast.success(`Added ${selectedCountry} to your visa checklists.`);
        
        // Advance selection to next unused country
        const unused = AVAILABLE_COUNTRIES.find(c => c !== selectedCountry && !entries.some(e => e.country === c));
        if (unused) setSelectedCountry(unused);
    };

    const handleRemoveEntry = (id: string) => {
        const removed = entries.find(e => e.id === id);
        setEntries(prev => prev.filter(e => e.id !== id));
        if (removed) {
            toast.success(`Removed ${removed.country} checklist.`);
        }
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

    const handleCreateCountryDraft = () => {
        const country = customCountryName.trim();
        if (!country) {
            toast.error("Please enter a country name.");
            return;
        }

        const normalizedCountry = country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();

        if (entries.some(e => e.country.toLowerCase() === normalizedCountry.toLowerCase())) {
            toast.error(`${normalizedCountry} is already in your checklist.`);
            return;
        }

        setIsCreatingDraft(true);
        try {
            setEntries(prev => [...prev, createVisaPlanningEntry(normalizedCountry)]);
            setCustomCountryName('');
            toast.info(`Created an unverified planning checklist for ${normalizedCountry}. Confirm requirements with an official authority.`);
        } catch (err) {
            Logger.error('VisaChecklist', 'Planning checklist creation failed', err);
            toast.error('Unable to create the planning checklist.');
        } finally {
            setIsCreatingDraft(false);
        }
    };

    const handleAskAdvisor = (queryText?: string) => {
        const query = (queryText || userInput).trim();
        if (!query) return;

        if (!queryText) {
            setUserInput('');
        }

        const userMsg: AgentMessage = {
            id: secureRandomAlphanumeric(7),
            role: 'user',
            text: query,
            timestamp: Date.now()
        };

        let activeSessionId = visaSession?.id;
        if (!activeSessionId) {
            activeSessionId = createSession('Visa Advisor', ['visa-advisor'], 'visa-advisor');
        }
        
        addMessageToSession(activeSessionId, userMsg);

        addMessageToSession(activeSessionId, {
            id: secureRandomAlphanumeric(7),
            role: 'model',
            text: 'indii cannot verify immigration classifications, eligibility, filing documents, fees, or processing times. Use the destination government’s official immigration site and confirm the facts for each traveler with licensed immigration counsel or the responsible authority.',
            timestamp: Date.now(),
        });
    };

    const handleClearChat = () => {
        if (visaSession?.id) {
            clearAgentHistory(visaSession.id);
        }
        toast.info("Advisor chat log cleared.");
    };

    const totalDocs = entries.reduce((sum, e) => sum + e.docs.length, 0);
    const checkedDocs = entries.reduce((sum, e) => sum + e.docs.filter(d => d.checked).length, 0);
    const progressPct = totalDocs > 0 ? Math.round((checkedDocs / totalDocs) * 100) : 0;
    const availableToAdd = AVAILABLE_COUNTRIES.filter(c => !entries.some(e => e.country === c));

    // Verification prompts stay inside the product's evidence boundary.
    const presetPrompts = [
        { label: 'What must be verified?', query: 'Which facts require official verification?' },
        { label: 'Where should I check?', query: 'Where should I verify current immigration rules?' },
        { label: 'What should I collect?', query: 'What planning information should I collect before speaking with counsel?' },
    ];

    return (
        <div className="space-y-6 pb-8 selection:bg-blue-500/20">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/5">
                        <Globe size={20} className="text-blue-400 animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                            Visa & Immigration
                            <span className="text-[10px] normal-case font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center gap-1">
                                <Sparkles size={10} /> Planning only
                            </span>
                        </h2>
                        <p className="text-xs text-gray-500">Unverified planning notes · Official immigration review required</p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-200/80">
                This workspace does not determine visa type, eligibility, required filings, fees, or processing time. Requirements depend on each traveler and engagement. Verify every item with the destination government or licensed immigration counsel.
            </div>

            {/* Layout Grid: planning checklist and verification guide */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* CHECKLISTS COLUMN */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Overall Progress */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full filter blur-2xl" />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-300">Planning Checklist Progress</span>
                            <span className="text-sm font-black text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">{progressPct}%</span>
                        </div>
                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                            <div
                                className="h-full bg-linear-to-r from-blue-600 via-blue-500 to-cyan-400 rounded-full transition-all duration-500 shadow-md shadow-blue-500/50"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-2.5">
                            <p className="text-[10px] text-gray-500">
                                {checkedDocs} of {totalDocs} planning items marked across {entries.length} destination{entries.length !== 1 ? 's' : ''}
                            </p>
                            {progressPct === 100 && totalDocs > 0 && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black tracking-widest uppercase animate-bounce">
                                    Planning Complete · Verification Pending
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Add Destination Panel */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Plus size={12} className="text-blue-400" />
                            Add Tour Destination
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Option A: Preset Selector */}
                            <div className="space-y-1.5">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest">Select From Presets</label>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedCountry}
                                        onChange={e => setSelectedCountry(e.target.value as CountryKey)}
                                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                                        disabled={availableToAdd.length === 0}
                                    >
                                        {availableToAdd.length > 0 ? (
                                            availableToAdd.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))
                                        ) : (
                                            <option>All presets added</option>
                                        )}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleAddCountry}
                                        disabled={availableToAdd.length === 0}
                                        className="flex items-center justify-center px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold border border-blue-500/20 hover:border-blue-500/40 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                        Add Preset
                                    </button>
                                </div>
                            </div>

                            {/* Option B: custom destination */}
                            <div className="space-y-1.5">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest">Custom Destination</label>
                                <div className="flex gap-2 font-sans">
                                    <input
                                        type="text"
                                        placeholder={t('touring.hints.country_example')}
                                        value={customCountryName}
                                        onChange={e => setCustomCountryName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateCountryDraft()}
                                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                                        disabled={isCreatingDraft}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCreateCountryDraft}
                                        disabled={isCreatingDraft || !customCountryName.trim()}
                                        className="flex items-center justify-center gap-1.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-900/40 flex-shrink-0"
                                    >
                                        <Plus size={13} />
                                        Add Draft
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Destination Cards */}
                    <div className="space-y-4">
                        {entries.map(entry => {
                            const entryChecked = entry.docs.filter(d => d.checked).length;
                            const entryTotal = entry.docs.length;
                            const entryPct = entryTotal > 0 ? Math.round((entryChecked / entryTotal) * 100) : 0;
                            const allDone = entryTotal > 0 && entryChecked === entryTotal;

                            return (
                                <div
                                    key={entry.id}
                                    className={`bg-white/[0.01] border rounded-2xl overflow-hidden transition-all duration-300 relative group backdrop-blur-md ${allDone
                                        ? 'border-emerald-500/30 hover:border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                                        : 'border-white/5 hover:border-white/10 hover:shadow-lg hover:shadow-black/20'}`}
                                >
                                    {/* Card Border Glow */}
                                    {allDone && (
                                        <div className="absolute inset-0 bg-emerald-500/[0.02] pointer-events-none" />
                                    )}

                                    {/* Card Header */}
                                    <div className="p-5 flex items-start justify-between border-b border-white/[0.03]">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Globe size={15} className={allDone ? 'text-emerald-400' : 'text-blue-400'} />
                                                <h3 className="text-base font-black text-white">{entry.country}</h3>
                                                {allDone ? (
                                                    <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black uppercase tracking-wider">
                                                        Planning Complete
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase tracking-wider">
                                                        Unverified Draft
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-1 font-sans">{entry.visaType}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEntry(entry.id)}
                                                aria-label={`Remove ${entry.country} planning checklist`}
                                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 opacity-70 transition-all hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 group-hover:opacity-100"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Progress Mini-bar */}
                                    <div className="px-5 pt-4">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] text-gray-500 font-bold">{entryChecked} of {entryTotal} items collected</span>
                                            <span className={`text-[10px] font-black ${allDone ? 'text-emerald-400' : 'text-blue-400'}`}>{entryPct}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${entryPct}%`,
                                                    backgroundColor: allDone ? '#10b981' : '#3b82f6',
                                                    boxShadow: allDone ? '0 0 8px rgba(16,185,129,0.5)' : '0 0 8px rgba(59,130,246,0.5)'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Document Items Grid */}
                                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                                        {entry.docs.map(doc => (
                                            <button
                                                type="button"
                                                key={doc.id}
                                                onClick={() => handleToggleDoc(entry.id, doc.id)}
                                                aria-pressed={doc.checked}
                                                className={`relative flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition-all group/item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${doc.checked
                                                    ? 'bg-emerald-500/[0.02] border-emerald-500/15 hover:border-emerald-500/30'
                                                    : 'bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}`}
                                            >
                                                <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${doc.checked
                                                    ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-900/50'
                                                    : 'border-white/20 group-hover/item:border-white/40'}`}
                                                >
                                                    {doc.checked && <Check size={11} className="text-white stroke-[3px]" />}
                                                </div>
                                                <div className="flex items-center justify-between min-w-0 flex-1 gap-2">
                                                    <span className={`text-xs truncate transition-all ${doc.checked
                                                        ? 'text-gray-500 line-through'
                                                        : 'text-gray-300 font-medium'}`}
                                                    >
                                                        {doc.label}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {entries.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white/[0.01] border border-white/5 rounded-2xl text-center">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                <Globe size={20} className="text-gray-500" />
                            </div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No destinations active</p>
                            <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
                                Choose a destination to create an unverified planning checklist for official review.
                            </p>
                        </div>
                    )}
                </div>

                {/* Verification guide panel */}
                <div className="xl:col-span-1">
                    <div className="bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col h-[650px] relative overflow-hidden backdrop-blur-md shadow-xl shadow-black/20">
                        {/* Advisor Header */}
                        <div className="p-4 border-b border-white/5 bg-linear-to-b from-blue-950/20 to-transparent flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                                    <MessageSquare size={15} className="text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                                        Verification Guide
                                    </h4>
                                    <p className="text-[9px] text-gray-500 font-sans">No legal or immigration determinations</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClearChat}
                                aria-label="Clear verification guide history"
                                className="text-[9px] text-gray-600 hover:text-red-400 font-bold transition-all uppercase tracking-wider cursor-pointer"
                            >
                                Clear Chat
                            </button>
                        </div>

                        {/* Chat Feed */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin font-sans">
                            {chatHistory.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-3 text-xs leading-relaxed transition-all ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-950/30'
                                        : 'bg-white/[0.03] border border-white/5 text-gray-300 rounded-bl-none'}`}
                                    >
                                        {msg.role === 'assistant' ? (
                                            // Format text into bullet points and paragraphs
                                            <div className="space-y-2 whitespace-pre-line text-[11px]">
                                                {msg.text}
                                            </div>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                </div>
                            ))}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Preset Quick Prompts */}
                        {chatHistory.length < 3 && entries.length > 0 && (
                            <div className="p-3 bg-black/20 border-t border-white/5 space-y-2">
                                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1">Suggested Quick Questions</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {presetPrompts.map((p, idx) => (
                                        <button
                                            type="button"
                                            key={idx}
                                            onClick={() => handleAskAdvisor(p.query)}
                                            className="text-[9px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-blue-600/10 hover:border-blue-500/20 text-gray-400 hover:text-blue-300 font-sans transition-all text-left truncate max-w-full cursor-pointer"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Advisor Input Footer */}
                        <div className="p-3 border-t border-white/5 bg-black/40">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={entries.length > 0 ? 'Ask what must be officially verified…' : 'Add a destination first…'}
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAskAdvisor()}
                                    className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all font-sans"
                                    disabled={entries.length === 0}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAskAdvisor()}
                                    disabled={!userInput.trim() || entries.length === 0}
                                    aria-label="Send verification question"
                                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600 text-white hover:bg-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-900/30 flex-shrink-0 cursor-pointer"
                                >
                                    <Send size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Advisory Footnote */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-r from-amber-500/[0.01] to-transparent" />
                <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5 animate-bounce" />
                <div className="relative">
                    <p className="text-xs text-amber-300/70 leading-relaxed font-sans font-medium">
                        This is an organizational checklist, not legal advice or a readiness decision. Completing it does not authorize work or entry. Use the official destination-government source and licensed counsel for current requirements.
                    </p>
                </div>
            </div>
        </div>
    );
}
