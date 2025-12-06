
import React from 'react';
import { useStore } from '@/core/store';
import { FileText, Image, Music, Clock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { ThreeDCardContainer, ThreeDCardBody, ThreeDCardItem } from '@/components/ui/ThreeDCard';

export const KnowledgeBaseList: React.FC = () => {
    // Access knowledgeBase safely, defaulting to empty array if undefined
    const knowledgeBase = useStore((state) => state.knowledgeBase || []);

    if (knowledgeBase.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText size={18} className="text-blue-400" />
                Indexed Assets ({knowledgeBase.length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...knowledgeBase].reverse().map((doc) => (
                    <ThreeDCardContainer key={doc.id} className="inter-var w-full">
                        <ThreeDCardBody className="bg-white/5 relative group/card border-white/10 w-full h-auto rounded-xl p-4 border hover:border-white/30 hover:bg-white/10 transition-all">
                            {/* Header: Icon & Status */}
                            <div className="flex justify-between items-start mb-3">
                                <ThreeDCardItem translateZ="20" className="p-2 bg-white/5 rounded-lg">
                                    {doc.type === 'image' || doc.name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                                        <Image size={16} className="text-purple-400" />
                                    ) : (
                                        <FileText size={16} className="text-blue-400" />
                                    )}
                                </ThreeDCardItem>

                                <ThreeDCardItem translateZ="30">
                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${doc.indexingStatus === 'ready' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                            doc.indexingStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                                'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                        }`}>
                                        {doc.indexingStatus === 'ready' && <CheckCircle size={10} />}
                                        {doc.indexingStatus === 'indexing' && <Loader2 size={10} className="animate-spin" />}
                                        {doc.indexingStatus === 'error' && <AlertCircle size={10} />}
                                        <span className="capitalize">{doc.indexingStatus || 'Processing'}</span>
                                    </div>
                                </ThreeDCardItem>
                            </div>

                            {/* Title */}
                            <ThreeDCardItem translateZ="40" className="font-semibold text-white text-sm mb-1 truncate w-full" title={doc.name}>
                                {doc.name}
                            </ThreeDCardItem>

                            {/* Metadata */}
                            <ThreeDCardItem translateZ="30" className="text-xs text-white/40 flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(doc.createdAt).toLocaleDateString()} • {new Date(doc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </ThreeDCardItem>

                        </ThreeDCardBody>
                    </ThreeDCardContainer>
                ))}
            </div>
        </div>
    );
};
