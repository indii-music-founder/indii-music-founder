import React, { useState } from 'react';
import { Shield, Upload, FileText, CheckCircle, AlertTriangle, Loader2, Camera } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

export default function LegalDashboard() {
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<null | {
        score: number;
        risks: string[];
        summary: string;
    }>(null);
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
            const readFile = (file: File): Promise<string> => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            const dataUrl = await readFile(file);
            const base64Data = dataUrl.split(',')[1];
            const mimeType = file.type || 'text/plain';

            const analyzeContract = httpsCallable(functions, 'analyzeContract');
            const result = await analyzeContract({ fileData: base64Data, mimeType });

            const data = result.data as any;

            setAnalysisResult({
                score: data.score,
                summary: data.summary,
                risks: data.risks
            });
            toast.success("Analysis complete!");
        } catch (error) {
            console.error("Analysis failed:", error);
            toast.error("Analysis failed. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0d1117] text-white p-6 overflow-y-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <Shield className="text-blue-500" />
                    Legal Dashboard
                </h1>
                <p className="text-gray-400">AI-powered contract analysis and legal tools.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Contract Validator Card */}
                <div className="lg:col-span-2 bg-[#161b22] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <FileText size={18} className="text-blue-400" />
                        Contract Validator
                    </h3>

                    {!analysisResult && !isAnalyzing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer relative ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                                    }`}
                            >
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                    accept=".pdf,.docx,.txt"
                                />
                                <Upload size={48} className={`mb-4 ${isDragging ? 'text-blue-500' : 'text-gray-500'}`} />
                                <p className="text-lg font-medium mb-2 text-center">Drop contract here</p>
                                <p className="text-sm text-gray-500 text-center">PDF, DOCX, TXT</p>
                                <button className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors pointer-events-none">
                                    Browse Files
                                </button>
                            </div>

                            <div className="border-2 border-dashed border-gray-700 hover:border-gray-600 hover:bg-gray-800/50 rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer relative group">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                />
                                <Camera size={48} className="mb-4 text-gray-500 group-hover:text-blue-500 transition-colors" />
                                <p className="text-lg font-medium mb-2 text-center">Scan Document</p>
                                <p className="text-sm text-gray-500 text-center">Take a photo of a contract</p>
                                <button className="mt-6 px-6 py-2 bg-gray-700 group-hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors pointer-events-none">
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
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h4 className="text-xl font-bold mb-1">Analysis Report</h4>
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

                            <div className="bg-[#0d1117] rounded-lg p-4 mb-6 border border-gray-800">
                                <p className="text-gray-300 leading-relaxed">{analysisResult.summary}</p>
                            </div>

                            <h5 className="font-semibold mb-4 flex items-center gap-2 text-yellow-400">
                                <AlertTriangle size={16} />
                                Potential Risks & Attention Points
                            </h5>
                            <ul className="space-y-3">
                                {analysisResult.risks.map((risk, index) => (
                                    <li key={index} className="flex items-start gap-3 p-3 bg-[#0d1117] rounded border border-gray-800 hover:border-gray-700 transition-colors">
                                        <div className="mt-1 min-w-[6px] h-[6px] rounded-full bg-yellow-500" />
                                        <span className="text-sm text-gray-300">{risk}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => setAnalysisResult(null)}
                                className="mt-8 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Analyze Another Document
                            </button>
                        </div>
                    )}
                </div>

                {/* Sidebar / Quick Tools */}
                <div className="space-y-6">
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Tools</h3>
                        <div className="space-y-2">
                            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-3 group">
                                <div className="p-2 bg-blue-500/10 rounded group-hover:bg-blue-500/20 text-blue-400">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <div className="font-medium">NDA Generator</div>
                                    <div className="text-xs text-gray-500">Create a standard NDA</div>
                                </div>
                            </button>
                            <button className="w-full text-left p-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-3 group">
                                <div className="p-2 bg-purple-500/10 rounded group-hover:bg-purple-500/20 text-purple-400">
                                    <CheckCircle size={18} />
                                </div>
                                <div>
                                    <div className="font-medium">IP Assignment</div>
                                    <div className="text-xs text-gray-500">Transfer rights template</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-800/30 rounded-xl p-6">
                        <h3 className="text-lg font-bold mb-2">Need a Lawyer?</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            AI analysis is for informational purposes only. Connect with a verified entertainment lawyer for binding advice.
                        </p>
                        <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-colors">
                            Find Counsel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
