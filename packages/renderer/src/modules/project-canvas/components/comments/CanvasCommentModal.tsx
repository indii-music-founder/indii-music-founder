/**
 * CanvasCommentModal.tsx
 *
 * Comments and collaboration dialog for Project Canvas blocks and frames.
 *
 * Architectural Guarantees:
 * 1. Attaches comments to specific canvas blocks or frames.
 * 2. Surfaces author, timestamp, resolved status.
 * 3. Supports resolving threads without deleting audit trail.
 */

import React, { useState } from 'react';
import {
    X,
    MessageSquare,
    Send,
    CheckCircle2,
    Calendar,
    User,
} from 'lucide-react';
import type { CanvasComment } from '../../types';

interface CanvasCommentModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetBlockId: string;
    targetTitle: string;
    comments: CanvasComment[];
    onAddComment: (targetId: string, content: string) => void;
    onResolveComment: (commentId: string) => void;
}

export const CanvasCommentModal: React.FC<CanvasCommentModalProps> = ({
    isOpen,
    onClose,
    targetBlockId,
    targetTitle,
    comments,
    onAddComment,
    onResolveComment,
}) => {
    const [newText, setNewText] = useState('');

    if (!isOpen) return null;

    const blockComments = comments.filter((c) => c.targetId === targetBlockId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newText.trim()) return;
        onAddComment(targetBlockId, newText.trim());
        setNewText('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div
                className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
                role="dialog"
                aria-label={`Comments for ${targetTitle}`}
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                            <MessageSquare size={16} />
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold text-zinc-100 truncate max-w-[280px]">
                                Comments: {targetTitle}
                            </h3>
                            <span className="text-[10px] text-zinc-500 font-mono">
                                {blockComments.length} {blockComments.length === 1 ? 'comment' : 'comments'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Comment List */}
                <div className="p-5 overflow-y-auto space-y-3 flex-1 min-h-0">
                    {blockComments.length === 0 ? (
                        <div className="py-8 text-center text-zinc-500 text-xs flex flex-col items-center">
                            <MessageSquare size={24} className="opacity-40 mb-2" />
                            No comments on this block yet. Start a discussion below.
                        </div>
                    ) : (
                        blockComments.map((comment) => (
                            <div
                                key={comment.id}
                                className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                                    comment.resolved
                                        ? 'bg-zinc-950/30 border-zinc-800/50 opacity-60'
                                        : 'bg-zinc-950/60 border-zinc-800'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-bold">
                                            {comment.authorName ? comment.authorName.slice(0, 1).toUpperCase() : <User size={10} />}
                                        </div>
                                        <span className="font-semibold text-zinc-200 text-[11px]">{comment.authorName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={10} />
                                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <button
                                            onClick={() => onResolveComment(comment.id)}
                                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                                                comment.resolved
                                                    ? 'text-emerald-400 bg-emerald-500/10'
                                                    : 'text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800'
                                            }`}
                                            title={comment.resolved ? 'Resolved' : 'Mark as resolved'}
                                        >
                                            <CheckCircle2 size={11} />
                                            <span>{comment.resolved ? 'Resolved' : 'Resolve'}</span>
                                        </button>
                                    </div>
                                </div>
                                <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                    {comment.content}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                {/* Input Form */}
                <form onSubmit={handleSubmit} className="p-3 bg-zinc-950/60 border-t border-zinc-800 flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Add a comment or feedback..."
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                    <button
                        type="submit"
                        disabled={!newText.trim()}
                        className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-blue-600/20"
                        title="Post Comment"
                    >
                        <Send size={13} />
                    </button>
                </form>
            </div>
        </div>
    );
};
