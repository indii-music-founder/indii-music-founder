import React, { useState } from 'react';
import { MetadataEditor } from './components/MetadataEditor';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { AudioIntelligenceProfile } from '@/services/audio/types';
import { ernService } from '@/services/ddex/ERNService'; // Hook up the real service

import { ddexValidator } from '@/services/ddex/DDEXValidator';
import { logger } from '@/utils/logger';

export const ReleaseManager: React.FC = () => {
    const [step, setStep] = useState<'upload' | 'analyzing' | 'edit' | 'exporting'>('upload');
    const [audioProfile, setAudioProfile] = useState<AudioIntelligenceProfile | undefined>(undefined);
    const [metadata, setMetadata] = useState<ExtendedGoldenMetadata | null>(null);
    const [xmlOutput, setXmlOutput] = useState<string>('');
    const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: string[] } | null>(null);

    // Mock Audio Load for Demo
    const handleLoadAudio = async () => {
        setStep('analyzing');

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
                modelVersion: 'gemini-3-pro-preview'
            };
            setAudioProfile(mockProfile);
            setStep('edit');
        }, 1500);
    };

    const handleSaveMetadata = (data: ExtendedGoldenMetadata) => {
        setMetadata(data);
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
            } else {
                logger.error(result.error);
                setValidationResult({ isValid: false, errors: [result.error || 'Failed to generate ERN'] });
            }
        } catch (e) {
            logger.error(e);
            setValidationResult({ isValid: false, errors: ['An unexpected error occurred'] });
        }
        setStep('edit'); // Go back to edit/view
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
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/20 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={handleLoadAudio}>
                    <div className="text-4xl mb-4">🎵</div>
                    <h3 className="text-xl font-medium">Drop Audio Master</h3>
                    <p className="text-white/40 text-sm">Or click to simulate analysis</p>
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
            )}
        </div>
    );
};
