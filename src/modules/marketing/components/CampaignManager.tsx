import React, { useState } from 'react';
import { Twitter, Instagram, Send, Loader2, CheckCircle, AlertTriangle, Pencil, Image as ImageIcon } from 'lucide-react';
import { CampaignAsset, CampaignStatus, ScheduledPost } from '../types';
import EditableCopyModal from './EditableCopyModal';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

interface CampaignManagerProps {
    campaign: CampaignAsset;
    onUpdate: (updatedCampaign: CampaignAsset) => void;
}

const PostStatusIcon: React.FC<{ status: CampaignStatus }> = ({ status }) => {
    switch (status) {
        case CampaignStatus.PENDING:
            return <div className="w-3 h-3 rounded-full bg-gray-500" title="Pending"></div>;
        case CampaignStatus.EXECUTING:
            return <span title="Executing"><Loader2 className="w-3 h-3 text-yellow-400 animate-spin" /></span>;
        case CampaignStatus.DONE:
            return <span title="Done"><CheckCircle className="w-3 h-3 text-green-400" /></span>;
        case CampaignStatus.FAILED:
            return <span title="Failed"><AlertTriangle className="w-3 h-3 text-red-400" /></span>;
        default:
            return null;
    }
};

const CampaignManager: React.FC<CampaignManagerProps> = ({ campaign, onUpdate }) => {
    const toast = useToast();
    const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    const handleExecute = async () => {
        setIsExecuting(true);
        toast.info("Starting campaign execution...");

        try {
            const executeCampaign = httpsCallable(functions, 'executeCampaign');
            const response = await executeCampaign({ posts: campaign.posts });
            const data = response.data as any;

            if (data.posts) {
                onUpdate({ ...campaign, posts: data.posts });
                toast.success("Campaign execution completed!");
            }
        } catch (error) {
            console.error("Campaign Execution Failed:", error);
            toast.error("Campaign execution failed");
        } finally {
            setIsExecuting(false);
        }
    };

    const handleSaveCopy = (postId: string, newCopy: string) => {
        const updatedPosts = campaign.posts.map(post =>
            post.id === postId ? { ...post, copy: newCopy } : post
        );
        onUpdate({ ...campaign, posts: updatedPosts });
        setEditingPost(null);
        toast.success("Post updated");
    };

    const isDone = campaign.posts.every(p => p.status === CampaignStatus.DONE || p.status === CampaignStatus.FAILED);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <div>
                    <h3 className="text-xl font-bold text-white">{campaign.title}</h3>
                    <p className="text-sm text-gray-400">{campaign.durationDays}-day social media campaign • {campaign.startDate}</p>
                </div>
                <button
                    onClick={handleExecute}
                    disabled={isExecuting || isDone}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isExecuting ? 'Executing...' : (isDone ? 'Campaign Finished' : 'Execute Campaign')}
                </button>
            </div>

            <div className="space-y-3">
                {campaign.posts.map(post => (
                    <div key={post.id} className="bg-gray-900/30 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${post.platform === 'Twitter' ? 'bg-sky-500/10 text-sky-400' : 'bg-pink-500/10 text-pink-500'}`}>
                                    {post.platform === 'Twitter' ? <Twitter size={18} /> : <Instagram size={18} />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-200 flex items-center gap-2">
                                        Day {post.day}
                                        <PostStatusIcon status={post.status} />
                                    </h4>
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">{post.platform}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingPost(post)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
                            >
                                <Pencil className="w-3 h-3" />
                                Edit
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            {post.imageAsset.imageUrl ? (
                                <img
                                    src={post.imageAsset.imageUrl}
                                    alt={post.imageAsset.title}
                                    className="w-24 h-24 object-cover rounded-lg flex-shrink-0 bg-gray-800 border border-gray-700"
                                />
                            ) : (
                                <div className="w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center text-gray-600 border border-gray-700">
                                    <ImageIcon size={24} />
                                </div>
                            )}

                            <div className="flex-1 text-sm text-gray-300 space-y-2">
                                <p className="whitespace-pre-wrap font-mono bg-black/20 p-3 rounded-lg border border-white/5">{post.copy}</p>

                                {post.status === CampaignStatus.FAILED && (
                                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                        <AlertTriangle size={12} />
                                        Error: {post.errorMessage}
                                    </div>
                                )}
                                {post.status === CampaignStatus.DONE && post.postId && (
                                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 p-2 rounded-lg border border-green-500/20">
                                        <CheckCircle size={12} />
                                        Posted • ID: {post.postId}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {editingPost && (
                <EditableCopyModal
                    post={editingPost}
                    onClose={() => setEditingPost(null)}
                    onSave={handleSaveCopy}
                />
            )}
        </div>
    );
};

export default CampaignManager;
