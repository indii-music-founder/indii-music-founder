import React, { useState } from 'react';
import { CampaignAsset, ScheduledPost } from '../types';
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
}

const CampaignManager: React.FC<CampaignManagerProps> = ({
    campaigns,
    selectedCampaign,
    onSelectCampaign,
    onUpdateCampaign,
    onCreateNew
}) => {
    const toast = useToast();
    const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    const handleExecute = async () => {
        if (!selectedCampaign) return;

        setIsExecuting(true);
        toast.info("Starting campaign execution...");

        try {
            const executeCampaign = httpsCallable(functions, 'executeCampaign');
            const response = await executeCampaign({ posts: selectedCampaign.posts });
            const data = response.data as any;

            if (data.posts) {
                onUpdateCampaign({ ...selectedCampaign, posts: data.posts });
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
                />
            )}
        </div>
    );
};

export default CampaignManager;
