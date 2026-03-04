import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageItem } from '@/core/components/chat/ChatMessage';

interface ChatMessagesProps {
    history: any[];
    isProcessing: boolean;
    chatEndRef: React.RefObject<HTMLDivElement>;
}

export function ChatMessages({ history, isProcessing, chatEndRef }: ChatMessagesProps) {
    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-10 px-4 md:px-10 space-y-8 scrollbar-hide flex flex-col items-center">
            <div className="w-full max-w-4xl flex flex-col gap-8 pb-32">
                <AnimatePresence mode="popLayout" initial={false}>
                    {history.map((message, index) => (
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
                        >
                            <MessageItem msg={message} />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isProcessing && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-4"
                    >
                        <div className="w-8 h-8 rounded-full bg-dept-marketing/20 flex items-center justify-center border border-dept-marketing/30">
                            <div className="w-1.5 h-1.5 rounded-full bg-dept-marketing animate-ping" />
                        </div>
                        <div className="space-y-2 mt-1">
                            <div className="h-4 w-48 bg-white/5 rounded-full animate-pulse" />
                            <div className="h-3 w-32 bg-white/[0.03] rounded-full animate-pulse delay-75" />
                        </div>
                    </motion.div>
                )}

                <div ref={chatEndRef} className="h-4 w-full flex-shrink-0" />
            </div>
        </div>
    );
}
