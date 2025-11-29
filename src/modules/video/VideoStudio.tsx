import React, { useState, useEffect } from 'react';
import { Film, X, Loader2, Wand2, MessageSquare, BotMessageSquare, CheckSquare } from 'lucide-react';
import { useStore } from '../../core/store';
import { Image } from '../../services/image/ImageService';
import { AI } from '../../services/ai/AIService';
import IdeaStep from './components/IdeaStep';
import BriefingStep from './components/BriefingStep';
import ReviewStep from './components/ReviewStep';
import CreativeCanvas from '../creative/components/CreativeCanvas';
import { useToast } from '../../core/context/ToastContext';

const inspirationExamples = [
    { prompt: "A dramatic cinematic shot of a lone astronaut on a desolate, rust-colored alien planet, watching two suns set on the horizon.", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4" },
    { prompt: "An enchanting, magical forest at twilight, where the flora glows with a soft, bioluminescent light. Tiny fairies with iridescent wings flit between the giant, glowing mushrooms.", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" },
    { prompt: "A high-speed chase through a futuristic, neon-drenched cyberpunk city. Flying cars weave between towering skyscrapers as rain slicks the streets below.", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4" },
    { prompt: "A majestic whale breaching the ocean's surface in slow motion, with the golden light of sunset catching the spray of water. Photorealistic, David Attenborough style.", videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4" }
];

const InspirationCard: React.FC<{ example: typeof inspirationExamples[0], onClick: () => void }> = ({ example, onClick }) => (
    <button onClick={onClick} className="w-full text-left bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden group hover:border-purple-500/50 transition-all duration-300 transform hover:scale-105 focus:scale-105 focus:outline-none focus:border-purple-500">
        <div className="aspect-video bg-black relative">
            {/* Placeholder for video since we might not want autoplaying videos in this context, or use img if available */}
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 bg-gray-900">
                <Film size={24} />
            </div>
            {/* Use video if URL is valid */}
            <video src={example.videoUrl} muted loop playsInline onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="p-3"><p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors line-clamp-3">{example.prompt}</p></div>
    </button>
);

const StepIndicator: React.FC<{ current: number, title: string, icon: React.ElementType }> = ({ current, title, icon: Icon }) => (
    <div className="flex flex-col items-center text-center">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${current ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-500'}`}>
            <Icon className="w-5 h-5" />
        </div>
        <p className={`mt-2 text-sm font-semibold ${current ? 'text-purple-300' : 'text-gray-500'}`}>Step</p>
        <p className="text-xs text-gray-400">{title}</p>
    </div>
);

const StepLine: React.FC = () => <div className="flex-grow h-0.5 bg-gray-700 mx-4 mt-5"></div>;

export default function VideoStudio() {
    const { studioControls, setStudioControls, addToHistory } = useStore();
    const toast = useToast();

    const [step, setStep] = useState<'idea' | 'briefing' | 'review'>('idea');
    const [isThinking, setIsThinking] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const [initialPrompt, setInitialPrompt] = useState('');
    const [questions, setQuestions] = useState<string[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [finalPrompt, setFinalPrompt] = useState('');

    const [startFrameData, setStartFrameData] = useState<string | null>(null);
    const [endFrameData, setEndFrameData] = useState<string | null>(null);
    const [activeFrameType, setActiveFrameType] = useState<'start' | 'end' | null>(null);
    const [showFrameDesigner, setShowFrameDesigner] = useState(false);

    const handleAnswerChange = (question: string, answer: string) => setAnswers(prev => ({ ...prev, [question]: answer }));

    const getPromptClarifications = async (prompt: string) => {
        const response = await AI.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: `You are a professional film director. The user has an idea for a video: '${prompt}'. Ask 3 specific questions to clarify the visual style, camera movement, and mood. Return ONLY a JSON array of strings.` }] }]
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        return AI.parseJSON(text) as string[];
    };

    const generateDetailedPrompt = async (prompt: string, answers: Record<string, string>) => {
        const response = await AI.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: `You are a professional film director. User Idea: '${prompt}'. Answers: ${JSON.stringify(answers)}. Write a highly detailed video generation prompt for Veo/Sora. Include lighting, camera angles, texture, and motion. Return ONLY the prompt text.` }] }]
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.text || prompt;
    };

    const handleStartBriefing = async () => {
        if (!initialPrompt.trim()) return;
        setIsThinking(true);
        try {
            const qs = await getPromptClarifications(initialPrompt);
            setQuestions(qs);
            setAnswers({});
            setStep('briefing');
        } catch (e) {
            console.error("Failed to get clarifications", e);
            toast.error("Failed to analyze prompt. Please try again.");
        }
        finally { setIsThinking(false); }
    };

    const handleFinalizePrompt = async () => {
        setIsThinking(true);
        try {
            const detailed = await generateDetailedPrompt(initialPrompt, answers);
            setFinalPrompt(detailed);
            setStep('review');
        } catch (e) {
            console.error("Failed to generate detailed prompt", e);
            toast.error("Failed to generate brief. Please try again.");
        }
        finally { setIsThinking(false); }
    };

    const handleGenerate = async () => {
        if (!finalPrompt.trim()) return;
        setIsGenerating(true);
        toast.info("Starting video generation...");

        try {
            const result = await Image.generateVideo({
                prompt: finalPrompt,
                aspectRatio: studioControls.aspectRatio,
                resolution: studioControls.resolution,
                firstFrame: startFrameData || undefined,
                lastFrame: endFrameData || undefined,
            });

            // Add to history
            if (Array.isArray(result)) {
                result.forEach(vid => addToHistory({
                    id: vid.id,
                    type: 'video',
                    url: vid.url,
                    prompt: vid.prompt,
                    timestamp: Date.now(),
                    projectId: 'default' // Or get from store
                }));
            } else if (result) {
                // Handle single object if needed, though generateVideo returns array
                const vid = result as any;
                addToHistory({
                    id: vid.id,
                    type: 'video',
                    url: vid.url,
                    prompt: vid.prompt,
                    timestamp: Date.now(),
                    projectId: 'default'
                });
            }

            toast.success("Video generated successfully!");
            // Reset or go back?
            // setStep('idea');
        } catch (error: any) {
            console.error("Video Generation Error", error);
            toast.error(error.message || "Failed to generate video.");
        } finally {
            setIsGenerating(false);
        }
    };

    const renderCurrentStep = () => {
        if (isThinking) {
            return (
                <div className="text-center py-16">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
                    <h3 className="mt-4 text-lg font-semibold text-gray-200">AI Director is thinking...</h3>
                    <p className="text-gray-500">Crafting the next step for your production.</p>
                </div>
            );
        }

        switch (step) {
            case 'idea': return <IdeaStep initialPrompt={initialPrompt} onPromptChange={setInitialPrompt} onNext={handleStartBriefing} isThinking={isThinking} />;
            case 'briefing': return <BriefingStep initialPrompt={initialPrompt} questions={questions} answers={answers} onAnswerChange={handleAnswerChange} onBack={() => setStep('idea')} onNext={handleFinalizePrompt} isThinking={isThinking} />;
            case 'review': return (
                <ReviewStep
                    finalPrompt={finalPrompt}
                    onBack={() => setStep('briefing')}
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    startFrameData={startFrameData}
                    endFrameData={endFrameData}
                    onDesignFrame={(type) => {
                        setActiveFrameType(type);
                        setShowFrameDesigner(true);
                    }}
                    onClearFrame={(type) => {
                        if (type === 'start') setStartFrameData(null);
                        else setEndFrameData(null);
                    }}
                />
            );
            default: return null;
        }
    }

    return (
        <>
            {showFrameDesigner && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-6xl h-[85vh] bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900">
                            <h3 className="text-white font-bold">Frame Designer ({activeFrameType === 'start' ? 'Start' : 'End'} Frame)</h3>
                            <button onClick={() => setShowFrameDesigner(false)} className="text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 relative">
                            {/* Reuse CreativeCanvas but maybe we need to adapt it to return data on save */}
                            {/* For now, let's just use it as is and assume user saves to history, then picks it? */}
                            {/* Or better, we can't easily extract data from CreativeCanvas unless we modify it. */}
                            {/* Let's just show a placeholder for now as CreativeCanvas is complex to integrate as a modal returning data without changes. */}
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <p>Frame Designer Integration Coming Soon. Use the main Creative Studio to generate images first.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col h-full bg-[#0a0a0a] text-white p-6 overflow-y-auto custom-scrollbar">
                <header className="flex items-center gap-4 mb-8 flex-shrink-0">
                    <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                        <Film size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Video Production Studio</h1>
                        <p className="text-gray-400">AI-Driven Video Creation & Direction.</p>
                    </div>
                </header>

                <div className="max-w-4xl mx-auto w-full space-y-8">
                    <div className="flex items-center justify-center gap-4">
                        <StepIndicator current={step === 'idea' ? 1 : 0} title="Your Idea" icon={MessageSquare} />
                        <StepLine />
                        <StepIndicator current={step === 'briefing' ? 1 : 0} title="AI Briefing" icon={BotMessageSquare} />
                        <StepLine />
                        <StepIndicator current={step === 'review' ? 1 : 0} title="Production" icon={CheckSquare} />
                    </div>

                    <div className="min-h-[400px]">
                        {renderCurrentStep()}
                    </div>

                    {step === 'idea' && (
                        <div className="pt-8 border-t border-gray-800">
                            <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-300 mb-6">
                                <Wand2 className="w-5 h-5 text-purple-400" />
                                Need inspiration?
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {inspirationExamples.map((ex, i) => (
                                    <InspirationCard key={i} example={ex} onClick={() => setInitialPrompt(ex.prompt)} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
