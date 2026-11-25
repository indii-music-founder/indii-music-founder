import React from 'react';
import { motion } from 'motion/react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    FileText,
    Music2,
    Paperclip,
} from 'lucide-react';
import type { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { ThoughtChain } from '@/core/components/chat/ThoughtChain';
import { PersonaResponseActions } from '@/core/components/chat/PersonaResponseActions';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';
import { displaySenderId } from '@/services/commands/entryCommandSender';
import { buildAttachmentDataUri } from './boardroomAttachmentDataUri';
import { AGENT_ICONS } from '../constants/agentIcons';

const MemoPersonaResponseActions = React.memo(PersonaResponseActions);
const MemoThoughtChain = React.memo(ThoughtChain);
const MemoReactMarkdown = React.memo(ReactMarkdown);
const REMARK_PLUGINS = [remarkGfm];

const ATTACHMENT_MIME_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'application/json': 'json',
    'text/plain': 'txt',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/flac': 'flac',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/aiff': 'aiff',
});

/**
 * Resolves a safe download filename for a message attachment.
 */
function attachmentDownloadName(index: number, mimeType: string, filename?: string): string {
    const safeName = filename && Array.from(filename, character => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127 || character === '/' || character === '\\' ? '_' : character;
    }).join('').trim().slice(0, 200);
    if (safeName && safeName !== '.' && safeName !== '..') {
        return safeName;
    }
    const normalizedMime = mimeType.toLowerCase().split(';')[0]?.trim() || '';
    const extension = ATTACHMENT_MIME_EXTENSIONS[normalizedMime];
    return `attachment-${index + 1}${extension ? `.${extension}` : ''}`;
}

/**
 * Sanitizes Boardroom message text before rendering.
 * Strips internal agent artifacts that should never be user-visible:
 * - [Tool: name]...[End Tool name] blocks (tool execution output)
 * - (SYSTEM NOTE): ... injected boardroom context
 * - [SEATED_AGENTS]: ... seating manifest
 */
export function sanitizeBoardroomMessage(text: string): string {
    return text
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\[Tool: [^\]]+\][\s\S]*?\[End Tool [^\]]+\]\n?/g, '')
        .replace(/\(SYSTEM NOTE\):[^\n]*\n?/g, '')
        .replace(/\[SEATED_AGENTS\]:[^\n]*\n?/g, '')
        .replace(/\(PRIOR CONTEXT\):[\s\S]*$/g, '')
        .replace(/^\[Thought\]:.*$/gm, '')
        .replace(/^\[Action\]:.*$/gm, '')
        .trim();
}

export interface BoardroomMessageRowProps {
    msg: AgentMessage;
    userAwaitingResponse: boolean;
    showCognitiveLogicByDefault: boolean;
    markdownComponents: Components;
}

/**
 * Memoized row component for Boardroom conversation messages.
 * Uses shallow React.memo comparison (no custom comparator) so streaming updates
 * to the tail message or metadata-only updates propagate without re-rendering
 * unchanged sibling rows.
 */
function BoardroomMessageRowInner({
    msg,
    userAwaitingResponse,
    showCognitiveLogicByDefault,
    markdownComponents,
}: BoardroomMessageRowProps) {
    const identity = resolveAgentVisualIdentity(displaySenderId(msg.agentId));
    const isUser = msg.role === 'user';
    const AgentIcon = AGENT_ICONS[identity.iconKey];
    const displayText = sanitizeBoardroomMessage(
        msg.text || (msg as { content?: string }).content || '',
    );

    return (
        <motion.div
            data-message-id={msg.id}
            data-agent-id={msg.agentId}
            data-agent-accent={isUser ? undefined : identity.accent}
            data-agent-icon={isUser ? undefined : identity.iconKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`flex items-start gap-3 py-3 px-3 rounded-xl transition-colors min-w-0 max-w-full ${isUser ? 'bg-white/2' : 'hover:bg-white/2'}`}
        >
            {/* Avatar */}
            <div className="shrink-0 mt-0.5">
                {isUser ? (
                    <div
                        data-testid={`user-avatar-${msg.id}`}
                        className={`relative w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center ${userAwaitingResponse ? 'motion-safe:animate-pulse scale-105' : ''}`}
                    >
                        {userAwaitingResponse && (
                            <span className="absolute inset-0 rounded-full motion-safe:animate-ping opacity-30 border pointer-events-none border-indigo-400" />
                        )}
                        <span className="text-[10px] font-bold text-indigo-300">You</span>
                    </div>
                ) : (
                    <div
                        className="w-8 h-8 rounded-full flex flex-col items-center justify-center border"
                        style={{
                            ...identity.cssProperties,
                            backgroundColor: identity.surface,
                            borderColor: identity.border,
                            color: identity.foreground,
                            boxShadow: `0 0 12px ${identity.glow}`,
                        } as React.CSSProperties}
                        aria-label={identity.ariaLabel}
                    >
                        <AgentIcon size={10} aria-hidden="true" style={{ color: identity.accent }} />
                        <span className="text-[10px] font-black leading-none">{identity.initials}</span>
                    </div>
                )}
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                {!isUser && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1 truncate">
                        {msg.role === 'system' && !msg.agentId ? 'Notice' : identity.displayName}
                    </p>
                )}
                {isUser && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400/50 mb-1 truncate">
                        You
                    </p>
                )}

                {!isUser && msg.thoughts && (
                    <MemoThoughtChain
                        thoughts={msg.thoughts}
                        messageId={msg.id}
                        compact
                        defaultOpen={showCognitiveLogicByDefault}
                    />
                )}

                <div className="message-content text-sm text-white/80 leading-relaxed break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap min-w-0 max-w-full">
                    <MemoReactMarkdown
                        remarkPlugins={REMARK_PLUGINS}
                        components={markdownComponents}
                    >
                        {displayText}
                    </MemoReactMarkdown>
                </div>

                {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                        {msg.attachments.map((att, i) => {
                            const mimeType = att.mimeType || '';
                            const dataUri = buildAttachmentDataUri(att);
                            const displayName = att.filename || attachmentDownloadName(i, mimeType, att.filename);
                            const mimeSubtype = (mimeType.split('/')[1] || 'file').split(';')[0] || 'file';

                            return (
                                <div
                                    key={`${msg.id}-att-${i}`}
                                    className="rounded-xl border border-white/10 bg-black/30 p-2.5 flex flex-col gap-1.5 max-w-[280px]"
                                >
                                    {att.loadFailed ? (
                                        <p role="alert" className="text-xs text-amber-200">
                                            Attachment could not be loaded. Reopen this conversation to retry.
                                        </p>
                                    ) : mimeType.startsWith('image/') && dataUri ? (
                                        <img
                                            src={dataUri}
                                            alt={att.filename || `attachment ${i + 1}`}
                                            className="max-w-[240px] max-h-[240px] object-cover rounded-lg border border-white/10"
                                        />
                                    ) : mimeType.startsWith('audio/') ? (
                                        <div className="flex flex-col gap-2 min-w-[220px]">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Music2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                <span className="text-xs text-white/90 truncate" title={displayName}>
                                                    {displayName}
                                                </span>
                                                <span className="text-[10px] font-mono uppercase text-white/40 ml-auto shrink-0">
                                                    {mimeSubtype}
                                                </span>
                                            </div>
                                            {dataUri && (
                                                <audio
                                                    controls
                                                    preload="metadata"
                                                    src={dataUri}
                                                    className="w-full h-8"
                                                    aria-label={displayName}
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 min-w-0">
                                            {mimeType === 'application/pdf' || mimeType.startsWith('text/') ? (
                                                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                                            ) : (
                                                <Paperclip className="w-4 h-4 text-white/60 shrink-0" />
                                            )}
                                            <span className="text-xs text-white/90 truncate" title={displayName}>
                                                {displayName}
                                            </span>
                                            <span className="text-[10px] font-mono uppercase text-white/40 ml-auto shrink-0">
                                                {mimeSubtype}
                                            </span>
                                        </div>
                                    )}

                                    {!att.loadFailed && dataUri && (
                                        <a
                                            href={dataUri}
                                            download={attachmentDownloadName(i, mimeType, att.filename)}
                                            className="text-[11px] text-amber-200 hover:text-amber-100 underline self-start"
                                        >
                                            Download attachment {i + 1}
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {msg.isStreaming && (
                    <div className="flex items-center gap-1 mt-2">
                        <motion.div
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                            className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
                        />
                        <span className="text-[10px] text-white/20">typing...</span>
                    </div>
                )}
                {!isUser && !msg.isStreaming && (
                    <MemoPersonaResponseActions text={displayText} metadata={msg.metadata} />
                )}
            </div>
        </motion.div>
    );
}

export const BoardroomMessageRow = React.memo(BoardroomMessageRowInner);
