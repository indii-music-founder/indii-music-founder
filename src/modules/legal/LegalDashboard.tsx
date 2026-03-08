import React, { useState } from 'react';
import { Shield, Upload, FileText, CheckCircle, AlertTriangle, Loader2, Camera, Scale, Clock, Briefcase, BookOpen, Radio } from 'lucide-react';
import { DMCANoticeGenerator } from './components/DMCANoticeGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/core/context/ToastContext';
import { GenAI as AI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';
import { LegalTools } from '@/services/agent/tools/LegalTools';
import { logger } from '@/utils/logger';

/* ================================================================== */
/*  Legal Dashboard — Three-Panel Layout                                */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Legal   │    Contract Analyzer      │   Analysis   │            */
/*  │  Templates│   (drag-drop + results)  │   History    │            */
/*  │  Quick   │                           │   Risk       │            */
/*  │  Launch  │                           │   Scores     │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

export default function LegalDashboard() {
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<null | {
        score: number;
        risks: string[];
        summary: string;
    }>(null);
    const [isGenerating, setIsGenerating] = useState<string | null>(null);
    const [analysisHistory, setAnalysisHistory] = useState<Array<{ name: string; score: number; date: string }>>([]);
    const toast = useToast();

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    };

    const handleFileUpload = async (file: File) => {
        if (file.type !== 'application/pdf' && !file.type.includes('text')) {
            toast.error("Please upload a PDF or text document.");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisResult(null);
        toast.info(`Analyzing ${file.name}...`);

        try {
            const readFileAsText = (file: File): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsText(file);
                });
            };

            const content = await readFileAsText(file);

            const systemPrompt = `
You are an expert entertainment lawyer. Analyze the provided contract text.
Return a JSON response with the following structure:
{
  "score": number (0-100 ranking how safe/standard the contract is),
  "summary": "a 2-3 sentence overview of the contract",
  "risks": ["list", "of", "major", "risks", "or", "clauses", "to", "watch"]
}
Only return valid JSON.
`;

            const response = await AI.generateContent(
                [{ role: 'user', parts: [{ text: `Contract Content:\n${content}` }] }],
                AI_MODELS.TEXT.FAST,
                { responseMimeType: 'application/json' },
                systemPrompt
            );

            const data = JSON.parse(response.response.text());

            const result = {
                score: data.score || 0,
                summary: data.summary || "No summary provided.",
                risks: data.risks || []
            };

            setAnalysisResult(result);
            setAnalysisHistory(prev => [
                { name: file.name, score: result.score, date: new Date().toLocaleDateString() },
                ...prev.slice(0, 9)
            ]);
            toast.success("Analysis complete!");
        } catch (error) {
            logger.error("Analysis failed:", error);
            toast.error("Analysis failed. Please ensure the file contains readable text.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerateNDA = async () => {
        setIsGenerating('NDA');
        try {
            const nda = await LegalTools.generate_nda({
                parties: ['[ARTIST NAME]', '[COMPANY/INDIVIDUAL NAME]'],
                purpose: 'general business discussion and project collaboration'
            });
            toast.success("NDA Template generated! Check console for output.");
        } catch (error) {
            toast.error("Failed to generate NDA.");
        } finally {
            setIsGenerating(null);
        }
    };

    const handleGenerateIPAssignment = async () => {
        setIsGenerating('IP');
        try {
            const assignment = await LegalTools.draft_contract({
                type: 'Intellectual Property Assignment',
                parties: ['[ASSIGNOR NAME]', '[ASSIGNEE NAME]'],
                terms: 'Transfer of all rights, title, and interest in and to the specified creative works.'
            });
            toast.success("IP Assignment generated! Check console for output.");
        } catch (error) {
            toast.error("Failed to generate IP Assignment.");
        } finally {
            setIsGenerating(null);
        }
    };

    const handleFindCounsel = () => {
        window.open('https://www.entertainmentlawyer.ca/directory', '_blank', 'noopener,noreferrer');
        toast.info("Opening entertainment lawyer directory...");
    };

    return (
        <div className="absolute inset-0 flex">
            {/* ── LEFT PANEL — Templates & Quick Tools ──────────── */}
            <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 flex-col border-r border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                <LegalTemplatesPanel
                    isGenerating={isGenerating}
                    onGenerateNDA={handleGenerateNDA}
                    onGenerateIP={handleGenerateIPAssignment}
                />
                <QuickLaunchPanel onFindCounsel={handleFindCounsel} />
                <DisclaimerPanel />
            </aside>

            {/* ── CENTER — Contract Analyzer ──────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="px-4 md:px-6 py-4 border-b border-white/5 flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-[-80px] left-[-80px] w-[300px] h-[300px] bg-blue-500/8 blur-[100px] pointer-events-none rounded-full" />
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Shield size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Legal</h1>
                            <p className="text-muted-foreground font-medium tracking-wide text-[10px]">AI-POWERED CONTRACT ANALYSIS</p>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="analyzer" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 md:px-6 border-b border-white/5 flex-shrink-0">
                        <TabsList className="bg-transparent gap-6 p-0 h-12">
                            <TabsTrigger value="analyzer" className="text-muted-foreground data-[state=active]:text-blue-400 data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs">
                                <FileText size={14} /> Contract Analysis
                            </TabsTrigger>
                            <TabsTrigger value="dmca" className="text-muted-foreground data-[state=active]:text-blue-400 data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-400 rounded-none px-0 h-full font-bold transition-all flex items-center gap-2 text-xs">
                                <Shield size={14} /> DMCA Notices
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="analyzer" className="flex-1 overflow-y-auto m-0">
                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                    {!analysisResult && !isAnalyzing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer relative ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                                    }`}
                            >
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                    accept=".pdf,.docx,.txt"
                                />
                                <Upload size={48} className={`mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-500'}`} />
                                <p className="text-lg font-medium mb-2 text-center text-white">Drop contract here</p>
                                <p className="text-sm text-gray-500 text-center">PDF, DOCX, TXT</p>
                                <button className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors pointer-events-none">
                                    Browse Files
                                </button>
                            </div>

                            <div className="border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.02] rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer relative group">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                />
                                <Camera size={48} className="mb-4 text-gray-500 group-hover:text-blue-500 transition-colors" />
                                <p className="text-lg font-medium mb-2 text-center text-white">Scan Document</p>
                                <p className="text-sm text-gray-500 text-center">Take a photo of a contract</p>
                                <button className="mt-6 px-6 py-2 bg-white/5 group-hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors pointer-events-none">
                                    Open Camera
                                </button>
                            </div>
                        </div>
                    )}

                    {isAnalyzing && (
                        <div className="h-64 flex flex-col items-center justify-center">
                            <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
                            <p className="text-gray-400 animate-pulse">Analyzing clauses and identifying risks...</p>
                        </div>
                    )}

                    {analysisResult && (
                        <div className="space-y-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="text-xl font-bold text-white mb-1">Analysis Report</h4>
                                    <p className="text-gray-400 text-sm">Generated by LegalAI Agent</p>
                                </div>
                                <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${analysisResult.score >= 80 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                    analysisResult.score >= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                    <span className="text-2xl font-bold">{analysisResult.score}</span>
                                    <span className="text-xs uppercase font-bold tracking-wider">Safety Score</span>
                                </div>
                            </div>

                            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                                <p className="text-gray-300 leading-relaxed text-sm">{analysisResult.summary}</p>
                            </div>

                            <div>
                                <h5 className="font-semibold mb-4 flex items-center gap-2 text-yellow-400 text-sm">
                                    <AlertTriangle size={16} />
                                    Potential Risks & Attention Points
                                </h5>
                                <ul className="space-y-2">
                                    {analysisResult.risks.map((risk, index) => (
                                        <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="mt-1.5 min-w-[6px] h-[6px] rounded-full bg-yellow-500 flex-shrink-0" />
                                            <span className="text-sm text-gray-300">{risk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button
                                onClick={() => setAnalysisResult(null)}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors text-sm"
                            >
                                Analyze Another Document
                            </button>
                        </div>
                    )}
                </div>
                    </TabsContent>

                    <TabsContent value="dmca" className="flex-1 overflow-y-auto m-0 p-4 md:p-6">
                        <DMCANoticeGenerator />
                    </TabsContent>
                </Tabs>
            </div>

            {/* ── RIGHT PANEL — History & Risk Scores ────────────── */}
            <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                <AnalysisHistoryPanel history={analysisHistory} />
                <RiskScoresPanel result={analysisResult} />
                <CounselPanel onFindCounsel={handleFindCounsel} />
            </aside>
        </div>
    );
}

/* ================================================================== */
/*  Left Panel Widgets                                                  */
/* ================================================================== */

function LegalTemplatesPanel({ isGenerating, onGenerateNDA, onGenerateIP }: {
    isGenerating: string | null; onGenerateNDA: () => void; onGenerateIP: () => void;
}) {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Templates</h3>
            <div className="space-y-2">
                <button
                    onClick={onGenerateNDA}
                    disabled={isGenerating !== null}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${isGenerating === 'NDA' ? 'opacity-50 cursor-wait' : 'hover:bg-white/[0.04]'}`}
                >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        {isGenerating === 'NDA' ? <Loader2 size={14} className="animate-spin text-blue-400" /> : <FileText size={14} className="text-blue-400" />}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-white">NDA Generator</p>
                        <p className="text-[10px] text-gray-500">Standard NDA template</p>
                    </div>
                </button>
                <button
                    onClick={onGenerateIP}
                    disabled={isGenerating !== null}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${isGenerating === 'IP' ? 'opacity-50 cursor-wait' : 'hover:bg-white/[0.04]'}`}
                >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        {isGenerating === 'IP' ? <Loader2 size={14} className="animate-spin text-purple-400" /> : <CheckCircle size={14} className="text-purple-400" />}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-white">IP Assignment</p>
                        <p className="text-[10px] text-gray-500">Transfer rights template</p>
                    </div>
                </button>
                <button className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Briefcase size={14} className="text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-white">Sync License</p>
                        <p className="text-[10px] text-gray-500">Music sync agreement</p>
                    </div>
                </button>
            </div>
        </div>
    );
}

function QuickLaunchPanel({ onFindCounsel }: { onFindCounsel: () => void }) {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Quick Actions</h3>
            <div className="space-y-2">
                <button
                    onClick={onFindCounsel}
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors text-xs text-blue-300 font-medium border border-blue-500/10"
                >
                    <Scale size={12} /> Find Entertainment Lawyer
                </button>
                <button className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] transition-colors text-xs text-white font-medium">
                    <BookOpen size={12} /> Legal Resources
                </button>
            </div>
        </div>
    );
}

function DisclaimerPanel() {
    return (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
            <div className="flex items-start gap-2 text-xs text-amber-300/70">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <span>AI analysis is for informational purposes only. All drafts MUST be reviewed by qualified legal counsel.</span>
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function AnalysisHistoryPanel({ history }: { history: Array<{ name: string; score: number; date: string }> }) {
    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Analysis History</h3>
            {history.length === 0 ? (
                <p className="text-xs text-gray-600 px-1">No documents analyzed yet.</p>
            ) : (
                <div className="space-y-1">
                    {history.map((h, i) => (
                        <div key={i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-white truncate">{h.name}</p>
                                <p className="text-[10px] text-gray-600">{h.date}</p>
                            </div>
                            <span className={`text-xs font-bold flex-shrink-0 ml-2 ${
                                h.score >= 80 ? 'text-green-400' : h.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                                {h.score}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function RiskScoresPanel({ result }: { result: { score: number; risks: string[] } | null }) {
    if (!result) {
        return (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Risk Assessment</h3>
                <p className="text-xs text-gray-600 px-1">Upload a document to see risk analysis.</p>
            </div>
        );
    }

    const level = result.score >= 80 ? 'Low Risk' : result.score >= 60 ? 'Medium Risk' : 'High Risk';
    const color = result.score >= 80 ? 'text-green-400' : result.score >= 60 ? 'text-yellow-400' : 'text-red-400';
    const bgColor = result.score >= 80 ? 'bg-green-500' : result.score >= 60 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Risk Assessment</h3>
            <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                    <p className="text-3xl font-black text-white mb-1">{result.score}</p>
                    <p className={`text-xs font-bold ${color}`}>{level}</p>
                    <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full ${bgColor} rounded-full`} style={{ width: `${result.score}%` }} />
                    </div>
                </div>
                <div className="px-1">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Flagged Issues</p>
                    <p className="text-xs text-white font-bold">{result.risks.length} risk{result.risks.length !== 1 ? 's' : ''} detected</p>
                </div>
            </div>
        </div>
    );
}

function CounselPanel({ onFindCounsel }: { onFindCounsel: () => void }) {
    return (
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-3">
            <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 px-1">Need a Lawyer?</h3>
            <p className="text-[10px] text-gray-500 px-1 mb-3">Connect with a verified entertainment lawyer for binding advice.</p>
            <button
                onClick={onFindCounsel}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
            >
                Find Counsel
            </button>
        </div>
    );
}
