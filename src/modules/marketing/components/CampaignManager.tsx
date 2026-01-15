import React, { useState } from 'react';
import { CampaignAsset, ScheduledPost, CampaignStatus } from '../types';
import CampaignList from './CampaignList';
import CampaignDetail from './CampaignDetail';
import EditableCopyModal from './EditableCopyModal';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { CampaignExecutionRequest } from '../schemas';

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
            // Determine Execution Mode
            // 1. Force Mock for Test Environment (Maestro) or offline dev without functions
            const forceMock = (window as any).__MAESTRO_MOCK_EXECUTION__;
            // 2. Dry Run for Localhost Dev to verify function connectivity without side effects
            // Note: import.meta.env.DEV might be true in production builds if not configured correctly,
            // but usually it's reliable for Vite.
            const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';

            let responseData: { posts?: ScheduledPost[], success?: boolean, message?: string } = {};

            if (forceMock || (!functions && isDev)) {
                 console.warn("[CampaignManager] Using Client-Side Mock Execution");
                 await new Promise(resolve => setTimeout(resolve, 1500));
                 responseData = {
                    posts: selectedCampaign.posts.map(p => ({
                        ...p,
                        status: CampaignStatus.DONE,
                        scheduledTime: new Date()
                    })),
                    success: true
                };
            } else {
                // REAL PRODUCTION BINDING
                // We map to our Zod-validated schema structure
                const payload: CampaignExecutionRequest = {
                    campaignId: selectedCampaign.id || 'unknown',
                    posts: selectedCampaign.posts,
                    dryRun: isDev // In dev mode, we ask the backend to dry-run
                };

                const executeCampaign = httpsCallable(functions, 'executeCampaign');
                const result = await executeCampaign(payload);
                responseData = result.data as any;
            }

            if (responseData.success && responseData.posts) {
                onUpdateCampaign({
                    ...selectedCampaign,
                    posts: responseData.posts,
                    status: CampaignStatus.DONE
                });
                toast.success(responseData.message || "Campaign executed successfully!");
            } else {
                 throw new Error(responseData.message || "Execution returned failure status.");
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
