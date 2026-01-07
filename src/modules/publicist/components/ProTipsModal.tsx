import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Lightbulb } from 'lucide-react';

interface ProTipsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProTipsModal: React.FC<ProTipsModalProps> = ({ isOpen, onClose }) => {
    const tips = [
        {
            title: "The 3-Sentence Pitch",
            desc: "Keep your initial email under 3 sentences. Who you are, what the news is, and why it matters to *their* audience."
        },
        {
            title: "Subject Lines Matter",
            desc: "Avoid 'Press Release'. Use something catchy like 'New Synthwave Single from [Artist] for [Publication Name]'"
        },
        {
            title: "Follow Up Once",
            desc: "Wait 3-4 days before following up. If no response after that, move on. Don't be spammy."
        },
        {
            title: "Exclusive Premieres",
            desc: "Offer the track to a top-tier blog 24 hours before everyone else. Exclusivity drives coverage."
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-950 border border-sonic-purple/20 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.15)] z-[70] overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Sparkles size={20} className="text-sonic-purple" />
                                Pro Tips
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {tips.map((tip, i) => (
                                <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors">
                                    <div className="mt-1">
                                        <Lightbulb size={20} className="text-sonic-yellow" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm mb-1">{tip.title}</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed">{tip.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-sonic-purple/10 border-t border-sonic-purple/20 text-center">
                            <p className="text-xs text-sonic-purple font-medium">Powered by indiiOS Agent Intelligence</p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
