import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageItem } from '@/core/components/chat/ChatMessage';
import { Bot, MoreHorizontal } from 'lucide-react';

interface ChatMessagesProps {
    history: any[];
    isProcessing: boolean;
    chatEndRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessages({ history, isProcessing, chatEndRef }: ChatMessagesProps) {
    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-10 px-4 md:px-10 scrollbar-hide flex flex-col items-center">
            <div className="w-full max-w-4xl flex flex-col pb-32">
                <AnimatePresence mode="popLayout" initial={false}>
                    {history.map((message, index) => {
                        const previousMsg = index > 0 ? history[index - 1] : null;
                        const isGroupedWithPrevious = previousMsg && previousMsg.role === message.role;

                        return (
                            <motion.div
                                key={message.id || index}
                                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 200,
                                    damping: 25,
                                    mass: 1
                                }}
                                className={isGroupedWithPrevious ? "mt-2" : "mt-8"}
                            >
                                <MessageItem msg={message} variant={isGroupedWithPrevious ? 'compact' : 'default'} />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {isProcessing && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-start gap-3 mt-8"
                    >
                        <div className="relative mt-1 flex-shrink-0">
                            <div className="absolute -inset-1 bg-purple-500/20 rounded-full blur-sm opacity-100 transition-opacity"></div>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-xs font-bold relative z-10 border border-purple-500/30">
                                <Bot size={18} className="text-purple-200" />
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-[rgba(16,16,22,0.6)] to-[rgba(10,10,14,0.9)] border border-white/5 rounded-[1.2rem] rounded-tl-sm px-5 py-4 flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] h-[48px]">
                            <div className="flex items-center gap-1.5" role="status" aria-label="AI is thinking">
                                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0 }} className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.15 }} className="w-1.5 h-1.5 bg-purple-400/80 rounded-full" />
                                <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.3 }} className="w-1.5 h-1.5 bg-purple-400/60 rounded-full" />
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={chatEndRef} className="h-4 w-full flex-shrink-0" />
            </div>
        </div>
    );
}
