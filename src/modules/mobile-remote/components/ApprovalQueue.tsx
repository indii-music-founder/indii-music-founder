/**
 * ApprovalQueue — Swipeable approval cards for the phone remote.
 * Shows pending items that need user approval: creative outputs,
 * distribution releases, contracts, and agent actions.
 */

import { useState } from 'react';
import {
    Check, X, Image, FileText, Globe, Shield,
    ChevronLeft, ChevronRight
} from 'lucide-react';

interface ApprovalItem {
    id: string;
    type: 'creative' | 'release' | 'contract' | 'agent';
    title: string;
    description: string;
    thumbnailUrl?: string;
    timestamp: number;
}

const TYPE_CONFIG = {
    creative: { icon: Image, color: 'text-purple-400 bg-purple-600/20', label: 'Creative' },
    release: { icon: Globe, color: 'text-blue-400 bg-blue-600/20', label: 'Release' },
    contract: { icon: Shield, color: 'text-red-400 bg-red-600/20', label: 'Contract' },
    agent: { icon: FileText, color: 'text-cyan-400 bg-cyan-600/20', label: 'Agent Action' },
};

interface ApprovalQueueProps {
    onSendCommand: (command: { type: string; payload: unknown }) => void;
    isPaired: boolean;
}

export default function ApprovalQueue({ onSendCommand, isPaired }: ApprovalQueueProps) {
    const [items, setItems] = useState<ApprovalItem[]>([
        // Demo items — in production these come from Firestore/WCP
        {
            id: 'demo-1',
            type: 'creative',
            title: 'Album Cover Concept #3',
            description: 'AI-generated cover art for "Midnight Sessions" EP',
            timestamp: Date.now() - 60000,
        },
        {
            id: 'demo-2',
            type: 'release',
            title: 'Spotify Singles Release',
            description: 'Distribution package ready for QC review',
            timestamp: Date.now() - 120000,
        },
        {
            id: 'demo-3',
            type: 'agent',
            title: 'Marketing Campaign Draft',
            description: 'indii Conductor prepared a social media campaign',
            timestamp: Date.now() - 180000,
        },
    ]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

    const currentItem = items[currentIndex];

    const handleApprove = (item: ApprovalItem) => {
        setSwipeDirection('right');
        onSendCommand({
            type: 'agent_action',
            payload: { action: 'approve', itemId: item.id, itemType: item.type },
        });

        setTimeout(() => {
            setItems(prev => prev.filter(i => i.id !== item.id));
            setCurrentIndex(i => Math.min(i, items.length - 2));
            setSwipeDirection(null);
        }, 300);
    };

    const handleReject = (item: ApprovalItem) => {
        setSwipeDirection('left');
        onSendCommand({
            type: 'agent_action',
            payload: { action: 'reject', itemId: item.id, itemType: item.type },
        });

        setTimeout(() => {
            setItems(prev => prev.filter(i => i.id !== item.id));
            setCurrentIndex(i => Math.min(i, items.length - 2));
            setSwipeDirection(null);
        }, 300);
    };

    const navigate = (direction: 'prev' | 'next') => {
        if (direction === 'prev' && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else if (direction === 'next' && currentIndex < items.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-green-900/20 border border-green-700/30 flex items-center justify-center mb-3">
                    <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm text-green-400 font-semibold">All clear</p>
                <p className="text-xs text-[#6e7681] mt-1">No pending approvals</p>
            </div>
        );
    }

    if (!currentItem) return null;

    const config = TYPE_CONFIG[currentItem.type];
    const Icon = config.icon;
    const timeAgo = Math.round((Date.now() - currentItem.timestamp) / 60000);

    return (
        <div className="space-y-3">
            {/* Counter */}
            <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-[#6e7681] font-medium">
                    {currentIndex + 1} of {items.length} pending
                </span>
                <div className="flex gap-1">
                    <button
                        onClick={() => navigate('prev')}
                        disabled={currentIndex === 0}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[#6e7681] hover:text-white disabled:opacity-20 transition-colors"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => navigate('next')}
                        disabled={currentIndex === items.length - 1}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[#6e7681] hover:text-white disabled:opacity-20 transition-colors"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Card */}
            <div className={`rounded-2xl border border-[#30363d]/40 bg-[#161b22]/70 backdrop-blur-xl overflow-hidden transition-all duration-300 ${swipeDirection === 'right' ? 'translate-x-full opacity-0' :
                    swipeDirection === 'left' ? '-translate-x-full opacity-0' : ''
                }`}>
                {/* Thumbnail area */}
                {currentItem.thumbnailUrl ? (
                    <div className="h-32 bg-[#0d1117] flex items-center justify-center">
                        <img src={currentItem.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                ) : (
                    <div className="h-20 bg-gradient-to-br from-[#161b22] to-[#0d1117] flex items-center justify-center">
                        <Icon className={`w-8 h-8 ${config.color.split(' ')[0]}`} />
                    </div>
                )}

                {/* Content */}
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.color}`}>
                            {config.label}
                        </span>
                        <span className="text-[10px] text-[#484f58]">{timeAgo}m ago</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{currentItem.title}</h3>
                    <p className="text-xs text-[#8b949e] mt-1">{currentItem.description}</p>
                </div>

                {/* Action buttons */}
                <div className="flex border-t border-[#30363d]/40">
                    <button
                        onClick={() => handleReject(currentItem)}
                        disabled={!isPaired}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-red-400 hover:bg-red-900/20 transition-colors active:scale-95 disabled:opacity-30 border-r border-[#30363d]/40"
                    >
                        <X className="w-4 h-4" />
                        <span className="text-xs font-semibold">Reject</span>
                    </button>
                    <button
                        onClick={() => handleApprove(currentItem)}
                        disabled={!isPaired}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-green-400 hover:bg-green-900/20 transition-colors active:scale-95 disabled:opacity-30"
                    >
                        <Check className="w-4 h-4" />
                        <span className="text-xs font-semibold">Approve</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
