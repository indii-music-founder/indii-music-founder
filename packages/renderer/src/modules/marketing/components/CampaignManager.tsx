import React, { useState } from 'react';
import { CampaignAsset, ScheduledPost, CampaignStatus } from '../types';
import CampaignList from './CampaignList';
import CampaignDetail from './CampaignDetail';
import EditableCopyModal from './EditableCopyModal';
import IntelligenceImageBatchModal from './IntelligenceImageBatchModal';
import { useToast } from '@/core/context/ToastContext';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import {
    CampaignExecutionRequest,
    CampaignExecutionResponse,
    CampaignExecutionResponseSchema,
} from '../schemas';
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

        if (selectedCampaign.status === CampaignStatus.DONE) {
            toast.info("Campaign is already completed.");
            return;
        }

        if (selectedCampaign.status === CampaignStatus.EXECUTING) {
            toast.info("Campaign is already queued for delivery.");
            return;
        }

        if (!selectedCampaign.id) {
            toast.error("Save this campaign before queuing it for delivery.");
            return;
        }

        if (!functions) {
            toast.error("Cloud Functions not initialized. Cannot execute campaign.");
            return;
        }

        setIsExecuting(true);
        toast.info("Initializing campaign execution sequence...");

        const executingState = { ...selectedCampaign, status: CampaignStatus.EXECUTING };

        try {
            // Persist the exact campaign content before asking the backend to
            // source it. A failed save must stop external queue creation.
            await onUpdateCampaign(executingState);
        } catch (error: unknown) {
            logger.error("Campaign execution state could not be persisted:", error);
            toast.error("Campaign was not queued because its latest state could not be saved.");
            setIsExecuting(false);
            return;
        }

        try {
            const payload: CampaignExecutionRequest = {
                campaignId: selectedCampaign.id,
                dryRun: false,
            };

            const executeCampaign = httpsCallable<CampaignExecutionRequest, CampaignExecutionResponse>(functions, 'executeCampaign');
            const result = await executeCampaign(payload);
            const responseData = CampaignExecutionResponseSchema.parse(result.data);

            // The callable atomically persists these exact posts and status
            // with the queue. Update selected UI state without issuing a
            // second, fallible client write over the server-owned result.
            onSelectCampaign({
                ...selectedCampaign,
                posts: responseData.posts as ScheduledPost[],
                status: responseData.status as CampaignStatus,
            });
            if (responseData.status === CampaignStatus.FAILED) {
                toast.error(responseData.message);
            } else {
                toast.success(responseData.message);
            }

        } catch (error: unknown) {
            logger.error("Campaign Execution Failed:", error);

            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            try {
                // A callable transport error can be ambiguous. Mark the UI as
                // retryable; the backend's deterministic queue IDs make a
                // retry safe if the first request actually committed.
                await onUpdateCampaign({ ...selectedCampaign, status: CampaignStatus.FAILED });
                toast.error(`Execution could not be confirmed: ${errorMsg}. Retry is safe and will not duplicate queued posts.`);
            } catch (persistenceError: unknown) {
                logger.error("Campaign failure state could not be persisted:", persistenceError);
                toast.error(`Execution could not be confirmed: ${errorMsg}. The failure status also could not be saved; refresh before retrying.`);
            }
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
