/* eslint-disable @typescript-eslint/no-explicit-any -- Core infrastructure types */
import React, { memo, useMemo } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot } from 'lucide-react';
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
import { ImageRenderer, ToolImageOutput, ToolDocumentOutput, ToolFeedbackOutput } from './ToolOutputRenderer';
import { CodeBlock } from './CodeBlock';

import { safeJsonParse } from '@/services/utils/json';
import { PlanCard } from './PlanCard';
import { livingPlanService, LivingPlan } from '@/services/agent/LivingPlanService';
import { agentService } from '@/services/agent/AgentService';
import { useEffect, useState } from 'react';
import { useToast } from '@/core/context/ToastContext';

// Types
import { Components } from 'react-markdown';
import { logger } from '@/utils/logger';

interface MessageItemProps {
    msg: AgentMessage;
    avatarUrl?: string;
    variant?: 'default' | 'compact';
    agentIdentity?: {
        color: string;
        initials: string;
    };
}

const LivingPlanToolRenderer = memo(({ planId }: { planId: string }) => {
    const [plan, setPlan] = useState<LivingPlan | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const toast = useToast();
    const currentProjectId = useStore(state => state.currentProjectId);

    useEffect(() => {
        if (!currentProjectId || !planId) return;

        const fetchPlan = async () => {
            try {
                const fetchedPlan = await livingPlanService.get(currentProjectId, planId);
                setPlan(fetchedPlan);
            } catch (e) {
                logger.error('Failed to load living plan:', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlan();
    }, [planId, currentProjectId]);

    if (isLoading) return <div className="p-4 animate-pulse bg-cyan-500/5 rounded-lg border border-cyan-500/20 text-xs text-cyan-400">Fetching living plan...</div>;
    if (!plan) return <div className="p-4 bg-red-500/5 rounded-lg border border-red-500/20 text-xs text-red-400">Plan not found or deleted.</div>;

    const handleApprove = async () => {
        if (!currentProjectId) return;
        try {
            await livingPlanService.approve(currentProjectId, planId);
            const updated = await livingPlanService.get(currentProjectId, planId);
            setPlan(updated);
            toast.success('Plan approved! Strategy is now active.');
            
            // Resume the agent loop with the approved plan
            await agentService.resumeActivePlan(planId);
        } catch (e) {
            logger.error('Failed to approve plan:', e);
            toast.error('Failed to approve plan.');
        }
    };

    const handleRefine = () => {
        toast.info('Refinement mode active. Tell me what to change!');
    };

    const handleCancel = async () => {
        if (!currentProjectId) return;
        try {
            await livingPlanService.cancel(currentProjectId, planId);
            const updated = await livingPlanService.get(currentProjectId, planId);
            setPlan(updated);
            toast.info('Plan cancelled.');
        } catch (e) {
            logger.error('Failed to cancel plan:', e);
            toast.error('Failed to cancel plan.');
        }
    };

    return (
        <PlanCard 
            plan={plan}
            onApprove={handleApprove}
            onRefine={handleRefine}
            onCancel={handleCancel}
        />
    );
});

export const MessageItem = memo(({ msg, avatarUrl, variant = 'default', agentIdentity }: MessageItemProps) => {
    // Custom Markdown Components
    // ... existing components ...
    const { cleanText, extractedTools, planIdFallback } = useMemo(() => {
        const text = msg.text || '';
        const tools: Array<{name: string, json: any}> = [];
        let planId = (msg.planId || msg.metadata?.planId) as string | undefined;

        let strippedText = text;
        
        // Match robust backend explicit tool delimiters BEFORE Markdown corruption
        // We handle cases where the LLM hallucinates Markdown code blocks or escapes the brackets
        const toolRegex = /(?:```(?:json)?\s*)?(?:\\?\[)Tool:\s*([a-zA-Z0-9_]+)(?:\\?\])([\s\S]*?)(?:\\?\[)End Tool \1(?:\\?\])(?:\s*```)?/g;
        let match;
        
        while ((match = toolRegex.exec(text)) !== null) {
            const toolName = match[1]!;
            const rawJson = match[2]!.trim();
            
            try {
                // If it's a delegate task that contains an inner tool block, we skip the outer parse 
                // and just parse the inner if possible. But for simplicity, we parse whatever is inside.
                const json = JSON.parse(rawJson);
                tools.push({ name: toolName, json });
                
                if (toolName === 'propose_plan' || toolName === 'get_plan') {
                    const id = json.planId || json.data?.planId;
                    if (id) planId = id;
                }
            } catch (e) {
                // We still strip it even if parsing fails, so raw backend logs don't leak to UI
                logger.warn(`Failed to parse tool output for ${toolName}:`, e);
            }
            
            strippedText = strippedText.replace(match[0], '');
        }

        // Legacy regex fallback for older chat histories missing the [End Tool] wrapper
        const legacyToolRegex = /(?:```(?:json)?\s*)?(?:\\?\[)Tool:\s*([a-zA-Z0-9_]+)(?:\\?\])\s*(\{[\s\S]*?\})(?=\n*(?:(?:\\?\[)Tool:|```|$))(?:\n*```)?/g;
        let legacyMatch;
        while ((legacyMatch = legacyToolRegex.exec(strippedText)) !== null) {
            const fullMatch = legacyMatch[0];
            const toolName = legacyMatch[1]!;
            const rawJson = legacyMatch[2]!.trim();
            
            try {
                const json = JSON.parse(rawJson);
                tools.push({ name: toolName, json });
                
                if (toolName === 'propose_plan' && !planId) {
                    const id = json.planId || json.data?.planId;
                    if (id) planId = id;
                }
            } catch (_e) {
                // Ignored. If it fails, it might be due to incomplete generation, we still strip it.
            }
            
            strippedText = strippedText.replace(fullMatch, '');
            // We must adjust regex index because we modified the string we're iterating over
            legacyToolRegex.lastIndex -= fullMatch.length;
        }

        return { cleanText: strippedText.trim(), extractedTools: tools, planIdFallback: planId };
    }, [msg.text, msg.planId, msg.metadata]);

    const markdownComponents: Components = useMemo(() => ({
        img: ({ src, alt }: { src?: string; alt?: string }) => <ImageRenderer src={src} alt={alt} messageId={msg.id} agentId={(msg as any).agentId || 'Conductor'} />,
        p: ({ children }: { children?: React.ReactNode }) => {
            return <p className="mb-4 last:mb-0">{children}</p>;
        },
        pre: ({ children, ...props }: { children?: React.ReactNode }) => {
            if (React.isValidElement(children)) {
                const childProps = children.props as { className?: string; children?: React.ReactNode };
                const { className, children: codeChildren } = childProps;
                const content = String(codeChildren || '');
                const match = /language-(\w+)/.exec(className || '');
                const isJson = match && match[1] === 'json';
                if (content.includes('# LEGAL AGREEMENT') || content.includes('**NON-DISCLOSURE AGREEMENT**')) return children;
                if (isJson) { try { JSON.parse(content.replace(/\n$/, '')); return children; } catch (_e: unknown) { /* ignore */ } }
            }
            return <CodeBlock {...props}>{children}</CodeBlock>;
        },
        table: ({ children, ...props }: { children?: React.ReactNode }) => (
            <div className="overflow-x-auto custom-scrollbar my-4 border border-white/5 rounded-lg bg-black/20">
                <table {...props} className="min-w-full">{children}</table>
            </div>
        ),
        code({ inline, className, children, ...props }: { node?: any; inline?: boolean; className?: string; children?: React.ReactNode }) {
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
                } catch (_e: unknown) { /* ignore */ }
            }
            return <code className={className} {...props}>{children}</code>
        }
    }), []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${variant === 'compact' ? 'mb-3' : 'mb-6'} px-1`}
        >
            {msg.role === 'model' && (
                <div className="relative mt-1 flex-shrink-0">
                    <div className={`absolute -inset-1 bg-${agentIdentity?.color || 'purple'}-500/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            className={`${variant === 'compact' ? 'w-6 h-6' : 'w-9 h-9'} rounded-full object-cover relative z-10 border border-${agentIdentity?.color || 'purple'}-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]`}
                            alt="AI"
                        />
                    ) : agentIdentity ? (
                        <div className={`${variant === 'compact' ? 'w-6 h-6 text-[8px]' : 'w-9 h-9 text-xs'} rounded-full bg-linear-to-br from-${agentIdentity.color}-600 to-${agentIdentity.color}-800 flex items-center justify-center font-bold relative z-10 border border-${agentIdentity.color}-500/30 text-white shadow-lg`}>
                            {agentIdentity.initials}
                        </div>
                    ) : (
                        <div className={`${variant === 'compact' ? 'w-6 h-6' : 'w-9 h-9'} rounded-full bg-linear-to-br from-purple-600 to-purple-800 flex items-center justify-center text-xs font-bold relative z-10 border border-purple-500/30`}>
                            <Bot size={variant === 'compact' ? 12 : 18} className="text-purple-200" />
                        </div>
                    )}
                </div>
            )}

            <div
                data-testid={msg.role === 'model' ? 'agent-message' : 'user-message'}
                aria-live={msg.role === 'model' && msg.isStreaming ? 'polite' : undefined}
                className={`max-w-[90%] rounded-[1.2rem] ${variant === 'compact' ? 'px-3 py-2 text-xs' : 'px-5 py-4'} relative group transition-all duration-300 ${msg.role === 'user'
                    ? 'bg-linear-to-br from-white/10 to-transparent text-gray-100 border border-white/10 rounded-tr-sm shadow-sm'
                    : msg.role === 'system'
                        ? 'bg-white/5 backdrop-blur-sm text-gray-400 text-[10px] font-mono tracking-wider uppercase border border-white/5 w-full text-center rounded-xl p-1.5'
                        : 'bg-linear-to-br from-[rgba(16,16,22,0.6)] to-[rgba(10,10,14,0.9)] text-gray-200 border border-white/5 rounded-tl-sm shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]'
                    }`}>

                {msg.role === 'model' && msg.thoughts && <ThoughtChain thoughts={msg.thoughts} messageId={msg.id} compact={variant === 'compact'} />}

                <div className={`prose prose-invert ${variant === 'compact' ? 'prose-xs' : 'prose-sm'} max-w-full overflow-hidden break-words break-all leading-[1.5] font-medium tracking-tight`}>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                    >
                        {cleanText}
                    </ReactMarkdown>
                </div>

                {/* Metadata-driven Plan Rendering (Fallback/Secondary) */}
                {msg.role === 'model' && planIdFallback && !extractedTools.find(t => t.name === 'propose_plan') && (
                    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <LivingPlanToolRenderer planId={planIdFallback} />
                    </div>
                )}

                {msg.role === 'system' && <span>{msg.text}</span>}

                {/* Render Extracted Tools (Parsed directly from text stream) */}
                {msg.role === 'model' && extractedTools.length > 0 && (
                    <div className="mt-4 flex flex-col gap-4">
                        {extractedTools.map((tool, idx) => {
                            if (tool.name === 'propose_plan' && (tool.json.planId || tool.json.data?.planId)) {
                                return (
                                    <div key={`ext-tool-${idx}`} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <LivingPlanToolRenderer planId={tool.json.planId || tool.json.data.planId} />
                                    </div>
                                );
                            }
                            
                            if (tool.name === 'analyze_brand_consistency' && tool.json.analysis) {
                                return (
                                    <div key={`ext-tool-${idx}`} className="my-4 bg-purple-900/10 rounded-xl border border-purple-500/20 p-4">
                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                                            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                            <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">Brand Analysis Report</span>
                                        </div>
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <ReactMarkdown components={{ p: ({ children }: { children?: React.ReactNode }) => <span className="block mb-2 last:mb-0">{children}</span> }}>
                                                {tool.json.analysis as string}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                );
                            }

                            // We let generate_image be handled by the thoughts array below, 
                            // or we could add it here. For now we only handle non-image tools here.
                            return null;
                        })}
                    </div>
                )}

                {/* Robust Tool Result Rendering (Persisted via Thoughts) */}
                {msg.role === 'model' && msg.thoughts?.map((thought, tIdx) => {
                    if (thought.type !== 'tool_result') return null;

                    try {
                        let jsonStr = thought.text;
                        if (jsonStr.startsWith('Success: ')) {
                            jsonStr = jsonStr.substring(9);
                        } else if (jsonStr.startsWith('Error: ')) {
                            return null;
                        }

                        const json = safeJsonParse(jsonStr); if (!json) return null;
                        const toolName = thought.toolName || 'unknown_tool';

                        if ((toolName === 'generate_image' || toolName === 'batch_edit_images' || toolName === 'generate_high_res_asset' || toolName === 'remix_image') && (json.urls || json.image_ids)) {
                            // Prefer URLs from the tool output directly (stateless)
                            if (json.urls && Array.isArray(json.urls)) {
                                return (
                                    <div key={`tool-res-${tIdx}`} className="flex flex-col gap-4 my-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {json.urls.map((url: string, idx: number) => (
                                            <ToolImageOutput key={idx} toolName={toolName} idx={idx} url={url} messageId={msg.id} agentId={(msg as any).agentId || 'Conductor'} />
                                        ))}
                                    </div>
                                );
                            }

                            // Fallback to ID lookup (requires client state)
                            const { generatedHistory } = useStore.getState();
                            let imageIds: string[] = [];
                            if (json.image_ids && Array.isArray(json.image_ids)) imageIds = json.image_ids;
                            else if (json.asset_id) imageIds = [json.asset_id];

                            const images = imageIds.map(id => generatedHistory.find(h => h.id === id)).filter((img): img is NonNullable<typeof img> => !!img);

                            if (images.length > 0) {
                                return (
                                    <div key={`tool-res-${tIdx}`} className="flex flex-col gap-4 my-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {images.map((img, idx: number) => (
                                            <ToolImageOutput key={idx} toolName={toolName} idx={idx} url={img.url} prompt={img.prompt} messageId={msg.id} agentId={(msg as any).agentId || 'Conductor'} />
                                        ))}
                                    </div>
                                );
                            }
                        }

                        // Document Tool Handling
                        if ((toolName === 'generate_contract' || toolName === 'edit_document_with_annotations') && (json.url || json.urls)) {
                            const urls = json.urls || [json.url];
                            return (
                                <div key={`tool-res-${tIdx}`} className="flex flex-col gap-4 my-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {urls.map((url: string, idx: number) => (
                                        <ToolDocumentOutput key={idx} toolName={toolName} idx={idx} url={url} prompt={json.name || json.title} messageId={msg.id} agentId={(msg as any).agentId || 'Conductor'} />
                                    ))}
                                </div>
                            );
                        }

                        // Feedback Tool Handling (Bug/Feature)
                        if ((toolName === 'report_bug' || toolName === 'request_feature') && json.markdownBody) {
                            return (
                                <div key={`tool-res-${tIdx}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <ToolFeedbackOutput 
                                        toolName={toolName} 
                                        title={json.title} 
                                        severity={json.severity} 
                                        priority={json.priority} 
                                        markdownBody={json.markdownBody} 
                                    />
                                </div>
                            );
                        }
                    } catch (_e: unknown) { /* ignore parse errors */ }
                    return null;
                })}

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
                                {att.mimeType && !att.mimeType.startsWith('image/') ? (
                                    <div className="w-24 h-24 rounded-xl border border-white/10 shadow-lg relative z-10 flex flex-col items-center justify-center bg-gray-900/50 p-2 text-center overflow-hidden">
                                        <div className="flex-1 flex items-center justify-center">
                                            {att.mimeType.startsWith('audio/') ? (
                                                <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                                </svg>
                                            ) : (
                                                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="text-[9px] text-gray-400 font-mono tracking-tighter truncate w-full uppercase mt-1">
                                            {att.mimeType.split('/')[1] || 'FILE'}
                                        </div>
                                    </div>
                                ) : (
                                    <img src={att.base64} className="w-24 h-24 object-cover rounded-xl border border-white/10 shadow-lg relative z-10" alt="attachment" />
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Mobile Remote Source Badge */}
                {msg.source === 'mobile-remote' && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-cyan-400/70 font-medium tracking-wide">
                        <span>📱</span>
                        <span>Sent from indiiREMOTE</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
});

MessageItem.displayName = 'MessageItem';

// Alias for backwards compatibility — AgentDashboard imports { ChatMessage }
export { MessageItem as ChatMessage };
