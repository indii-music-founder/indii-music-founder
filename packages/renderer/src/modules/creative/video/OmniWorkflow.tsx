import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Video, Film, Shield, Sliders, Play,
    Sparkles, RefreshCw, Upload, Image, Eye,
    Sparkle, Info, Download, Plus, Trash2, X
} from 'lucide-react';
import { useStore, type StoreState } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { CostControlService } from '@/services/billing/CostControlService';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { auth, functions, storage } from '@/services/firebase';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { materializeVideoFrameForHandoff } from '@/services/creative/CreativeMediaHandoffService';
import { creativeAssetPayloadToHistoryItem, readCreativeAssetDrag } from '@/services/creative/CreativeAssetDragService';
import { resolveStorageUri } from '@/services/storage/storageUri';
import { normalizeVideoAspectRatio } from '@/services/video/videoAspectRatio';
import { GenerateOmniRemixSchema } from '@indii/shared';
import { downloadAsset } from '@/utils/download';
import { z } from 'zod';

interface StoryboardFrame {
    id: string;
    timestamp: number;
    previewUrl?: string;
    prompt: string;
}

interface Joint {
    id: string;
    x: number;
    y: number;
    label: string;
}

interface ReferenceMedia {
    uri: string;
    label: string;
}

type OmniTask = 'text_to_video' | 'image_to_video' | 'reference_to_video' | 'edit';

const OmniGatewayResponseSchema = z.object({
    jobId: z.string().trim().min(1),
    resultUri: z.string().startsWith('gs://'),
    interactionId: z.string().trim().min(1),
    task: z.enum(['text_to_video', 'image_to_video', 'reference_to_video', 'edit']),
    synthIdApplied: z.literal(true),
});

const OMNI_TASKS: Array<{ value: OmniTask; label: string; description: string }> = [
    { value: 'text_to_video', label: 'Text to video', description: 'Generate from the prompt and storyboard.' },
    { value: 'image_to_video', label: 'Image to video', description: 'Animate the first image; use any others as references.' },
    { value: 'reference_to_video', label: 'Reference to video', description: 'Guide subjects and style with up to eight images.' },
    { value: 'edit', label: 'Edit video', description: 'Edit an uploaded clip or continue the last Omni result.' },
];

interface Bone {
    from: string;
    to: string;
}

type CallableError = {
    code?: unknown;
    message?: unknown;
    details?: unknown;
};

function callableErrorMessage(error: unknown): string {
    const err = error as CallableError;
    const details = err?.details;
    if (details && typeof details === 'object') {
        const cause = (details as Record<string, unknown>).cause;
        if (typeof cause === 'string') return cause;
    }
    if (error instanceof Error && error.message) return error.message;
    if (typeof err?.message === 'string') return err.message;
    return 'Omni remix failed.';
}

async function resolveStorageUrl(uri: string): Promise<string> {
    if (!uri.startsWith('gs://')) return uri;
    const bucketPath = uri.split('/').slice(3).join('/');
    return getDownloadURL(ref(storage, bucketPath));
}

// Visual performance skeletal presets
const POSE_COORDINATES: Record<string, { joints: Joint[], bones: Bone[] }> = {
    guitar_solo: {
        joints: [
            { id: 'head', x: 50, y: 15, label: 'Head' },
            { id: 'neck', x: 50, y: 22, label: 'Neck' },
            { id: 'l_shoulder', x: 42, y: 25, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 58, y: 25, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 35, y: 38, label: 'Left Elbow' },
            { id: 'r_elbow', x: 65, y: 35, label: 'Right Elbow' },
            { id: 'l_wrist', x: 45, y: 45, label: 'Left Wrist' },
            { id: 'r_wrist', x: 72, y: 28, label: 'Right Wrist' },
            { id: 'hip', x: 50, y: 55, label: 'Hip' },
            { id: 'l_knee', x: 44, y: 72, label: 'Left Knee' },
            { id: 'r_knee', x: 56, y: 75, label: 'Right Knee' },
            { id: 'l_ankle', x: 42, y: 90, label: 'Left Ankle' },
            { id: 'r_ankle', x: 58, y: 92, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    },
    mic_stand_lean: {
        joints: [
            { id: 'head', x: 46, y: 13, label: 'Head' },
            { id: 'neck', x: 47, y: 20, label: 'Neck' },
            { id: 'l_shoulder', x: 38, y: 23, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 54, y: 23, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 32, y: 35, label: 'Left Elbow' },
            { id: 'r_elbow', x: 52, y: 15, label: 'Right Elbow' },
            { id: 'l_wrist', x: 36, y: 48, label: 'Left Wrist' },
            { id: 'r_wrist', x: 48, y: 10, label: 'Right Wrist' },
            { id: 'hip', x: 48, y: 53, label: 'Hip' },
            { id: 'l_knee', x: 40, y: 70, label: 'Left Knee' },
            { id: 'r_knee', x: 52, y: 72, label: 'Right Knee' },
            { id: 'l_ankle', x: 38, y: 88, label: 'Left Ankle' },
            { id: 'r_ankle', x: 54, y: 90, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    },
    dj_stance: {
        joints: [
            { id: 'head', x: 50, y: 18, label: 'Head' },
            { id: 'neck', x: 50, y: 25, label: 'Neck' },
            { id: 'l_shoulder', x: 40, y: 28, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 60, y: 28, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 32, y: 42, label: 'Left Elbow' },
            { id: 'r_elbow', x: 68, y: 42, label: 'Right Elbow' },
            { id: 'l_wrist', x: 42, y: 55, label: 'Left Wrist' },
            { id: 'r_wrist', x: 58, y: 55, label: 'Right Wrist' },
            { id: 'hip', x: 50, y: 60, label: 'Hip' },
            { id: 'l_knee', x: 45, y: 76, label: 'Left Knee' },
            { id: 'r_knee', x: 55, y: 76, label: 'Right Knee' },
            { id: 'l_ankle', x: 42, y: 92, label: 'Left Ankle' },
            { id: 'r_ankle', x: 58, y: 92, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    },
    vocal_belting: {
        joints: [
            { id: 'head', x: 50, y: 12, label: 'Head' },
            { id: 'neck', x: 50, y: 20, label: 'Neck' },
            { id: 'l_shoulder', x: 38, y: 24, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 62, y: 24, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 30, y: 38, label: 'Left Elbow' },
            { id: 'r_elbow', x: 70, y: 38, label: 'Right Elbow' },
            { id: 'l_wrist', x: 26, y: 24, label: 'Left Wrist' },
            { id: 'r_wrist', x: 74, y: 24, label: 'Right Wrist' },
            { id: 'hip', x: 50, y: 56, label: 'Hip' },
            { id: 'l_knee', x: 42, y: 74, label: 'Left Knee' },
            { id: 'r_knee', x: 58, y: 74, label: 'Right Knee' },
            { id: 'l_ankle', x: 40, y: 92, label: 'Left Ankle' },
            { id: 'r_ankle', x: 60, y: 92, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    },
    t_pose: {
        joints: [
            { id: 'head', x: 50, y: 15, label: 'Head' },
            { id: 'neck', x: 50, y: 22, label: 'Neck' },
            { id: 'l_shoulder', x: 36, y: 25, label: 'Left Shoulder' },
            { id: 'r_shoulder', x: 64, y: 25, label: 'Right Shoulder' },
            { id: 'l_elbow', x: 22, y: 25, label: 'Left Elbow' },
            { id: 'r_elbow', x: 78, y: 25, label: 'Right Elbow' },
            { id: 'l_wrist', x: 8, y: 25, label: 'Left Wrist' },
            { id: 'r_wrist', x: 92, y: 25, label: 'Right Wrist' },
            { id: 'hip', x: 50, y: 54, label: 'Hip' },
            { id: 'l_knee', x: 44, y: 72, label: 'Left Knee' },
            { id: 'r_knee', x: 56, y: 72, label: 'Right Knee' },
            { id: 'l_ankle', x: 44, y: 92, label: 'Left Ankle' },
            { id: 'r_ankle', x: 56, y: 92, label: 'Right Ankle' }
        ],
        bones: [
            { from: 'head', to: 'neck' },
            { from: 'neck', to: 'l_shoulder' },
            { from: 'neck', to: 'r_shoulder' },
            { from: 'l_shoulder', to: 'l_elbow' },
            { from: 'l_elbow', to: 'l_wrist' },
            { from: 'r_shoulder', to: 'r_elbow' },
            { from: 'r_elbow', to: 'r_wrist' },
            { from: 'neck', to: 'hip' },
            { from: 'hip', to: 'l_knee' },
            { from: 'l_knee', to: 'l_ankle' },
            { from: 'hip', to: 'r_knee' },
            { from: 'r_knee', to: 'r_ankle' }
        ]
    }
};

export default function OmniWorkflow() {
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Global Store State Connection
    const {
        studioControls,
        setStudioControls,
        addToHistory,
        currentProjectId,
        pendingStageHandoff,
        consumeStageHandoff,
        sendToStage
    } = useStore(useShallow((state: StoreState) => ({
        studioControls: state.studioControls,
        setStudioControls: state.setStudioControls,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId,
        pendingStageHandoff: state.pendingStageHandoff,
        consumeStageHandoff: state.consumeStageHandoff,
        sendToStage: state.sendToStage
    })));

    // Local Interactive States
    const [isRemixing, setIsRemixing] = useState(false);
    const [remixPrompt, setRemixPrompt] = useState('Remix performance into a cyberpunk neon concert stage, dramatic volumetric fog');
    // Launch from the only input required by Omni: a text prompt. Users can
    // opt into image/reference/video editing modes when they add that media.
    const [omniTask, setOmniTask] = useState<OmniTask>('text_to_video');
    const [refVideoFile, setRefVideoFile] = useState<File | null>(null);
    const [referenceVideoUri, setReferenceVideoUri] = useState<string | null>(null);
    const [referenceMedia, setReferenceMedia] = useState<ReferenceMedia[]>([]);
    const [activeFrameIndex, setActiveFrameIndex] = useState(0);
    const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
    const [outputStorageUri, setOutputStorageUri] = useState<string | undefined>();
    const [sourceJobId, setSourceJobId] = useState<string | null>(null);
    const [previousInteractionId, setPreviousInteractionId] = useState<string | null>(null);
    const [previousJobId, setPreviousJobId] = useState<string | null>(null);
    const [synthIdApplied, setSynthIdApplied] = useState(false);
    const [routingOutputTo, setRoutingOutputTo] = useState<'veo' | 'editor' | 'image' | null>(null);

    // Storyboard frame modal/creator state
    const [isAddingFrame, setIsAddingFrame] = useState(false);
    const [newFrameTimestamp, setNewFrameTimestamp] = useState<number>(3);
    const [newFramePrompt, setNewFramePrompt] = useState<string>('');

    // Flow Storyboard frames (dynamic state)
    const [storyboard, setStoryboard] = useState<StoryboardFrame[]>([]);

    // Consume cross-stage handoff if asset sent from Veo or Image stage
    useEffect(() => {
        const handoff = pendingStageHandoff?.omni;
        if (handoff) {
            if (handoff.role === 'source-video' && handoff.item.type === 'video') {
                // Set both preview URL and gs:// URI for backend
                setRefVideoFile(null);
                setReferenceMedia([]);
                setReferenceVideoUri(handoff.item.storageUri || resolveStorageUri(handoff.item.url) || '');
                setSourceJobId(handoff.item.id);
                setPreviousInteractionId(null);
                setPreviousJobId(null);
                setOmniTask('edit');
                setStudioControls({ omniReferenceVideo: handoff.item.url });
                toast.success(`Loaded performance from ${handoff.originStage} stage — ready to remix!`);
            } else if ((handoff.role === 'first-frame' || handoff.role === 'reference-image') && handoff.item.type === 'image') {
                const referenceUri = handoff.item.storageUri || resolveStorageUri(handoff.item.url);
                if (referenceUri) {
                    setReferenceMedia(prev => {
                        const next = prev.filter(entry => entry.uri !== referenceUri);
                        const entry = {
                            uri: referenceUri,
                            label: handoff.item.prompt || `${handoff.originStage} reference`,
                        };
                        return handoff.role === 'first-frame'
                            ? [entry, ...next].slice(0, 8)
                            : [...next, entry].slice(-8);
                    });
                    if (handoff.role === 'first-frame') {
                        setRefVideoFile(null);
                        setReferenceVideoUri(null);
                        setPreviousInteractionId(null);
                        setPreviousJobId(null);
                        setStudioControls({ omniReferenceVideo: null });
                        setOmniTask('image_to_video');
                        toast.info(`Using image from ${handoff.originStage} as Omni's starting frame.`);
                    } else {
                        if (!referenceVideoUri) setOmniTask('reference_to_video');
                        toast.info(`Using image from ${handoff.originStage} as visual reference.`);
                    }
                } else {
                    toast.info('Reference images are unavailable for this asset.');
                }
            } else if (handoff.role === 'reference-audio' && handoff.item.type === 'music') {
                toast.info('Omni Flash does not accept uploaded audio references yet. Describe the soundtrack in the prompt.');
            }
            // Consume the handoff (clear pending)
            consumeStageHandoff('omni');
        }
    }, [pendingStageHandoff?.omni, consumeStageHandoff, referenceVideoUri, setStudioControls, toast]);

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const userId = auth.currentUser?.uid;
                if (!userId) throw new Error('User must be authenticated to upload reference video.');
                setRefVideoFile(file);
                setReferenceMedia([]);
                const previewUrl = URL.createObjectURL(file);
                const uploadedUri = await CreativeStorageService.uploadReferenceMedia(userId, file, 'video');
                setReferenceVideoUri(uploadedUri);
                setSourceJobId(null);
                setPreviousInteractionId(null);
                setPreviousJobId(null);
                setOmniTask('edit');
                setStudioControls({ omniReferenceVideo: previewUrl });
                toast.success(`Loaded reference performance: ${file.name}`);
            } catch (error) {
                setRefVideoFile(null);
                setReferenceVideoUri(null);
                toast.error(`Reference upload failed: ${callableErrorMessage(error)}`);
            }
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, 8 - referenceMedia.length));
        if (files.length === 0) return;
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('User must be authenticated to upload reference images.');
            const uploaded = await Promise.all(files.map(async file => ({
                uri: await CreativeStorageService.uploadReferenceMedia(userId, file, 'image'),
                label: file.name,
            })));
            setReferenceMedia(prev => [...prev, ...uploaded].slice(0, 8));
            if (omniTask === 'text_to_video' || omniTask === 'edit') setOmniTask('reference_to_video');
            toast.success(`Loaded ${uploaded.length} visual reference${uploaded.length === 1 ? '' : 's'}.`);
        } catch (error) {
            toast.error(`Image upload failed: ${callableErrorMessage(error)}`);
        } finally {
            e.target.value = '';
        }
    };

    const ensureOmniReferenceUri = useCallback(async (
        item: NonNullable<ReturnType<typeof creativeAssetPayloadToHistoryItem>>,
        mediaType: 'image' | 'video',
    ) => {
        const existingUri = item.storageUri || resolveStorageUri(item.url);
        if (existingUri) return existingUri;
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in before importing this external asset.');
        return CreativeStorageService.uploadReferenceMedia(userId, item.url, mediaType, {
            projectId: currentProjectId || item.projectId || undefined,
        });
    }, [currentProjectId]);

    const handleCreativeAssetDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const payload = readCreativeAssetDrag(event.dataTransfer);
        if (!payload) return;
        const item = creativeAssetPayloadToHistoryItem(payload);

        try {
            if (item?.type === 'video') {
                const uri = await ensureOmniReferenceUri(item, 'video');
                setRefVideoFile(null);
                setReferenceMedia([]);
                setReferenceVideoUri(uri);
                setSourceJobId(item.id);
                setPreviousInteractionId(null);
                setPreviousJobId(null);
                setOmniTask('edit');
                setStudioControls({ omniReferenceVideo: item.url });
                toast.success('Dropped video loaded as the Omni edit source.');
                return;
            }

            if (item?.type === 'image') {
                const uri = await ensureOmniReferenceUri(item, 'image');
                setReferenceMedia(previous => {
                    const withoutDuplicate = previous.filter(reference => reference.uri !== uri);
                    return [...withoutDuplicate, { uri, label: item.prompt || payload.asset.name }].slice(-8);
                });
                if (referenceMedia.length === 0) {
                    setReferenceVideoUri(null);
                    setRefVideoFile(null);
                    setPreviousInteractionId(null);
                    setPreviousJobId(null);
                    setStudioControls({ omniReferenceVideo: null });
                    setOmniTask('image_to_video');
                    toast.success('Dropped image loaded as Omni’s starting frame.');
                } else {
                    if (!referenceVideoUri) setOmniTask('reference_to_video');
                    toast.success('Dropped image added as an Omni visual reference.');
                }
                return;
            }

            if (item?.type === 'music') {
                toast.info('Omni does not accept audio reference files yet; describe the soundtrack in the prompt.');
                return;
            }
            toast.info(`${payload.asset.name} cannot be used in Omni’s current media inputs.`);
        } catch (error) {
            toast.error(`Could not use dropped asset: ${callableErrorMessage(error)}`);
        }
    }, [ensureOmniReferenceUri, referenceMedia.length, referenceVideoUri, setStudioControls, toast]);

    const handleStartRemix = async () => {
        const canContinueInteraction = !!previousInteractionId && !!previousJobId;
        if (omniTask === 'edit' && !canContinueInteraction && !referenceVideoUri) {
            toast.error('Edit mode needs an uploaded source video or a completed Omni result.');
            return;
        }
        if (omniTask === 'image_to_video' && referenceMedia.length === 0) {
            toast.error('Image-to-video needs at least one image.');
            return;
        }
        if (omniTask === 'reference_to_video' && referenceMedia.length === 0) {
            toast.error('Reference-to-video needs at least one reference image.');
            return;
        }
        if (!remixPrompt.trim()) {
            toast.error('Describe the video you want to create.');
            return;
        }

        const { aspectRatio, coercedFrom } = normalizeVideoAspectRatio(studioControls.aspectRatio);
        if (coercedFrom && coercedFrom !== aspectRatio) {
            toast.info(`Omni supports only 16:9 and 9:16, so ${coercedFrom} was mapped to ${aspectRatio}.`);
        }

        setIsRemixing(true);
        setOutputVideoUrl(null);
        setOutputStorageUri(undefined);
        setSynthIdApplied(false);
        toast.info(canContinueInteraction && omniTask === 'edit' ? 'Continuing the stored Omni edit…' : 'Generating with Gemini Omni Flash…');

        try {
            const durationSeconds = Math.min(10, Math.max(3, studioControls.duration || 8));
            const estimatedCost = Math.round(durationSeconds * 0.1 * 100) / 100;
            const usePreviousInteraction = omniTask === 'edit' && canContinueInteraction;
            const firstFrameUri = omniTask === 'image_to_video' ? referenceMedia[0]?.uri : undefined;
            const referenceUris = omniTask === 'image_to_video'
                ? referenceMedia.slice(1).map(entry => entry.uri)
                : referenceMedia.map(entry => entry.uri);
            const basePayload = {
                prompt: remixPrompt,
                task: omniTask,
                ...(omniTask === 'edit' && !usePreviousInteraction && referenceVideoUri ? { referenceVideoUri } : {}),
                ...(firstFrameUri ? { firstFrameUri } : {}),
                referenceUris,
                ...(usePreviousInteraction && previousInteractionId && previousJobId
                    ? { previousInteractionId, previousJobId }
                    : {}),
                storyboard: storyboard.map(frame => ({
                    timestamp: Math.min(durationSeconds, Math.max(0, frame.timestamp)),
                    prompt: frame.prompt,
                })),
                aspectRatio,
                durationSeconds,
                posePreservation: studioControls.posePreservation,
                beatPulse: studioControls.beatPulse,
                characterXRay: studioControls.characterXRay,
                activePosePreset: studioControls.activePosePreset,
                lyricsText: studioControls.lyricsText || undefined,
                typographyStyle: studioControls.typographyStyle,
                visualizerColor: studioControls.visualizerColor,
                parentId: sourceJobId || undefined,
            };
            const basePayloadValidation = GenerateOmniRemixSchema.safeParse(basePayload);
            if (!basePayloadValidation.success) {
                const errorMsg = basePayloadValidation.error.issues.map(issue => issue.message).join(', ');
                throw new Error(`Invalid Omni gateway payload: ${errorMsg}`);
            }

            const costCheck = await CostControlService.checkAndReserve({
                operationType: 'video',
                estimatedCost,
                userId: auth.currentUser?.uid || '',
                metadata: {
                    durationSeconds,
                    model: 'gemini-omni-flash-preview',
                    task: omniTask,
                    aspectRatio,
                    referenceCount: referenceMedia.length,
                },
            });
            if (!costCheck.allowed || !costCheck.operationId) {
                throw new Error(`Omni remix blocked: ${costCheck.reason || 'Cost reservation failed.'}`);
            }

            const generateOmniRemixV3 = httpsCallable(functions, 'generateOmniRemixV3');
            const payload = {
                ...basePayloadValidation.data,
                costEstimate: estimatedCost,
                costReservationId: costCheck.operationId,
            };
            const response = await generateOmniRemixV3(payload);
            const parsedResponse = OmniGatewayResponseSchema.safeParse(response.data);
            if (!parsedResponse.success) {
                throw new Error('The Omni gateway returned an invalid response. The generated job was not added to local history.');
            }
            const data = parsedResponse.data;
            const videoUrl = await resolveStorageUrl(data.resultUri);
            const storageUri = resolveStorageUri(data.resultUri) || (data.resultUri.startsWith('gs://') ? data.resultUri : undefined);
            setOutputVideoUrl(videoUrl);
            setOutputStorageUri(storageUri);
            setPreviousInteractionId(data.interactionId);
            setPreviousJobId(data.jobId);
            setSynthIdApplied(data.synthIdApplied);
            setOmniTask('edit');

            const remixId = `omni_remix_${Date.now()}`;
            addToHistory({
                id: remixId,
                type: 'video',
                url: videoUrl,
                storageUri,
                prompt: `Omni ${data.task}: ${remixPrompt}`,
                timestamp: Date.now(),
                projectId: currentProjectId || '',
                origin: 'generated',
                parentId: sourceJobId || undefined,
                meta: JSON.stringify({
                    jobId: data.jobId,
                    interactionId: data.interactionId,
                    task: data.task,
                    aspectRatio,
                    durationSeconds,
                    posePreservation: studioControls.posePreservation,
                    beatPulse: studioControls.beatPulse,
                    characterXRay: studioControls.characterXRay,
                    synthIdApplied: data.synthIdApplied,
                    activePosePreset: studioControls.activePosePreset,
                    lyricsText: studioControls.lyricsText || undefined,
                    typographyStyle: studioControls.typographyStyle,
                    visualizerColor: studioControls.visualizerColor,
                    firstFrameUri,
                    referenceUris,
                    storyboard: payload.storyboard,
                    parentId: sourceJobId || undefined,
                })
            });

            toast.success('Omni video completed with automatic SynthID. You can refine it with another edit.');
        } catch (error) {
            const message = callableErrorMessage(error);
            if (message.includes('not configured for API use yet')) {
                toast.error(`API UNAVAILABLE: ${message}`);
            } else {
                toast.error(`Omni remix failed: ${message}`);
            }
        } finally {
            setIsRemixing(false);
        }
    };

    const handleDownload = async () => {
        if (!outputVideoUrl) return;
        const saved = await downloadAsset(outputVideoUrl, `omni_remix_${Date.now()}.mp4`);
        if (saved) toast.success('Video download started.');
        else toast.error('Video download failed. Please try again.');
    };

    const buildOutputItem = () => {
        if (!outputVideoUrl) return null;
        return {
            id: previousJobId || `omni_remix_${Date.now()}`,
            url: outputVideoUrl,
            storageUri: outputStorageUri,
            type: 'video' as const,
            prompt: remixPrompt,
            timestamp: Date.now(),
            projectId: currentProjectId || '',
            origin: 'generated' as const,
            parentId: sourceJobId || undefined,
        };
    };

    const handleSendOutputToVeo = () => {
        const item = buildOutputItem();
        if (!item || routingOutputTo) return;
        setRoutingOutputTo('veo');
        try {
            sendToStage('veo', {
                item,
                role: 'source-video',
                originStage: 'omni',
                timestamp: Date.now(),
                parentJobId: sourceJobId || undefined,
            });
            toast.success('Sent to Veo; its last frame will become the next shot’s first frame.');
        } finally {
            setRoutingOutputTo(null);
        }
    };

    const handleSendOutputToEditor = () => {
        const item = buildOutputItem();
        if (!item || routingOutputTo) return;
        setRoutingOutputTo('editor');
        try {
            sendToStage('editor', {
                item,
                role: 'source-video',
                originStage: 'omni',
                timestamp: Date.now(),
                parentJobId: sourceJobId || undefined,
            });
        } finally {
            setRoutingOutputTo(null);
        }
    };

    const handleSendOutputFrameToImage = async () => {
        const item = buildOutputItem();
        if (!item || routingOutputTo) return;
        const userId = auth.currentUser?.uid;
        if (!userId) {
            toast.error('Sign in before extracting a frame for Image Studio.');
            return;
        }

        setRoutingOutputTo('image');
        try {
            const frame = await materializeVideoFrameForHandoff(item, 'last', {
                userId,
                projectId: currentProjectId || undefined,
            });
            sendToStage('image', {
                item: frame,
                role: 'image-input',
                originStage: 'omni',
                timestamp: Date.now(),
                parentJobId: sourceJobId || undefined,
            });
            toast.success('Extracted the Omni end frame into Image Studio.');
        } catch (error) {
            toast.error(`Frame handoff failed: ${callableErrorMessage(error)}`);
        } finally {
            setRoutingOutputTo(null);
        }
    };

    // Storyboard Frame Actions
    const handleAddFrame = () => {
        if (!newFramePrompt.trim()) {
            toast.error("Please specify a scene prompt!");
            return;
        }
        const maxDuration = Math.min(10, Math.max(3, studioControls.duration || 8));
        if (newFrameTimestamp < 0 || newFrameTimestamp > maxDuration) {
            toast.error(`Storyboard timestamps must be between 0 and ${maxDuration} seconds.`);
            return;
        }

        const newFrame: StoryboardFrame = {
            id: `frame_${Date.now()}`,
            timestamp: newFrameTimestamp,
            prompt: newFramePrompt
        };

        setStoryboard(prev => [...prev, newFrame].sort((a, b) => a.timestamp - b.timestamp));
        setIsAddingFrame(false);
        setNewFramePrompt('');
        toast.success("Added new scene frame to storyboard sequence!");
    };

    const handleDeleteFrame = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setStoryboard(prev => prev.filter(f => f.id !== id));
        setActiveFrameIndex(0);
        toast.info("Removed frame from sequence");
    };

    const activePosePreset = POSE_COORDINATES[studioControls.activePosePreset] || POSE_COORDINATES['guitar_solo'] || { joints: [], bones: [] };
    const visualizerColor = studioControls.visualizerColor || '#8B5CF6';
    const pulseIntensity = studioControls.beatPulse || 0.5;
    const hasPreviousInteraction = !!previousInteractionId && !!previousJobId;
    const canGenerate = !!remixPrompt.trim() && !isRemixing && (
        omniTask === 'text_to_video'
        || (omniTask === 'edit' && (hasPreviousInteraction || !!referenceVideoUri))
        || ((omniTask === 'image_to_video' || omniTask === 'reference_to_video') && referenceMedia.length > 0)
    );
    const selectedTask = OMNI_TASKS.find(task => task.value === omniTask) ?? OMNI_TASKS[0];

    return (
        <div className="flex-1 flex overflow-hidden h-full bg-[#070709] text-white select-none">
            {/* Left Panel: Stage & Live Preview */}
            <div className="flex-1 flex flex-col p-6 min-w-0 border-r border-white/5 relative">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-green-400 flex items-center gap-2">
                        <div className="p-1 bg-green-500/10 rounded-lg">
                            <Video size={14} className="text-green-400" />
                        </div>
                        Gemini Omni Stage
                    </h2>
                    {studioControls.omniReferenceVideo && (
                        <button
                            onClick={() => {
                                if (studioControls.omniReferenceVideo?.startsWith('blob:')) {
                                    URL.revokeObjectURL(studioControls.omniReferenceVideo);
                                }
                                setRefVideoFile(null);
                                setReferenceVideoUri(null);
                                setSourceJobId(null);
                                setPreviousInteractionId(null);
                                setPreviousJobId(null);
                                setStudioControls({ omniReferenceVideo: null });
                                setOutputVideoUrl(null);
                                toast.info("Reference video cleared");
                            }}
                            className="text-[10px] text-gray-500 hover:text-red-400 uppercase font-mono tracking-wider font-bold transition-colors"
                        >
                            Reset Source
                        </button>
                    )}
                </div>

                {/* Main Video Arena */}
                <div
                    className="flex-1 flex flex-col items-center justify-center border border-white/10 rounded-2xl bg-white/[0.02] shadow-2xl relative overflow-hidden group"
                    onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(event) => { void handleCreativeAssetDrop(event); }}
                    data-testid="omni-asset-drop-zone"
                >
                    {/* Synchronized Beat Pulse Glow Rings */}
                    <div 
                        className="absolute inset-0 rounded-2xl pointer-events-none transition-all duration-300"
                        style={{
                            boxShadow: `inset 0 0 ${40 + pulseIntensity * 40}px ${visualizerColor}${isRemixing ? '33' : '15'}`,
                            border: `2.5px solid ${visualizerColor}${isRemixing ? '66' : '22'}`
                        }}
                    />

                    {/* Background glows */}
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-600/5 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

                    {outputVideoUrl ? (
                        <div className="absolute inset-0 w-full h-full flex flex-col justify-between p-4 z-10 bg-black">
                            <video 
                                src={outputVideoUrl} 
                                className="w-full h-full object-cover rounded-xl"
                                controls 
                                autoPlay 
                                loop
                            />
                            {/* Gemini automatically applies SynthID to every Omni video. */}
                            {synthIdApplied && (
                                <div className="absolute top-6 right-6 flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-full shadow-lg pointer-events-none select-none z-30">
                                    <Shield size={10} className="text-emerald-400" />
                                    <span className="text-[9px] font-bold text-emerald-400 font-mono uppercase tracking-widest">SynthID Applied</span>
                                </div>
                            )}

                            {/* Dynamic Kinetic Lyric Typography Preview Layer */}
                            {studioControls.lyricsText && (
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 text-center select-none max-w-lg px-6 py-3 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl bg-black/60">
                                    <p className={`text-base font-bold tracking-wide transition-all ${
                                        studioControls.typographyStyle === 'cyberpunk' ? 'font-mono text-green-400 uppercase tracking-widest animate-pulse' :
                                        studioControls.typographyStyle === 'kinetic-neon' ? 'font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase' :
                                        studioControls.typographyStyle === 'liquid-gold' ? 'font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 drop-shadow-md' :
                                        'font-sans text-white font-medium tracking-normal'
                                    }`}>
                                        {studioControls.lyricsText}
                                    </p>
                                    <span className="text-[7px] text-gray-500 font-mono block mt-1 uppercase tracking-widest">{studioControls.typographyStyle} OVERLAY</span>
                                </div>
                            )}

                            <div className="absolute bottom-6 right-6 flex gap-2 z-20">
                                <button
                                    onClick={handleSendOutputToVeo}
                                    disabled={routingOutputTo !== null}
                                    className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-cyan-400/30"
                                    title="Continue from this video's last frame in Veo"
                                    aria-label="Continue Omni video in Veo"
                                >
                                    <Video size={16} />
                                </button>
                                <button
                                    onClick={handleSendOutputToEditor}
                                    disabled={routingOutputTo !== null}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-emerald-400/30"
                                    title="Open this Omni video in the timeline editor"
                                    aria-label="Open Omni video in timeline editor"
                                >
                                    <Film size={16} />
                                </button>
                                <button
                                    onClick={() => { void handleSendOutputFrameToImage(); }}
                                    disabled={routingOutputTo !== null}
                                    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white p-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-fuchsia-400/30"
                                    title="Extract the final frame into Image Studio"
                                    aria-label="Send Omni final frame to Image Studio"
                                >
                                    <Image size={16} />
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="bg-green-600 hover:bg-green-500 text-white p-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-green-400/30"
                                    title="Download Synthesized Master"
                                >
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>
                    ) : studioControls.omniReferenceVideo ? (
                        <div className="absolute inset-0 flex flex-col justify-between p-4 z-10">
                            {/* Overlay Badge */}
                            <div className="flex items-center gap-2 self-start px-2.5 py-1.5 bg-black/60 rounded-lg border border-white/10 backdrop-blur-md">
                                <Film size={12} className="text-green-400 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase font-mono tracking-wider">Base Performance Active</span>
                            </div>

                            {/* Dynamic Kinetic Lyric Typography Preview Layer (on base reference) */}
                            {studioControls.lyricsText && (
                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 text-center select-none max-w-lg px-6 py-3 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl bg-black/60">
                                    <p className={`text-base font-bold tracking-wide transition-all ${
                                        studioControls.typographyStyle === 'cyberpunk' ? 'font-mono text-green-400 uppercase tracking-widest animate-pulse' :
                                        studioControls.typographyStyle === 'kinetic-neon' ? 'font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase' :
                                        studioControls.typographyStyle === 'liquid-gold' ? 'font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 drop-shadow-md' :
                                        'font-sans text-white font-medium tracking-normal'
                                    }`}>
                                        {studioControls.lyricsText}
                                    </p>
                                    <span className="text-[7px] text-gray-500 font-mono block mt-1 uppercase tracking-widest">{studioControls.typographyStyle} OVERLAY</span>
                                </div>
                            )}
                            
                            {/* Interactive Character X-ray skeletal mesh overlay */}
                            {studioControls.characterXRay && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    {/* Skeletal Pose Presets Wireframe Canvas */}
                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        <g stroke={visualizerColor} strokeWidth="1.5" opacity="0.8" strokeLinecap="round">
                                            {activePosePreset.bones.map((bone, idx) => {
                                                const fromJoint = activePosePreset.joints.find(j => j.id === bone.from);
                                                const toJoint = activePosePreset.joints.find(j => j.id === bone.to);
                                                if (!fromJoint || !toJoint) return null;
                                                return (
                                                    <line 
                                                        key={`bone-${idx}`} 
                                                        x1={fromJoint.x} 
                                                        y1={fromJoint.y} 
                                                        x2={toJoint.x} 
                                                        y2={toJoint.y} 
                                                    />
                                                );
                                            })}
                                        </g>
                                        <g>
                                            {activePosePreset.joints.map((joint) => (
                                                <circle 
                                                    key={`joint-${joint.id}`}
                                                    cx={joint.x}
                                                    cy={joint.y}
                                                    r="2"
                                                    fill="#10B981"
                                                    stroke="#FFFFFF"
                                                    strokeWidth="0.5"
                                                    className="animate-pulse"
                                                    style={{ filter: `drop-shadow(0 0 4px ${visualizerColor})` }}
                                                />
                                            ))}
                                        </g>
                                    </svg>
                                    <motion.div 
                                        initial={{ opacity: 0.3 }}
                                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="text-[10px] font-mono text-emerald-400 uppercase font-bold px-3 py-1.5 bg-black/85 rounded-lg border border-emerald-500/30 flex items-center gap-1.5 shadow-xl shadow-emerald-950/20 z-10 self-center"
                                    >
                                        <Eye size={12} className="animate-pulse text-emerald-400" /> Pose locked: {studioControls.activePosePreset.replace('_', ' ')}
                                    </motion.div>
                                </div>
                            )}

                            <div className="w-full h-full flex items-center justify-center opacity-80 pointer-events-none select-none">
                                <Video size={64} className="text-white/10 animate-pulse" />
                            </div>

                            <div className="flex items-center justify-between mt-auto z-10">
                                <span className="text-[10px] font-mono text-gray-500 bg-black/40 px-2 py-1 rounded border border-white/5 truncate max-w-[200px]">{refVideoFile?.name || "base_performance.mp4"}</span>
                                <span className="text-[9px] font-mono text-green-400 font-bold uppercase tracking-widest">OMNI EDIT SOURCE</span>
                            </div>
                        </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center p-12 cursor-pointer select-none text-center hover:bg-white/[0.04] transition-all rounded-xl h-full w-full border border-dashed border-white/10 hover:border-green-500/40"
                        >
                            <div className="p-4 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 mb-4 group-hover:scale-115 transition-all shadow-inner shadow-green-500/5">
                                <Upload size={28} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-white">
                                {omniTask === 'edit' ? 'Upload a video to edit' : 'Optional video source'}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-1.5 uppercase tracking-wider font-mono">
                                {omniTask === 'edit' ? 'Choose .mp4/.mov, or switch generation mode' : `${selectedTask.label} is ready from the controller`}
                            </span>
                            <input 
                                type="file" 
                                id="omni-video-file-input"
                                ref={fileInputRef}
                                accept="video/*" 
                                onChange={handleVideoUpload} 
                                className="sr-only focus:outline-none focus:ring-2 focus:ring-dept-creative focus:ring-offset-2 focus:ring-offset-[#070709] rounded-md"
                                aria-label="Upload Artist Base Performance Video"
                            />
                        </div>
                    )}
                </div>

                {/* Bottom Storyboard Panel */}
                <div className="h-48 mt-6 border-t border-white/5 pt-4 flex flex-col gap-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Omni Timecode Storyboard (sent to generation)</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-400 uppercase font-mono tracking-widest">{storyboard.length} Scenes Planned</span>
                            <button
                                onClick={() => setIsAddingFrame(true)}
                                className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-[9px] font-bold uppercase font-mono tracking-wider rounded transition-colors"
                            >
                                <Plus size={10} /> Add Frame
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {storyboard.length === 0 && (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 uppercase tracking-widest border border-dashed border-white/10 rounded-xl">
                                No storyboard frames yet
                            </div>
                        )}
                        {storyboard.map((frame, i) => (
                            <motion.div 
                                key={frame.id} 
                                whileHover={{ y: -2, borderColor: 'rgba(147, 51, 234, 0.4)' }}
                                onClick={() => setActiveFrameIndex(i)}
                                className={`w-52 bg-white/[0.03] rounded-xl border p-2 flex flex-col justify-between shrink-0 relative cursor-pointer transition-all ${
                                    activeFrameIndex === i ? 'border-green-500 shadow-[0_0_15px_rgba(147,51,234,0.15)] bg-green-500/[0.02]' : 'border-white/10'
                                }`}
                            >
                                <div className="h-24 bg-black rounded-lg flex items-center justify-center overflow-hidden border border-white/5 relative">
                                    {frame.previewUrl ? (
                                        <img src={frame.previewUrl} alt={frame.prompt} className="w-full h-full object-cover opacity-80" />
                                    ) : (
                                        <div className="px-3 text-center text-[9px] text-gray-500 uppercase tracking-wider">
                                            Prompt only
                                        </div>
                                    )}
                                    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/75 rounded text-[8px] font-mono text-green-300 border border-white/10">
                                        Frame {i + 1} ({frame.timestamp}s)
                                    </div>
                                    <button 
                                        onClick={(e) => handleDeleteFrame(frame.id, e)}
                                        className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-red-500/85 hover:text-white text-gray-400 border border-white/10 rounded-md transition-colors"
                                        title="Delete Frame"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                                <span className="text-[9px] text-gray-400 line-clamp-2 mt-1.5 select-text leading-relaxed font-mono font-medium">{frame.prompt}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel: Omni Controller & Dubbing */}
            <div className="w-80 border-l border-white/5 flex flex-col bg-[#08080a] p-4 shrink-0 overflow-y-auto custom-scrollbar">
                <h3 className="text-xs font-bold uppercase tracking-widest text-green-400 mb-4 flex items-center gap-2">
                    <Sliders size={14} className="text-green-400" />
                    Omni Controller
                </h3>

                <div className="space-y-6 flex-1 flex flex-col">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
                            Generation mode
                        </label>
                        <select
                            aria-label="Omni generation mode"
                            value={omniTask}
                            onChange={(event) => setOmniTask(event.target.value as OmniTask)}
                            className="w-full bg-black/60 text-[10px] p-2.5 rounded-lg border border-white/10 outline-none text-gray-200 font-mono focus:border-green-500/50"
                        >
                            {OMNI_TASKS.map(task => (
                                <option key={task.value} value={task.value}>{task.label}</option>
                            ))}
                        </select>
                        <p className="text-[9px] text-gray-500 leading-relaxed">{selectedTask.description}</p>
                        {hasPreviousInteraction && omniTask === 'edit' && (
                            <p className="text-[9px] text-emerald-400 font-mono">Continuing the last stored Omni interaction.</p>
                        )}
                    </div>

                    {/* Conversational Remix Box */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                            <Sparkle size={11} className="text-green-400" />
                            Video prompt and edit directives
                        </label>
                        <textarea
                            value={remixPrompt}
                            onChange={(e) => setRemixPrompt(e.target.value)}
                            className="w-full bg-black/60 text-white text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/10 h-24 resize-none placeholder:text-gray-600 transition-all font-mono leading-relaxed"
                            placeholder="Describe the result, action, camera, style, and soundtrack…"
                        />
                    </div>

                    {/* Character X-ray */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/20 transition-all group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <Eye size={12} className={studioControls.characterXRay ? 'text-emerald-400' : 'text-gray-400'} />
                                Character X-Ray
                            </span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Pose matching & posture locking</span>
                        </div>
                        <button 
                            onClick={() => setStudioControls({ characterXRay: !studioControls.characterXRay })}
                            className={`w-9 h-5 rounded-full relative transition-all ${
                                studioControls.characterXRay 
                                    ? 'bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                    : 'bg-gray-800'
                            }`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                studioControls.characterXRay ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-404 uppercase font-mono tracking-wider">
                                <span>Pose Preservation</span>
                                <span className="font-mono text-green-400">{(studioControls.posePreservation * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05"
                                value={studioControls.posePreservation} 
                                onChange={(e) => setStudioControls({ posePreservation: parseFloat(e.target.value) })}
                                className="w-full accent-purple-500 bg-black/60 h-1.5 rounded-full outline-none cursor-pointer"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-404 uppercase font-mono tracking-wider">
                                <span>Beat Motion Pulse</span>
                                <span className="font-mono text-green-400">{(studioControls.beatPulse * 100).toFixed(0)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05"
                                value={studioControls.beatPulse} 
                                onChange={(e) => setStudioControls({ beatPulse: parseFloat(e.target.value) })}
                                className="w-full accent-purple-500 bg-black/60 h-1.5 rounded-full outline-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Audio is prompt-directed; uploaded audio is not supported by Omni preview. */}
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest font-mono flex items-center gap-1.5">
                            <Info size={12} className="text-green-400" />
                            Generated soundtrack
                        </span>
                        <p className="text-[9px] text-gray-500 leading-relaxed">
                            Describe dialogue, ambience, sound effects, and music in the prompt. Uploaded audio and voice editing are not supported in this preview.
                        </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest font-mono flex items-center gap-1.5">
                                <Image size={12} className="text-green-400" />
                                Visual references ({referenceMedia.length}/8)
                            </span>
                            <button
                                onClick={() => imageInputRef.current?.click()}
                                disabled={referenceMedia.length >= 8}
                                className="px-2 py-1 bg-green-500/10 hover:bg-green-500/15 disabled:opacity-40 border border-green-500/20 rounded text-[9px] font-bold uppercase font-mono text-green-300"
                            >
                                Add images
                            </button>
                            <input
                                type="file"
                                id="omni-image-file-input"
                                ref={imageInputRef}
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                className="sr-only"
                                aria-label="Upload Omni reference images"
                            />
                        </div>
                        {referenceMedia.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {referenceMedia.map((entry) => (
                                    <button
                                        key={entry.uri}
                                        onClick={() => setReferenceMedia(prev => prev.filter(ref => ref.uri !== entry.uri))}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-green-500/10 border border-green-500/20 text-green-200 hover:bg-green-500/20 transition-colors"
                                        title={`Remove ${entry.label}`}
                                    >
                                        <span className="max-w-36 truncate">{entry.label}</span>
                                        <X size={10} />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[9px] text-gray-500 leading-relaxed">Required for image and reference modes; optional during edits.</p>
                        )}
                    </div>

                    {/* Gemini applies SynthID automatically. */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                                <Shield size={12} className="text-emerald-400" />
                                Automatic SynthID
                            </span>
                            <span className="text-[9px] text-gray-500 mt-0.5">Google watermarks every generated Omni video.</span>
                        </div>
                        <span className="text-[9px] font-bold font-mono text-emerald-400 uppercase">Always on</span>
                    </div>

                    {/* Remix Synthesis Button */}
                    <button 
                        onClick={handleStartRemix}
                        disabled={!canGenerate}
                        className="w-full mt-6 py-3.5 bg-gradient-to-r from-green-600 to-indigo-600 hover:from-green-500 hover:to-indigo-500 disabled:from-gray-850 disabled:to-gray-850 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-bold uppercase tracking-widest font-mono flex items-center justify-center gap-2 shadow-xl shadow-green-500/10 border border-green-400/20 hover:scale-[1.01] active:scale-[0.99] transition-all shrink-0 text-white"
                    >
                        {isRemixing ? (
                            <>
                                <RefreshCw size={14} className="animate-spin text-green-200" />
                                Generating Omni video…
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} fill="white" className="text-green-200 animate-pulse" />
                                {hasPreviousInteraction && omniTask === 'edit' ? 'Refine Last Omni Video' : 'Generate Omni Video'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Storyboard Add Frame Modal */}
            <AnimatePresence>
                {isAddingFrame && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0b0b0e] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setIsAddingFrame(false)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-green-400 mb-4 flex items-center gap-2">
                                <Plus size={16} /> Add Storyboard Scene Frame
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Timestamp (Seconds)</label>
                                    <input 
                                        type="number" 
                                        step="0.1" 
                                        min="0"
                                        max={Math.min(10, Math.max(3, studioControls.duration || 8))}
                                        value={newFrameTimestamp}
                                        onChange={(e) => setNewFrameTimestamp(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 outline-none focus:border-green-500/40 text-xs font-mono text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest font-mono">Scene Prompt Directive</label>
                                    <textarea 
                                        rows={3}
                                        value={newFramePrompt}
                                        onChange={(e) => setNewFramePrompt(e.target.value)}
                                        placeholder="Describe the styling, action, or camera movement..."
                                        className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 outline-none focus:border-green-500/40 text-xs font-mono text-white resize-none"
                                    />
                                </div>
                                <button 
                                    onClick={handleAddFrame}
                                    className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl text-xs font-bold uppercase tracking-widest font-mono transition-colors text-white"
                                >
                                    Add Frame to Sequence
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
