import React, { useEffect, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FileText, ChevronRight, Search } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/core/context/ToastContext';
import { Logger } from '@/core/logger/Logger';

interface ArtifactsPanelProps {
    toggleRightPanel: () => void;
}

interface Artifact {
    filename: string;
}

export default function ArtifactsPanel({ toggleRightPanel }: ArtifactsPanelProps) {
    const toast = useToast();
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
    const [artifactContent, setArtifactContent] = useState<string>('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadArtifacts();
    }, []);

    const loadArtifacts = async () => {
        try {
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.agent) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const response = await (window.electronAPI.agent as any).listArtifacts();
                if (response.success && Array.isArray(response.data)) {
                    setArtifacts(response.data);
                }
            }
        } catch (error) {
            Logger.error('ArtifactsPanel', 'Failed to load artifacts', error);
        }
    };

    const handleSelectArtifact = async (filename: string) => {
        setIsLoading(true);
        try {
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.agent) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const response = await (window.electronAPI.agent as any).readArtifact(filename);
                if (response.success) {
                    setArtifactContent(response.data || '');
                    setSelectedArtifact(filename);
                } else {
                    toast.error(`Failed to load ${filename}`);
                }
            }
        } catch (error) {
            Logger.error('ArtifactsPanel', 'Failed to read artifact', error);
            toast.error(`Failed to load ${filename}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-linear-to-b from-bg-dark to-bg-dark/90 relative">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm shrink-0">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg">
                        <FileText size={14} className="text-blue-400" />
                    </div>
                    {selectedArtifact ? selectedArtifact : 'Artifacts'}
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {selectedArtifact ? (
                    <div className="p-4 flex flex-col h-full">
                        <button 
                            onClick={() => setSelectedArtifact(null)}
                            className="mb-4 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 self-start"
                        >
                            &larr; Back to list
                        </button>
                        <div className="prose prose-invert prose-sm max-w-none flex-1 overflow-y-auto">
                            <ReactMarkdown>{artifactContent}</ReactMarkdown>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {artifacts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-center opacity-50">
                                <FileText size={32} className="mb-2 text-blue-400" />
                                <p className="text-sm">No artifacts found</p>
                                <p className="text-xs mt-1">Agents will create artifacts here</p>
                            </div>
                        ) : (
                            artifacts.map((artifact) => (
                                <motion.button
                                    key={artifact.filename}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleSelectArtifact(artifact.filename)}
                                    className="w-full text-left bg-black/40 p-3 rounded-xl border border-white/5 space-y-1 hover:bg-white/5 transition-colors group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-300 flex items-center gap-2 group-hover:text-white transition-colors">
                                            <FileText size={14} className="text-blue-400/70" /> 
                                            {artifact.filename}
                                        </span>
                                        <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400" />
                                    </div>
                                </motion.button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
