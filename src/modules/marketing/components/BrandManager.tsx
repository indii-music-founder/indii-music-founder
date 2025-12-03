import React, { useState } from 'react';
import { Shield, Upload, CheckCircle, AlertTriangle, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

interface AnalysisResult {
    isConsistent: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
}

const BrandManager: React.FC = () => {
    const toast = useToast();
    const [guidelines, setGuidelines] = useState<string>('');
    const [contentToCheck, setContentToCheck] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    const handleAnalyze = async () => {
        if (!guidelines || !contentToCheck) {
            toast.error("Please provide both brand guidelines and content to check.");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            const analyzeBrand = httpsCallable(functions, 'analyzeBrand');
            const response = await analyzeBrand({ content: contentToCheck, guidelines });
            const result = response.data as AnalysisResult;
            setAnalysisResult(result);
            toast.success("Analysis complete");
        } catch (error) {
            console.error("Brand Analysis Failed:", error);
            toast.error("Failed to analyze brand consistency");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="space-y-4">
                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Shield className="text-pink-500" size={20} />
                            Brand Guidelines
                        </h3>
                        <textarea
                            value={guidelines}
                            onChange={(e) => setGuidelines(e.target.value)}
                            placeholder="Paste your brand guidelines here (e.g., tone of voice, forbidden words, core values)..."
                            className="w-full h-40 bg-black/20 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none resize-none"
                        />
                    </div>

                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <FileText className="text-blue-500" size={20} />
                            Content to Check
                        </h3>
                        <textarea
                            value={contentToCheck}
                            onChange={(e) => setContentToCheck(e.target.value)}
                            placeholder="Paste the content you want to review (e.g., social media post, blog draft)..."
                            className="w-full h-40 bg-black/20 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                        />
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !guidelines || !contentToCheck}
                        className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={20} />
                                Analyze Consistency
                            </>
                        )}
                    </button>
                </div>

                {/* Results Section */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 h-full">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <CheckCircle className="text-green-500" size={20} />
                        Analysis Report
                    </h3>

                    {analysisResult ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Score Card */}
                            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                                <div>
                                    <p className="text-gray-400 text-sm">Consistency Score</p>
                                    <h2 className={`text-3xl font-bold ${analysisResult.score >= 80 ? 'text-green-400' : analysisResult.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {analysisResult.score}/100
                                    </h2>
                                </div>
                                <div className={`p-3 rounded-full ${analysisResult.isConsistent ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {analysisResult.isConsistent ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
                                </div>
                            </div>

                            {/* Issues List */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Issues Detected</h4>
                                {analysisResult.issues.length > 0 ? (
                                    <ul className="space-y-2">
                                        {analysisResult.issues.map((issue, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-red-300 bg-red-900/10 p-3 rounded-lg border border-red-900/20">
                                                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                                {issue}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No issues found.</p>
                                )}
                            </div>

                            {/* Suggestions List */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Suggestions</h4>
                                {analysisResult.suggestions.length > 0 ? (
                                    <ul className="space-y-2">
                                        {analysisResult.suggestions.map((suggestion, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-blue-300 bg-blue-900/10 p-3 rounded-lg border border-blue-900/20">
                                                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                                                {suggestion}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No suggestions available.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">
                            <Shield size={48} className="mb-4 opacity-20" />
                            <p>Run an analysis to see the report here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BrandManager;
