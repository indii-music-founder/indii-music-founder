import React, { useState } from 'react';
import { CampaignAsset, ScheduledPost, CampaignStatus } from '../types';
import CampaignList from './CampaignList';
import CampaignDetail from './CampaignDetail';
import EditableCopyModal from './EditableCopyModal';
import IntelligenceImageBatchModal from './IntelligenceImageBatchModal';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { CampaignExecutionRequest } from '../schemas';
import { logger } from '@/utils/logger';

interface CampaignManagerProps {
    campaigns: CampaignAsset[];
    selectedCampaign: CampaignAsset | null;
    onSelectCampaign: (campaign: CampaignAsset | null) => void;
    onUpdateCampaign: (updatedCampaign: CampaignAsset) => Promise<void>;
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
    const [showImageBatchModal, setShowImageBatchModal] = useState(false);

    const handleExecute = async () => {
        if (!selectedCampaign) return;

        // Optimistic check
        if (selectedCampaign.status === CampaignStatus.DONE) {
            toast.info("Campaign is already completed.");
            return;
        }

        if (!functions) {
            toast.error("Cloud Functions not initialized. Cannot execute campaign.");
            return;
        }

        setIsExecuting(true);
        toast.info("Initializing campaign execution sequence...");

        // Optimistically update status to EXECUTING. onUpdateCampaign already
        // surfaces its own error toast on a failed persist; swallow the
        // rejection here so it doesn't also become an unhandled-rejection.
        const executingState = { ...selectedCampaign, status: CampaignStatus.EXECUTING };
        onUpdateCampaign(executingState).catch(() => {});

        try {
            // REAL PRODUCTION BINDING
            // We map to our Zod-validated schema structure
            const payload: CampaignExecutionRequest = {
                campaignId: selectedCampaign.id || 'unknown',
                posts: selectedCampaign.posts,
                dryRun: false // Always attempt real execution, backend handles safety
            };

            const executeCampaign = httpsCallable<CampaignExecutionRequest, { posts: ScheduledPost[]; success: boolean; message: string }>(functions, 'executeCampaign');
            const result = await executeCampaign(payload);
            const responseData = result.data;

            if (responseData.success && responseData.posts) {
                onUpdateCampaign({
                    ...selectedCampaign,
                    posts: responseData.posts,
                    status: CampaignStatus.EXECUTING
                }).catch(() => {});
                toast.success(responseData.message || "Campaign queued for scheduled delivery.");
            } else {
                throw new Error(responseData.message || "Execution returned failure status.");
            }

        } catch (error: unknown) {
            logger.error("Campaign Execution Failed:", error);

            // Revert status or set to FAILED
            onUpdateCampaign({ ...selectedCampaign, status: CampaignStatus.FAILED }).catch(() => {});

            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Execution failed: ${errorMsg}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleSaveCopy = async (postId: string, newCopy: string) => {
        if (!selectedCampaign) return;

        const updatedPosts = selectedCampaign.posts.map(post =>
            post.id === postId ? { ...post, copy: newCopy } : post
        );

        try {
            // ISSUE-949: only close the editor and claim success once the
            // edit has actually persisted — onUpdateCampaign already
            // surfaces its own error toast if the write fails.
            await onUpdateCampaign({ ...selectedCampaign, posts: updatedPosts });
            setEditingPost(null);
            toast.success("Post updated");
        } catch {
            // Keep the editor open on a failed save; error already toasted.
        }
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
                        onGenerateImages={() => setShowImageBatchModal(true)}
                    />
                    {editingPost && (
                        <EditableCopyModal
                            post={editingPost}
                            onClose={() => setEditingPost(null)}
                            onSave={handleSaveCopy}
                        />
                    )}
                    {showImageBatchModal && (
                        <IntelligenceImageBatchModal
                            campaign={selectedCampaign}
                            onClose={() => setShowImageBatchModal(false)}
                            onComplete={async (updatedCampaign) => {
                                // ISSUE-949: only close the modal once the
                                // generated image URLs have actually
                                // persisted — never claim "Apply & Save"
                                // succeeded when the write failed.
                                await onUpdateCampaign(updatedCampaign);
                                setShowImageBatchModal(false);
                            }}
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
