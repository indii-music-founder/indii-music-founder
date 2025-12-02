import React from 'react';
import { useStore } from '@/core/store';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ApiKeyErrorModal = () => {
    const { apiKeyError, setApiKeyError } = useStore();

    if (!apiKeyError) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[#1a1a1a] border border-red-900/50 rounded-xl p-6 max-w-md w-full shadow-2xl relative"
                >
                    <button
                        onClick={() => setApiKeyError(false)}
                        className="absolute top-4 right-4 text-gray-500 hover:text-white"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center text-red-500">
                            <AlertTriangle size={32} />
                        </div>

                        <h2 className="text-xl font-bold text-white">Billing / API Key Error</h2>

                        <p className="text-gray-400 text-sm">
                            We detected a billing or quota issue with your Google AI Studio API key.
                            Please check your billing status or quota limits.
                        </p>

                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors w-full justify-center"
                        >
                            Manage API Keys <ExternalLink size={16} />
                        </a>

                        <button
                            onClick={() => setApiKeyError(false)}
                            className="text-gray-500 hover:text-gray-300 text-sm underline"
                        >
                            Dismiss
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
