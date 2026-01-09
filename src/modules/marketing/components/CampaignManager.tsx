import React, { useState } from 'react';
import { CampaignAsset, ScheduledPost, CampaignStatus } from '../types';
import CampaignList from './CampaignList';
import CampaignDetail from './CampaignDetail';
import EditableCopyModal from './EditableCopyModal';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

interface CampaignManagerProps {
    campaigns: CampaignAsset[];
    selectedCampaign: CampaignAsset | null;
    onSelectCampaign: (campaign: CampaignAsset | null) => void;
    onUpdateCampaign: (updatedCampaign: CampaignAsset) => void;
    onCreateNew: () => void;
    onAIGenerate?: () => void;
}

const CampaignManager: React.FC<CampaignManagerProps> = ({
    campaigns,
    selectedCampaign,
    onSelectCampaign,
    onUpdateCampaign,
    onCreateNew,
    onAIGenerate
}) => {
    const toast = useToast();
    const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    const handleExecute = async () => {
        if (!selectedCampaign) return;

        // Optimistic check
        if (selectedCampaign.status === CampaignStatus.DONE) {
            toast.info("Campaign is already completed.");
            return;
        }

        setIsExecuting(true);
        toast.info("Initializing campaign execution sequence...");

        // Optimistically update status to EXECUTING
        const executingState = { ...selectedCampaign, status: CampaignStatus.EXECUTING };
        onUpdateCampaign(executingState);

        try {
            // Check if we are in a dev environment or if functions is not initialized
            const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';

            let responseData: { posts?: ScheduledPost[] } = {};

            if (isDev && !functions) {
                console.warn("[CampaignManager] Firebase functions not available in Dev. specific mock mode.");
                // Mock delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                // Mock success
                responseData = {
                    posts: selectedCampaign.posts.map(p => ({
                        ...p,
                        status: CampaignStatus.DONE,
                        scheduledTime: new Date()
                    }))
                };
            } else {
                const executeCampaign = httpsCallable(functions, 'executeCampaign');
                const response = await executeCampaign({ posts: selectedCampaign.posts });
                responseData = response.data as { posts?: ScheduledPost[] };
            }

            if (responseData.posts) {
                onUpdateCampaign({
                    ...selectedCampaign,
                    posts: responseData.posts,
                    status: CampaignStatus.DONE // Assuming all done for now
                });
                toast.success("All posts successfully executed!");
            } else {
                // Fallback if no posts returned but no error thrown
                onUpdateCampaign({
                    ...selectedCampaign,
                    status: CampaignStatus.DONE
                });
                toast.success("Campaign execution sequence finished.");
            }
        } catch (error: any) {
            console.error("Campaign Execution Failed:", error);

            // Revert status or set to FAILED
            onUpdateCampaign({ ...selectedCampaign, status: CampaignStatus.FAILED });

            const errorMsg = error.message || "Unknown error";
            toast.error(`Execution failed: ${errorMsg}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleSaveCopy = (postId: string, newCopy: string) => {
        if (!selectedCampaign) return;

        const updatedPosts = selectedCampaign.posts.map(post =>
            post.id === postId ? { ...post, copy: newCopy } : post
        );
        onUpdateCampaign({ ...selectedCampaign, posts: updatedPosts });
        setEditingPost(null);
        toast.success("Post updated");
    };

    return (
        <div className="h-full">
            {selectedCampaign ? (
                <>
                    <CampaignDetail
                        campaign={selectedCampaign}
                        onBack={() => onSelectCampaign(null)}
                        onExecute={handleExecute}
                        isExecuting={isExecuting}
                        onEditPost={setEditingPost}
                        onGenerateImages={() => toast.info("Image generation functionality coming soon!")}
                    />
                    {editingPost && (
                        <EditableCopyModal
                            post={editingPost}
                            onClose={() => setEditingPost(null)}
                            onSave={handleSaveCopy}
                        />
                    )}
                </>
            ) : (
                <CampaignList
                    campaigns={campaigns}
                    onSelectCampaign={onSelectCampaign}
                    onCreateNew={onCreateNew}
                    onAIGenerate={onAIGenerate}
                />
            )}
        </div>
    );
};

export default CampaignManager;
