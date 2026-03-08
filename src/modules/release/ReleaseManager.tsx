import React, { useState, useRef, DragEvent } from 'react';
import { MetadataEditor } from './components/MetadataEditor';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { AudioIntelligenceProfile } from '@/services/audio/types';
import { AudioWaveformViewer } from '@/components/shared/AudioWaveformViewer';
import { ernService } from '@/services/ddex/ERNService'; // Hook up the real service
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { ddexValidator } from '@/services/ddex/DDEXValidator';
import { logger } from '@/utils/logger';

export const ReleaseManager: React.FC = () => {
    const [step, setStep] = useState<'upload' | 'analyzing' | 'edit' | 'exporting'>('upload');
    const [audioProfile, setAudioProfile] = useState<AudioIntelligenceProfile | undefined>(undefined);
    const [metadata, setMetadata] = useState<ExtendedGoldenMetadata | null>(null);
    const [xmlOutput, setXmlOutput] = useState<string>('');
    const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: string[] } | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
    const [fileName, setFileName] = useState<string | null>(null);

    useUnsavedChanges(isDirty);

    // Mock Audio Load for Demo
    const handleLoadAudio = async (url?: string, name?: string) => {
        setStep('analyzing');
        if (url) setAudioUrl(url);
        if (name) setFileName(name);

        // Simulate "CLIP" Analysis Delay
        setTimeout(() => {
            const mockProfile: AudioIntelligenceProfile = {
                id: 'mock-123',
                technical: { bpm: 128, key: 'C', scale: 'minor', energy: 0.9, duration: 245, danceability: 0.8, loudness: -5 },
                semantic: {
                    mood: ['Energetic', 'Dark'],
                    genre: ['Electronic'],
                    instruments: ['Synthesizer'],
                    ddexGenre: 'Electronic',
                    ddexSubGenre: 'Techno',
                    language: 'zxx',
                    isExplicit: false,
                    visualImagery: { abstract: '', narrative: '', lighting: '' },
                    marketingHooks: { keywords: [], oneLiner: 'A banger.' },
                    targetPrompts: { image: '', veo: '' }
                },
                analyzedAt: Date.now(),
                modelVersion: 'gemini-3.1-pro-preview'
            };
            setAudioProfile(mockProfile);
            setStep('edit');
        }, 1500);
    };

    const handleSaveMetadata = (data: ExtendedGoldenMetadata) => {
        setMetadata(data);
        setIsDirty(true);
    };

    const handleExport = async () => {
        if (!metadata) return;
        setStep('exporting');
        setValidationResult(null);

        try {
            // Call the real ERNService (validated in tests!)
            const result = await ernService.generateERN(metadata, undefined, 'generic', undefined, { isTestMode: true });

            if (result.success && result.xml) {
                setXmlOutput(result.xml);
                // Validate generated XML
                const validation = ddexValidator.validateXML(result.xml);
                setValidationResult({
                    isValid: validation.valid,
                    errors: validation.valid ? [] : validation.errors
                });
                if (validation.valid) {
                    setIsDirty(false); // Clear dirty flag on successful export
                }
            } else {
                logger.error("ERN generation failed:", result.error ?? "Unknown error");
                setValidationResult({ isValid: false, errors: [result.error || 'Failed to generate ERN'] });
            }
        } catch (e) {
            logger.error("Operation failed:", e);
            setValidationResult({ isValid: false, errors: ['An unexpected error occurred'] });
        }
        setStep('edit'); // Go back to edit/view
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('audio/')) {
            const url = URL.createObjectURL(file);
            handleLoadAudio(url, file.name);
        } else {
            handleLoadAudio();
        }
    };

    return (
        <div className="min-h-screen bg-black/90 text-white p-8 font-sans">
            <header className="mb-8 border-b border-white/10 pb-4">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    Release Manager
                </h1>
                <p className="text-white/40 mt-1">DDEX Supply Chain Integration</p>
            </header>

            {step === 'upload' && (
                <div
                    className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/20 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => handleLoadAudio()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <div className="text-4xl mb-4">🎵</div>
                    <h3 className="text-xl font-medium">Drop Audio Master</h3>
                    <p className="text-white/40 text-sm">Drag and drop audio file or click to simulate</p>
                </div>
            )}

            {step === 'analyzing' && (
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6" />
                    <h3 className="text-xl font-medium animate-pulse">CLIP Analysis in Progress...</h3>
                    <p className="text-white/40 text-sm">Extracting semantics, genre, and key...</p>
                </div>
            )}

            {(step === 'edit' || step === 'exporting') && (
                <div className="flex flex-col gap-8">
                    {/* Audio Preview Feature */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Master File QC</h3>
                            {fileName && <span className="text-xs text-purple-300 font-mono bg-purple-900/40 px-3 py-1 rounded">{fileName}</span>}
                        </div>
                        <AudioWaveformViewer audioUrl={audioUrl || 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'} height={100} />
                    </div>

                    <div className="flex gap-8">
                        <div className="flex-1 max-w-3xl">
                            <MetadataEditor
                                key={audioProfile?.id || 'empty'}
                                audioProfile={audioProfile}
                                initialMetadata={metadata || undefined}
                                onSave={handleSaveMetadata}
                            />
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={handleExport}
                                    disabled={step === 'exporting'}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-purple-900/50 transition-all transform hover:scale-105"
                                >
                                    {step === 'exporting' ? 'Generating XML...' : 'Generate DDEX Package'}
                                </button>
                            </div>
                        </div>

                        {/* XML Preview Sidecar */}
                        {xmlOutput && (
                            <div className="flex-1 flex flex-col gap-4 h-[800px]">
                                {validationResult && (
                                    <div className={`p-4 rounded-lg flex items-center justify-between ${validationResult.isValid ? 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-300' : 'bg-red-500/10 border border-red-500/50 text-red-300'}`}>
                                        <span className="font-bold flex items-center gap-2">
                                            {validationResult.isValid ? '✓ ERN VALID' : '⚠ ERN INVALID'}
                                        </span>
                                        {!validationResult.isValid && <span className="text-xs opacity-75">{validationResult.errors.join(', ')}</span>}
                                    </div>
                                )}

                                <div className="bg-black/50 rounded-xl border border-white/10 p-4 font-mono text-xs overflow-auto flex-1">
                                    <pre className="text-blue-300">{xmlOutput}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
