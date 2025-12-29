import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Shield, Upload, CheckCircle, AlertTriangle, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { db } from '@/services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface AnalysisResult {
    isConsistent: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
}

const BrandManager: React.FC = () => {
    const { userProfile, updateBrandKit } = useStore();
    const toast = useToast();
    const [guidelines, setGuidelines] = useState<string>('');
    const [contentToCheck, setContentToCheck] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    React.useEffect(() => {
        if (!guidelines && userProfile?.brandKit) {
            const { bio, brandKit } = userProfile;
            const parts = [];
            if (bio) parts.push(`BIO:\n${bio}`);
            if (brandKit.brandDescription) parts.push(`BRAND DESCRIPTION:\n${brandKit.brandDescription}`);
            if (brandKit.releaseDetails?.title) parts.push(`CURRENT RELEASE:\n${brandKit.releaseDetails.title} (${brandKit.releaseDetails.type})`);
            if (brandKit.releaseDetails?.mood) parts.push(`MOOD:\n${brandKit.releaseDetails.mood}`);
            if (brandKit.releaseDetails?.themes) parts.push(`THEMES:\n${brandKit.releaseDetails.themes}`);

            if (parts.length > 0) {
                setGuidelines(parts.join('\n\n'));
            }
        }
    }, [userProfile, guidelines]);

    const handleSaveGuidelines = async () => {
        if (!userProfile?.id) return;
        setIsSaving(true);
        try {
            // Update local store
            updateBrandKit({ brandDescription: guidelines });

            // Persist to Firestore
            const userRef = doc(db, 'users', userProfile.id);
            await updateDoc(userRef, {
                'brandKit.brandDescription': guidelines
            });

            toast.success("Brand guidelines saved.");
        } catch (error) {
            console.error("Failed to save guidelines:", error);
            toast.error("Failed to save guidelines to profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAnalyze = async () => {
        if (!guidelines || !contentToCheck) {
            toast.error("Please provide both brand guidelines and content to check.");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            const prompt = `
            Analyze the following marketing content for brand consistency:
            Brand Guidelines: ${guidelines}
            Content to Analyze: ${contentToCheck}

            Please provide:
            1. A consistency score (0-100).
            2. A boolean "isConsistent" flag (true if score >= 80).
            3. A list of specific issues (e.g., tone mismatch, color misuse).
            4. Suggestions for improvement.

            Format the output ONLY as JSON:
            {
              "score": number,
              "isConsistent": boolean,
              "issues": string[],
              "suggestions": string[]
            }
            `;

            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            });

            let result: AnalysisResult;
            try {
                result = JSON.parse(res.text() || '{}') as AnalysisResult;
            } catch (e) {
                console.error("Failed to parse analysis result", e);
                throw new Error("Failed to parse analysis result");
            }

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
                            <Shield className="text-white" size={20} />
                            Brand Guidelines
                        </h3>
                        <div className="space-y-4">
                            <textarea
                                value={guidelines}
                                onChange={(e) => setGuidelines(e.target.value)}
                                placeholder="Paste your brand guidelines here (e.g., tone of voice, forbidden words, core values)..."
                                className="w-full h-40 bg-black/20 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:border-white focus:ring-1 focus:ring-white outline-none resize-none"
                            />
                            <button
                                onClick={handleSaveGuidelines}
                                disabled={isSaving || !guidelines}
                                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                Save Guidelines
                            </button>
                        </div>
                    </div>

                    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <FileText className="text-white" size={20} />
                            Content to Check
                        </h3>
                        <textarea
                            value={contentToCheck}
                            onChange={(e) => setContentToCheck(e.target.value)}
                            placeholder="Paste the content you want to review (e.g., social media post, blog draft)..."
                            className="w-full h-40 bg-black/20 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:border-white focus:ring-1 focus:ring-white outline-none resize-none"
                        />
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !guidelines || !contentToCheck}
                        className="w-full py-3 bg-white hover:bg-gray-200 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <CheckCircle className="text-white" size={20} />
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
                                    {analysisResult.isConsistent ? <CheckCircle size={32} className="text-white" /> : <AlertTriangle size={32} className="text-red-500" />}
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
