import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Globe, Plus, Trash2, CheckSquare, Clock, AlertTriangle, FileText, Sparkles, Send, MessageSquare, Loader2, Check } from 'lucide-react';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';
import { useToast } from '@/core/context/ToastContext';
import { Logger } from '@/core/logger/Logger';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

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
        id: secureRandomAlphanumeric(7),
        country,
        visaType: data.visaType,
        processingDays: data.processingDays,
        docs: data.docs.map(d => ({ ...d, id: secureRandomAlphanumeric(7), checked: false })),
    };
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
}

export function VisaChecklist() {
    const { t } = useTranslation();
    const toast = useToast();

    // Load initial state from local storage or fallback to Canada
    const [entries, setEntries] = useState<CountryEntry[]>(() => {
        try {
            const saved = localStorage.getItem('indii_visa_checklist_entries');
            return saved ? JSON.parse(saved) : [createEntry('Canada')];
        } catch {
            return [createEntry('Canada')];
        }
    });

    const [selectedCountry, setSelectedCountry] = useState<CountryKey>('UK');
    
    // AI Custom Country Input
    const [customCountryName, setCustomCountryName] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // AI Advisor state
    const [chatHistory, setChatHistory] = useState<Message[]>(() => {
        try {
            const saved = localStorage.getItem('indii_visa_advisor_chat');
            return saved ? JSON.parse(saved) : [
                {
                    id: 'welcome',
                    role: 'assistant',
                    text: "Greetings! I am your AI Road Director. I've analyzed your tour itinerary and current documentation checklists. How can I help you expedite your visa applications today?"
                }
            ];
        } catch {
            return [
                {
                    id: 'welcome',
                    role: 'assistant',
                    text: "Greetings! I am your AI Road Director. I've analyzed your tour itinerary and current documentation checklists. How can I help you expedite your visa applications today?"
                }
            ];
        }
    });
    const [userInput, setUserInput] = useState('');
    const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Persist checklists
    useEffect(() => {
        try {
            localStorage.setItem('indii_visa_checklist_entries', JSON.stringify(entries));
        } catch (e) {
            Logger.error('VisaChecklist', 'Failed to save visa checklists', e);
        }
    }, [entries]);

    // Persist chat history
    useEffect(() => {
        try {
            localStorage.setItem('indii_visa_advisor_chat', JSON.stringify(chatHistory));
        } catch (e) {
            Logger.error('VisaChecklist', 'Failed to save visa advisor chat', e);
        }
    }, [chatHistory]);

    // Auto-scroll chat advisor
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isAdvisorLoading]);

    const handleAddCountry = () => {
        if (entries.some(e => e.country.toLowerCase() === selectedCountry.toLowerCase())) {
            toast.error(`${selectedCountry} has already been added.`);
            return;
        }
        setEntries(prev => [...prev, createEntry(selectedCountry)]);
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

    // AI Dynamic Visa Checklist Generator for ANY custom country
    const handleGenerateAICountry = async () => {
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

        setIsGeneratingAI(true);
        toast.info(`Road Director Agent is researching artist visa rules for ${normalizedCountry}...`);

        try {
            const prompt = `You are a professional music tour manager researching visa requirements for a touring artist visiting the country of "${normalizedCountry}".
Generate a precise, legally accurate checklist of visa documentation.
Respond ONLY with a valid JSON block containing the requirements. Do not output any other text, markdown formatting, or explanations. 

JSON structure:
{
  "visaType": "The specific name of the official artist/creative worker/entertainer visa or work authorization (e.g. 'O-1 B Equivalent', 'Cultural Presentation Visa', 'Short-Term Work Permit')",
  "processingDays": 25, // A realistic estimated number of days required for processing this visa
  "docs": [
    { "label": "Valid Passport (6+ months validity)", "required": true },
    { "label": "Specific document 2", "required": true },
    { "label": "Specific document 3", "required": false }
  ]
}

Include 5 to 8 total documentation items tailored exactly to what an artist entering "${normalizedCountry}" would require (e.g. contract agreements, promoter sponsor letters, itinerary, local union approval, proof of funds, travel insurance, or physical photos). Make sure at least 3-4 items are marked as required: true.`;

            const rawText = await AutonomousIntelligence.generateText(prompt);
            
            // Extract and clean JSON string from output
            let jsonString = rawText;
            const jsonStartIndex = rawText.indexOf('{');
            const jsonEndIndex = rawText.lastIndexOf('}');
            
            if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                jsonString = rawText.substring(jsonStartIndex, jsonEndIndex + 1);
            }
            
            const parsed = JSON.parse(jsonString);

            if (!parsed.visaType || !Array.isArray(parsed.docs) || parsed.docs.length === 0) {
                throw new Error("Invalid response format received from AI.");
            }

            const newEntry: CountryEntry = {
                id: secureRandomAlphanumeric(7),
                country: normalizedCountry,
                visaType: parsed.visaType,
                processingDays: Number(parsed.processingDays) || 20,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                docs: parsed.docs.map((d: any) => ({
                    id: secureRandomAlphanumeric(7),
                    label: d.label,
                    required: d.required !== undefined ? !!d.required : true,
                    checked: false
                }))
            };

            setEntries(prev => [...prev, newEntry]);
            setCustomCountryName('');
            toast.success(`AI Road Director successfully drafted the ${normalizedCountry} Visa checklist!`);
        } catch (err) {
            Logger.error('VisaChecklist', 'AI Visa Checklist Generation Failed', err);
            toast.error("Failed to generate custom country requirements. Please verify the country name and try again.");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // Ask the AI Advisor a question
    const handleAskAdvisor = async (queryText?: string) => {
        const query = (queryText || userInput).trim();
        if (!query) return;

        if (!queryText) {
            setUserInput('');
        }

        const userMsg: Message = {
            id: secureRandomAlphanumeric(7),
            role: 'user',
            text: query
        };

        setChatHistory(prev => [...prev, userMsg]);
        setIsAdvisorLoading(true);

        try {
            // Build the dynamic current context prompt for the advisor
            const activeChecklistsContext = entries.map(e => {
                const total = e.docs.length;
                const checked = e.docs.filter(d => d.checked).length;
                const pendingDocs = e.docs.filter(d => !d.checked).map(d => `${d.label}${d.required ? ' (Required)' : ''}`).join(', ');
                return `- Destination: ${e.country}\n  Visa Type: ${e.visaType}\n  Est. Processing Time: ${e.processingDays} days\n  Progress: ${checked}/${total} docs collected\n  Pending docs: ${pendingDocs || 'None - Fully Complete!'}`;
            }).join('\n\n');

            const prompt = `You are the AI Road Director for the indii-music business studio, an expert, tough, and hyper-competent international tour manager who knows embassy rules inside out.
You are counseling a band/artist on their visa and immigration requirements based on their active checklists.

Active Visa Checklists Status:
${activeChecklistsContext || "No active destinations currently selected."}

User's Question: "${query}"

Provide a highly practical, precise, and expert answer. Be direct and realistic. Use bolding and concise bullet points for critical deadlines, warning flags, or essential strategies. Limit your response to 150-220 words to keep it highly readable within the app dashboard. Always sound like an elite tour manager who gets the job done.`;

            const reply = await AutonomousIntelligence.generateText(prompt);

            const assistantMsg: Message = {
                id: secureRandomAlphanumeric(7),
                role: 'assistant',
                text: reply
            };

            setChatHistory(prev => [...prev, assistantMsg]);
        } catch (err) {
            Logger.error('VisaChecklist', 'Visa Advisor error', err);
            const errorMsg: Message = {
                id: secureRandomAlphanumeric(7),
                role: 'assistant',
                text: "My apologies. I had trouble connecting with the department database. Please rephrase your question, and let me try again."
            };
            setChatHistory(prev => [...prev, errorMsg]);
        } finally {
            setIsAdvisorLoading(false);
        }
    };

    const handleClearChat = () => {
        setChatHistory([
            {
                id: 'welcome',
                role: 'assistant',
                text: "Checklists reset. I'm ready to analyze your updated routes. What logistical info do you need?"
            }
        ]);
        toast.info("Advisor chat log cleared.");
    };

    const totalDocs = entries.reduce((sum, e) => sum + e.docs.length, 0);
    const checkedDocs = entries.reduce((sum, e) => sum + e.docs.filter(d => d.checked).length, 0);
    const progressPct = totalDocs > 0 ? Math.round((checkedDocs / totalDocs) * 100) : 0;
    const availableToAdd = AVAILABLE_COUNTRIES.filter(c => !entries.some(e => e.country === c));

    // Preset advisor prompts based on entries
    const presetPrompts = [
        { label: "O-1 Visa Pitfalls", query: "What are the biggest mistakes artists make when applying for O-1 equivalent visas?" },
        { label: "Schengen Funding", query: "How do we satisfy the proof of funding rules for the Schengen visa?" },
        { label: "Speed Up Processing", query: "Our tour dates are approaching quickly. What are the best ways to expedite processing times?" },
        { label: "Contracts Template", query: "What information must be included in our performance contracts for work permits?" }
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
                                <Sparkles size={10} /> Powered by Road Agent
                            </span>
                        </h2>
                        <p className="text-xs text-gray-500">Autonomous international touring documentation & advisory system</p>
                    </div>
                </div>
            </div>

            {/* Layout Grid: Left Side Checklist, Right Side AI Advisor */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* CHECKLISTS COLUMN */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Overall Progress */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full filter blur-2xl" />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-300">Overall Documentation Progress</span>
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
                                {checkedDocs} of {totalDocs} documents collected across {entries.length} destination{entries.length !== 1 ? 's' : ''}
                            </p>
                            {progressPct === 100 && totalDocs > 0 && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black tracking-widest uppercase animate-bounce">
                                    Tour Ready
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
                                        onClick={handleAddCountry}
                                        disabled={availableToAdd.length === 0}
                                        className="flex items-center justify-center px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold border border-blue-500/20 hover:border-blue-500/40 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                        Add Preset
                                    </button>
                                </div>
                            </div>

                            {/* Option B: AI Custom Generator */}
                            <div className="space-y-1.5">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest">Generate Custom via AI</label>
                                <div className="flex gap-2 font-sans">
                                    <input
                                        type="text"
                                        placeholder={t('touring.hints.country_example')}
                                        value={customCountryName}
                                        onChange={e => setCustomCountryName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleGenerateAICountry()}
                                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                                        disabled={isGeneratingAI}
                                    />
                                    <button
                                        onClick={handleGenerateAICountry}
                                        disabled={isGeneratingAI || !customCountryName.trim()}
                                        className="flex items-center justify-center gap-1.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-900/40 flex-shrink-0"
                                    >
                                        {isGeneratingAI ? (
                                            <Loader2 size={13} className="animate-spin" />
                                        ) : (
                                            <Sparkles size={13} />
                                        )}
                                        {isGeneratingAI ? 'Researching...' : 'AI Generate'}
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
                            const entryPct = Math.round((entryChecked / entryTotal) * 100);
                            const allDone = entryChecked === entryTotal;

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
                                                        Approved
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold uppercase tracking-wider">
                                                        In Progress
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-1 font-sans">{entry.visaType}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-1.5 text-[10px] text-amber-400 font-bold">
                                                    <Clock size={11} />
                                                    <span>~{entry.processingDays} days</span>
                                                </div>
                                                <p className="text-[9px] text-gray-600 mt-0.5 uppercase tracking-wider">processing limit</p>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveEntry(entry.id)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer opacity-40 group-hover:opacity-100"
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
                                            <div
                                                key={doc.id}
                                                onClick={() => handleToggleDoc(entry.id, doc.id)}
                                                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer group/item relative ${doc.checked
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
                                                    {doc.required && !doc.checked && (
                                                        <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-black uppercase tracking-wider flex-shrink-0">
                                                            Required
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
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
                                Choose a preset destination above or type a custom country to generate an AI visa documentation roadmap.
                            </p>
                        </div>
                    )}
                </div>

                {/* AI ADVISOR PANEL COLUMN */}
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
                                        Road Director
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    </h4>
                                    <p className="text-[9px] text-gray-500 font-sans">Active Visa Advisory Board</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClearChat}
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

                            {isAdvisorLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl rounded-bl-none px-3.5 py-3 text-xs text-gray-500 flex items-center gap-2">
                                        <Loader2 size={13} className="animate-spin text-blue-400" />
                                        <span>Road Director is calculating deadlines...</span>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Preset Quick Prompts */}
                        {chatHistory.length < 3 && entries.length > 0 && (
                            <div className="p-3 bg-black/20 border-t border-white/5 space-y-2">
                                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest px-1">Suggested Quick Questions</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {presetPrompts.map((p, idx) => (
                                        <button
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
                                    placeholder={entries.length > 0 ? "Ask a touring visa question..." : "Add a country first to activate advisor..."}
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAskAdvisor()}
                                    className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all font-sans"
                                    disabled={isAdvisorLoading || entries.length === 0}
                                />
                                <button
                                    onClick={() => handleAskAdvisor()}
                                    disabled={isAdvisorLoading || !userInput.trim() || entries.length === 0}
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
                        Visa regulations are dynamic and subject to immediate policy shifts. Always cross-reference generated requirements with official consular portals or the active embassy of each target nation. processing limits shown are based on baseline estimates.
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 border-t border-amber-500/10 pt-2">
                        <div className="flex items-center gap-1.5">
                            <FileText size={11} className="text-blue-400" />
                            <a
                                href="https://musiciansunion.org.uk"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline font-bold transition-all"
                            >
                                Musicians' Union Help Desk
                            </a>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Globe size={11} className="text-blue-400" />
                            <a
                                href="https://afm.org"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline font-bold transition-all"
                            >
                                American Federation of Musicians (AFM)
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
