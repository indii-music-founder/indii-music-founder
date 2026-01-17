import React, { memo } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Sparkles } from 'lucide-react';
import { AgentMessage } from '@/core/store';
import { useStore } from '@/core/store';

// Sub-renderers
import VisualScriptRenderer from '../VisualScriptRenderer';
import ScreenplayRenderer from '../ScreenplayRenderer';
import CallSheetRenderer from '../CallSheetRenderer';
import ContractRenderer from '../ContractRenderer';

// Chat Components
import { ThoughtChain } from './ThoughtChain';
import { JsonViewer } from './JsonViewer';
import { ImageRenderer, ToolImageOutput } from './ToolOutputRenderer';
import { getText } from './utils';

// Types
import { Components } from 'react-markdown';

interface MessageItemProps {
    msg: AgentMessage;
    avatarUrl?: string;
    agentIdentity?: {
        color: string;
        initials: string;
    };
}

export const MessageItem = memo(({ msg, avatarUrl, agentIdentity }: MessageItemProps) => {
    // Custom Markdown Components
    // ... existing components ...
    const markdownComponents: Components = {
        // ... (keep existing implementation)
        img: ({ src, alt }: any) => <ImageRenderer src={src} alt={alt} />,
        p: ({ children }: any) => {
            const text = getText(children);
            // ... (keep existing implementation)
            // Detect Raw AI Image Tool Output
            const toolMatch = text.match(/\[Tool: (generate_image|batch_edit_images|generate_high_res_asset|render_cinematic_grid|extract_grid_frame)\] Output: (?:Success: )?(\{.*\})/s);

            if (toolMatch) {
                // ... existing logic ...
                try {
                    const toolName = toolMatch[1];
                    const json = JSON.parse(toolMatch[2]);
                    const { generatedHistory } = useStore.getState();

                    let imageIds: string[] = [];
                    if (json.image_ids && Array.isArray(json.image_ids)) imageIds = json.image_ids;
                    else if (json.asset_id) imageIds = [json.asset_id];
                    else if (json.grid_id) imageIds = [json.grid_id];
                    else if (json.frame_id) imageIds = [json.frame_id];

                    const images = imageIds.map(id => generatedHistory.find(h => h.id === id)).filter(Boolean);
                    if (images.length > 0) {
                        return (
                            <div className="flex flex-col gap-4 my-4">
                                {images.map((img: any, idx: number) => (
                                    <ToolImageOutput key={idx} toolName={toolName} idx={idx} url={img.url} prompt={img.prompt} />
                                ))}
                            </div>
                        );
                    }
                    if (json.urls && Array.isArray(json.urls)) {
                        return (
                            <div className="flex flex-col gap-4 my-4">
                                {json.urls.map((url: string, idx: number) => (
                                    <ToolImageOutput key={idx} toolName={toolName} idx={idx} url={url} />
                                ))}
                            </div>
                        );
                    }
                } catch (e) { console.warn("Failed to parse image tool output:", e); }
            }

            // Detect Delegate Task Output
            const delegateMatch = text.match(/\[Tool: delegate_task\] Output: (?:Success: )?(\{.*\})/s);
            if (delegateMatch) {
                // ... existing logic ...
                try {
                    const json = JSON.parse(delegateMatch[1]);
                    if (json.text) {
                        const innerToolMatch = json.text.match(/\[Tool: ([^\]]+)\] Output: (?:Success: )?(\{.*\})/s);
                        if (innerToolMatch) {
                            const toolName = innerToolMatch[1];
                            const innerJsonStr = innerToolMatch[2];
                            try {
                                const innerJson = JSON.parse(innerJsonStr);
                                if (toolName === 'analyze_brand_consistency' && innerJson.analysis) {
                                    return (
                                        <div className="my-4 bg-purple-900/10 rounded-xl border border-purple-500/20 p-4">
                                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                                                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                                <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">Brand Analysis Report</span>
                                            </div>
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                <ReactMarkdown components={{ p: ({ children }: any) => <span className="block mb-2 last:mb-0">{children}</span> }}>
                                                    {innerJson.analysis}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="my-2 p-3 bg-white/5 rounded-lg border-l-2 border-purple-500 text-sm text-gray-300 font-mono whitespace-pre-wrap">
                                        <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Tool Result: {toolName}</div>
                                        {JSON.stringify(innerJson, null, 2)}
                                    </div>
                                );
                            } catch (e) { }
                        }
                        return <ReactMarkdown>{json.text}</ReactMarkdown>;
                    }
                } catch (e) { console.warn("Failed to parse delegate tool output:", e); }
            }
            return <p className="mb-4 last:mb-0">{children}</p>;
        },
        pre: ({ children, ...props }: any) => {
            // ... existing logic ...
            if (React.isValidElement(children)) {
                const { className, children: codeChildren } = children.props as any;
                const content = String(codeChildren || '');
                const match = /language-(\w+)/.exec(className || '');
                const isJson = match && match[1] === 'json';
                if (content.includes('# LEGAL AGREEMENT') || content.includes('**NON-DISCLOSURE AGREEMENT**')) return <>{children}</>;
                if (isJson) { try { JSON.parse(content.replace(/\n$/, '')); return <>{children}</>; } catch (e) { } }
            }
            return (
                <div className="overflow-x-auto custom-scrollbar my-2 rounded-lg border border-white/5 bg-black/30">
                    <pre {...props} className="p-4 min-w-full">{children}</pre>
                </div>
            );
        },
        table: ({ node, ...props }: any) => (
            <div className="overflow-x-auto custom-scrollbar my-4 border border-white/5 rounded-lg bg-black/20">
                <table {...props} className="min-w-full" />
            </div>
        ),
        code({ node, inline, className, children, ...props }: any) {
            // ... existing logic ...
            const match = /language-(\w+)/.exec(className || '')
            const isJson = match && match[1] === 'json';
            const childrenStr = String(children);
            if (!inline && (childrenStr.includes('# LEGAL AGREEMENT') || childrenStr.includes('**NON-DISCLOSURE AGREEMENT**'))) return <ContractRenderer markdown={childrenStr} />;
            if (!inline && isJson) {
                try {
                    const content = childrenStr.replace(/\n$/, '');
                    const data = JSON.parse(content);
                    if (data.beats && (data.title || data.synopsis)) return <VisualScriptRenderer data={data} />;
                    if (data.elements && data.elements[0]?.type === 'slugline') return <ScreenplayRenderer data={data} />;
                    if (data.callTime && data.nearestHospital) return <CallSheetRenderer data={data} />;
                    return <JsonViewer data={data} />;
                } catch (e) { }
            }
            return <code className={className} {...props}>{children}</code>
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6 px-1`}
        >
            {msg.role === 'model' && (
                <div className="relative mt-1 flex-shrink-0">
                    <div className={`absolute -inset-1 bg-${agentIdentity?.color || 'purple'}-500/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            className={`w-9 h-9 rounded-full object-cover relative z-10 border border-${agentIdentity?.color || 'purple'}-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]`}
                            alt="AI"
                        />
                    ) : agentIdentity ? (
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-${agentIdentity.color}-600 to-${agentIdentity.color}-800 flex items-center justify-center text-xs font-bold relative z-10 border border-${agentIdentity.color}-500/30 text-white shadow-lg`}>
                            {agentIdentity.initials}
                        </div>
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-xs font-bold relative z-10 border border-purple-500/30">
                            <Bot size={18} className="text-purple-200" />
                        </div>
                    )}
                </div>
            )}

            <div
                data-testid={msg.role === 'model' ? 'agent-message' : 'user-message'}
                aria-live={msg.role === 'model' && msg.isStreaming ? 'polite' : undefined}
                className={`max-w-[85%] rounded-[1.5rem] px-5 py-4 relative group transition-all duration-300 ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-white/10 to-transparent text-gray-100 border border-white/10 rounded-tr-sm shadow-sm'
                    : msg.role === 'system'
                        ? 'bg-white/5 backdrop-blur-sm text-gray-400 text-[11px] font-mono tracking-wider uppercase border border-white/5 w-full text-center rounded-xl p-2'
                        : 'bg-gradient-to-br from-[rgba(16,16,22,0.6)] to-[rgba(10,10,14,0.9)] text-gray-200 border border-white/5 rounded-tl-sm shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]'
                    }`}>

                {msg.role === 'model' && msg.thoughts && <ThoughtChain thoughts={msg.thoughts} messageId={msg.id} />}

                <div className="prose prose-invert prose-sm max-w-none break-words leading-[1.6] font-medium tracking-tight">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                    >
                        {msg.text}
                    </ReactMarkdown>
                </div>

                {msg.role === 'system' && <span>{msg.text}</span>}

                {msg.isStreaming && (
                    <div className="mt-2 flex items-center gap-1.5 h-4" role="status" aria-label="AI is thinking">
                        <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            className="w-1.5 h-1.5 bg-purple-500 rounded-full"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                            className="w-1.5 h-1.5 bg-purple-500/60 rounded-full"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.4 }}
                            className="w-1.5 h-1.5 bg-purple-500/30 rounded-full"
                        />
                    </div>
                )}

                {msg.attachments && (
                    <div className="mt-4 flex gap-3 flex-wrap">
                        {msg.attachments.map((att, i) => (
                            <motion.div
                                key={i}
                                whileHover={{ scale: 1.05, rotate: 2 }}
                                className="relative group/att"
                            >
                                <div className="absolute inset-0 bg-purple-500/20 blur opacity-0 group-hover/att:opacity-100 transition-opacity rounded-xl"></div>
                                <img src={att.base64} className="w-24 h-24 object-cover rounded-xl border border-white/10 shadow-lg relative z-10" alt="attachment" />
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
});

MessageItem.displayName = 'MessageItem';
