import { z } from 'zod';
export declare const BaseMediaRequestSchema: z.ZodObject<{
    prompt: z.ZodString;
    referenceUri: z.ZodOptional<z.ZodString>;
    referenceUris: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    referenceUri?: string | undefined;
    referenceUris?: string[] | undefined;
}, {
    prompt: string;
    referenceUri?: string | undefined;
    referenceUris?: string[] | undefined;
}>;
export declare const GenerateImageSchema: z.ZodObject<{
    prompt: z.ZodString;
    referenceUri: z.ZodOptional<z.ZodString>;
    referenceUris: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    /** Server-issued, owner-bound cost hold. Browser estimates are never authority. */
    costReservationId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    aspectRatio: z.ZodDefault<z.ZodEnum<["1:1", "16:9", "9:16", "3:4", "4:3"]>>;
    model: z.ZodDefault<z.ZodEnum<["lite", "fast", "pro", "legacy"]>>;
    imageSize: z.ZodOptional<z.ZodEnum<["512", "0.5K", "1K", "2K", "4K", "1k", "2k", "4k"]>>;
    count: z.ZodDefault<z.ZodNumber>;
    thinkingLevel: z.ZodOptional<z.ZodEnum<["none", "minimal", "low", "medium", "high"]>>;
    includeThoughts: z.ZodOptional<z.ZodBoolean>;
    responseFormat: z.ZodDefault<z.ZodEnum<["image_only", "image_and_text"]>>;
    useGoogleSearch: z.ZodOptional<z.ZodBoolean>;
    useImageSearch: z.ZodOptional<z.ZodBoolean>;
    useGrounding: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    aspectRatio: "16:9" | "9:16" | "1:1" | "3:4" | "4:3";
    model: "lite" | "fast" | "pro" | "legacy";
    costReservationId: string;
    count: number;
    responseFormat: "image_only" | "image_and_text";
    sessionId?: string | undefined;
    referenceUri?: string | undefined;
    referenceUris?: string[] | undefined;
    imageSize?: "4k" | "512" | "0.5K" | "1K" | "2K" | "4K" | "1k" | "2k" | undefined;
    thinkingLevel?: "none" | "minimal" | "low" | "medium" | "high" | undefined;
    includeThoughts?: boolean | undefined;
    useGoogleSearch?: boolean | undefined;
    useImageSearch?: boolean | undefined;
    useGrounding?: boolean | undefined;
}, {
    prompt: string;
    costReservationId: string;
    aspectRatio?: "16:9" | "9:16" | "1:1" | "3:4" | "4:3" | undefined;
    sessionId?: string | undefined;
    model?: "lite" | "fast" | "pro" | "legacy" | undefined;
    referenceUri?: string | undefined;
    referenceUris?: string[] | undefined;
    imageSize?: "4k" | "512" | "0.5K" | "1K" | "2K" | "4K" | "1k" | "2k" | undefined;
    count?: number | undefined;
    thinkingLevel?: "none" | "minimal" | "low" | "medium" | "high" | undefined;
    includeThoughts?: boolean | undefined;
    responseFormat?: "image_only" | "image_and_text" | undefined;
    useGoogleSearch?: boolean | undefined;
    useImageSearch?: boolean | undefined;
    useGrounding?: boolean | undefined;
}>;
export declare const GenerateVideoSchema: z.ZodObject<{
    prompt: z.ZodString;
    referenceUri: z.ZodOptional<z.ZodString>;
} & {
    costReservationId: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<["video_remix", "temporal_inpaint"]>>;
    sourceVideoUri: z.ZodOptional<z.ZodString>;
    firstFrameUri: z.ZodOptional<z.ZodString>;
    lastFrameUri: z.ZodOptional<z.ZodString>;
    maskFrameUri: z.ZodOptional<z.ZodString>;
    maskTrackUri: z.ZodOptional<z.ZodString>;
    frameRange: z.ZodOptional<z.ZodObject<{
        startFrame: z.ZodNumber;
        endFrame: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        startFrame: number;
        endFrame: number;
    }, {
        startFrame: number;
        endFrame: number;
    }>>;
    referenceUris: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    aspectRatio: z.ZodDefault<z.ZodEnum<["16:9", "9:16", "1:1", "3:4", "4:3"]>>;
    model: z.ZodDefault<z.ZodEnum<["lite", "fast", "pro"]>>;
    resolution: z.ZodDefault<z.ZodEnum<["720p", "1080p", "4k", "1280x720", "1920x1080", "3840x2160"]>>;
    durationSeconds: z.ZodDefault<z.ZodNumber>;
    directorSettings: z.ZodOptional<z.ZodObject<{
        fps: z.ZodDefault<z.ZodNumber>;
        durationSeconds: z.ZodOptional<z.ZodNumber>;
        totalFrames: z.ZodOptional<z.ZodNumber>;
        aspectRatio: z.ZodOptional<z.ZodEnum<["16:9", "9:16", "1:1"]>>;
        resolution: z.ZodOptional<z.ZodEnum<["720p", "1080p", "4k"]>>;
        seed: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
        cameraPhysics: z.ZodOptional<z.ZodObject<{
            pan: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            tilt: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            zoom: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            crane: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            pan?: number | undefined;
            tilt?: number | undefined;
            zoom?: number | undefined;
            crane?: number | undefined;
        }, {
            pan?: number | undefined;
            tilt?: number | undefined;
            zoom?: number | undefined;
            crane?: number | undefined;
        }>>;
        firstFrameUri: z.ZodOptional<z.ZodString>;
        lastFrameUri: z.ZodOptional<z.ZodString>;
        cameraMovement: z.ZodOptional<z.ZodString>;
        motionStrength: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        fps: number;
        cameraPhysics?: {
            pan?: number | undefined;
            tilt?: number | undefined;
            zoom?: number | undefined;
            crane?: number | undefined;
        } | undefined;
        durationSeconds?: number | undefined;
        totalFrames?: number | undefined;
        aspectRatio?: "16:9" | "9:16" | "1:1" | undefined;
        resolution?: "720p" | "1080p" | "4k" | undefined;
        seed?: string | number | undefined;
        firstFrameUri?: string | undefined;
        lastFrameUri?: string | undefined;
        cameraMovement?: string | undefined;
        motionStrength?: number | undefined;
    }, {
        cameraPhysics?: {
            pan?: number | undefined;
            tilt?: number | undefined;
            zoom?: number | undefined;
            crane?: number | undefined;
        } | undefined;
        fps?: number | undefined;
        durationSeconds?: number | undefined;
        totalFrames?: number | undefined;
        aspectRatio?: "16:9" | "9:16" | "1:1" | undefined;
        resolution?: "720p" | "1080p" | "4k" | undefined;
        seed?: string | number | undefined;
        firstFrameUri?: string | undefined;
        lastFrameUri?: string | undefined;
        cameraMovement?: string | undefined;
        motionStrength?: number | undefined;
    }>>;
    personGeneration: z.ZodOptional<z.ZodEnum<["allow_adult", "dont_allow", "allow_all"]>>;
    negativePrompt: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    enhancePrompt: z.ZodOptional<z.ZodBoolean>;
    costEstimate: z.ZodOptional<z.ZodNumber>;
    parentId: z.ZodOptional<z.ZodString>;
    inputManifest: z.ZodOptional<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["first_frame", "last_frame", "ingredient", "character_reference", "whisk_reference"]>;
        uri: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "first_frame" | "last_frame" | "ingredient" | "character_reference" | "whisk_reference";
        uri: string;
    }, {
        role: "first_frame" | "last_frame" | "ingredient" | "character_reference" | "whisk_reference";
        uri: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    durationSeconds: number;
    aspectRatio: "16:9" | "9:16" | "1:1" | "3:4" | "4:3";
    resolution: "720p" | "1080p" | "4k" | "1280x720" | "1920x1080" | "3840x2160";
    model: "lite" | "fast" | "pro";
    costReservationId: string;
    sourceVideoUri?: string | undefined;
    maskFrameUri?: string | undefined;
    maskTrackUri?: string | undefined;
    frameRange?: {
        startFrame: number;
        endFrame: number;
    } | undefined;
    inputManifest?: {
        role: "first_frame" | "last_frame" | "ingredient" | "character_reference" | "whisk_reference";
        uri: string;
    }[] | undefined;
    seed?: string | number | undefined;
    firstFrameUri?: string | undefined;
    lastFrameUri?: string | undefined;
    mode?: "temporal_inpaint" | "video_remix" | undefined;
    directorSettings?: {
        fps: number;
        cameraPhysics?: {
            pan?: number | undefined;
            tilt?: number | undefined;
            zoom?: number | undefined;
            crane?: number | undefined;
        } | undefined;
        durationSeconds?: number | undefined;
        totalFrames?: number | undefined;
        aspectRatio?: "16:9" | "9:16" | "1:1" | undefined;
        resolution?: "720p" | "1080p" | "4k" | undefined;
        seed?: string | number | undefined;
        firstFrameUri?: string | undefined;
        lastFrameUri?: string | undefined;
        cameraMovement?: string | undefined;
        motionStrength?: number | undefined;
    } | undefined;
    costEstimate?: number | undefined;
    referenceUri?: string | undefined;
    referenceUris?: string[] | undefined;
    personGeneration?: "allow_adult" | "dont_allow" | "allow_all" | undefined;
    negativePrompt?: string | undefined;
    enhancePrompt?: boolean | undefined;
    parentId?: string | undefined;
}, {
    prompt: string;
    costReservationId: string;
    sourceVideoUri?: string | undefined;
    maskFrameUri?: string | undefined;
    maskTrackUri?: string | undefined;
    frameRange?: {
        startFrame: number;
        endFrame: number;
    } | undefined;
    inputManifest?: {
        role: "first_frame" | "last_frame" | "ingredient" | "character_reference" | "whisk_reference";
        uri: string;
    }[] | undefined;
    durationSeconds?: number | undefined;
    aspectRatio?: "16:9" | "9:16" | "1:1" | "3:4" | "4:3" | undefined;
    resolution?: "720p" | "1080p" | "4k" | "1280x720" | "1920x1080" | "3840x2160" | undefined;
    seed?: string | number | undefined;
    firstFrameUri?: string | undefined;
    lastFrameUri?: string | undefined;
    mode?: "temporal_inpaint" | "video_remix" | undefined;
    directorSettings?: {
        cameraPhysics?: {
            pan?: number | undefined;
            tilt?: number | undefined;
            zoom?: number | undefined;
            crane?: number | undefined;
        } | undefined;
        fps?: number | undefined;
        durationSeconds?: number | undefined;
        totalFrames?: number | undefined;
        aspectRatio?: "16:9" | "9:16" | "1:1" | undefined;
        resolution?: "720p" | "1080p" | "4k" | undefined;
        seed?: string | number | undefined;
        firstFrameUri?: string | undefined;
        lastFrameUri?: string | undefined;
        cameraMovement?: string | undefined;
        motionStrength?: number | undefined;
    } | undefined;
    model?: "lite" | "fast" | "pro" | undefined;
    costEstimate?: number | undefined;
    referenceUri?: string | undefined;
    referenceUris?: string[] | undefined;
    personGeneration?: "allow_adult" | "dont_allow" | "allow_all" | undefined;
    negativePrompt?: string | undefined;
    enhancePrompt?: boolean | undefined;
    parentId?: string | undefined;
}>;
export declare const OmniVideoTaskSchema: z.ZodEnum<["text_to_video", "image_to_video", "reference_to_video", "edit"]>;
export declare const OmniStoryboardFrameSchema: z.ZodObject<{
    timestamp: z.ZodNumber;
    prompt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    prompt: string;
}, {
    timestamp: number;
    prompt: string;
}>;
export declare const GenerateOmniRemixSchema: z.ZodEffects<z.ZodObject<{
    prompt: z.ZodString;
    task: z.ZodOptional<z.ZodEnum<["text_to_video", "image_to_video", "reference_to_video", "edit"]>>;
    referenceVideoUri: z.ZodOptional<z.ZodString>;
    firstFrameUri: z.ZodOptional<z.ZodString>;
    audioUri: z.ZodOptional<z.ZodString>;
    referenceUris: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    previousInteractionId: z.ZodOptional<z.ZodString>;
    previousJobId: z.ZodOptional<z.ZodString>;
    storyboard: z.ZodOptional<z.ZodArray<z.ZodObject<{
        timestamp: z.ZodNumber;
        prompt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: number;
        prompt: string;
    }, {
        timestamp: number;
        prompt: string;
    }>, "many">>;
    costEstimate: z.ZodOptional<z.ZodNumber>;
    costReservationId: z.ZodOptional<z.ZodString>;
    pipelineMode: z.ZodDefault<z.ZodEnum<["pure-omni", "hybrid-veo"]>>;
    aspectRatio: z.ZodDefault<z.ZodEnum<["16:9", "9:16"]>>;
    durationSeconds: z.ZodDefault<z.ZodNumber>;
    parentId: z.ZodOptional<z.ZodString>;
    posePreservation: z.ZodOptional<z.ZodNumber>;
    beatPulse: z.ZodOptional<z.ZodNumber>;
    characterXRay: z.ZodOptional<z.ZodBoolean>;
    synthIdEnabled: z.ZodOptional<z.ZodBoolean>;
    activePosePreset: z.ZodOptional<z.ZodString>;
    selectedLanguage: z.ZodOptional<z.ZodString>;
    lyricsText: z.ZodOptional<z.ZodString>;
    typographyStyle: z.ZodOptional<z.ZodEnum<["cyberpunk", "kinetic-neon", "liquid-gold", "minimal-infographic"]>>;
    visualizerColor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    durationSeconds: number;
    aspectRatio: "16:9" | "9:16";
    pipelineMode: "pure-omni" | "hybrid-veo";
    firstFrameUri?: string | undefined;
    costEstimate?: number | undefined;
    costReservationId?: string | undefined;
    referenceUris?: string[] | undefined;
    parentId?: string | undefined;
    task?: "text_to_video" | "image_to_video" | "reference_to_video" | "edit" | undefined;
    referenceVideoUri?: string | undefined;
    audioUri?: string | undefined;
    previousInteractionId?: string | undefined;
    previousJobId?: string | undefined;
    storyboard?: {
        timestamp: number;
        prompt: string;
    }[] | undefined;
    posePreservation?: number | undefined;
    beatPulse?: number | undefined;
    characterXRay?: boolean | undefined;
    synthIdEnabled?: boolean | undefined;
    activePosePreset?: string | undefined;
    selectedLanguage?: string | undefined;
    lyricsText?: string | undefined;
    typographyStyle?: "cyberpunk" | "kinetic-neon" | "liquid-gold" | "minimal-infographic" | undefined;
    visualizerColor?: string | undefined;
}, {
    prompt: string;
    durationSeconds?: number | undefined;
    aspectRatio?: "16:9" | "9:16" | undefined;
    firstFrameUri?: string | undefined;
    costEstimate?: number | undefined;
    costReservationId?: string | undefined;
    referenceUris?: string[] | undefined;
    parentId?: string | undefined;
    task?: "text_to_video" | "image_to_video" | "reference_to_video" | "edit" | undefined;
    referenceVideoUri?: string | undefined;
    audioUri?: string | undefined;
    previousInteractionId?: string | undefined;
    previousJobId?: string | undefined;
    storyboard?: {
        timestamp: number;
        prompt: string;
    }[] | undefined;
    pipelineMode?: "pure-omni" | "hybrid-veo" | undefined;
    posePreservation?: number | undefined;
    beatPulse?: number | undefined;
    characterXRay?: boolean | undefined;
    synthIdEnabled?: boolean | undefined;
    activePosePreset?: string | undefined;
    selectedLanguage?: string | undefined;
    lyricsText?: string | undefined;
    typographyStyle?: "cyberpunk" | "kinetic-neon" | "liquid-gold" | "minimal-infographic" | undefined;
    visualizerColor?: string | undefined;
}>, {
    prompt: string;
    durationSeconds: number;
    aspectRatio: "16:9" | "9:16";
    pipelineMode: "pure-omni" | "hybrid-veo";
    firstFrameUri?: string | undefined;
    costEstimate?: number | undefined;
    costReservationId?: string | undefined;
    referenceUris?: string[] | undefined;
    parentId?: string | undefined;
    task?: "text_to_video" | "image_to_video" | "reference_to_video" | "edit" | undefined;
    referenceVideoUri?: string | undefined;
    audioUri?: string | undefined;
    previousInteractionId?: string | undefined;
    previousJobId?: string | undefined;
    storyboard?: {
        timestamp: number;
        prompt: string;
    }[] | undefined;
    posePreservation?: number | undefined;
    beatPulse?: number | undefined;
    characterXRay?: boolean | undefined;
    synthIdEnabled?: boolean | undefined;
    activePosePreset?: string | undefined;
    selectedLanguage?: string | undefined;
    lyricsText?: string | undefined;
    typographyStyle?: "cyberpunk" | "kinetic-neon" | "liquid-gold" | "minimal-infographic" | undefined;
    visualizerColor?: string | undefined;
}, {
    prompt: string;
    durationSeconds?: number | undefined;
    aspectRatio?: "16:9" | "9:16" | undefined;
    firstFrameUri?: string | undefined;
    costEstimate?: number | undefined;
    costReservationId?: string | undefined;
    referenceUris?: string[] | undefined;
    parentId?: string | undefined;
    task?: "text_to_video" | "image_to_video" | "reference_to_video" | "edit" | undefined;
    referenceVideoUri?: string | undefined;
    audioUri?: string | undefined;
    previousInteractionId?: string | undefined;
    previousJobId?: string | undefined;
    storyboard?: {
        timestamp: number;
        prompt: string;
    }[] | undefined;
    pipelineMode?: "pure-omni" | "hybrid-veo" | undefined;
    posePreservation?: number | undefined;
    beatPulse?: number | undefined;
    characterXRay?: boolean | undefined;
    synthIdEnabled?: boolean | undefined;
    activePosePreset?: string | undefined;
    selectedLanguage?: string | undefined;
    lyricsText?: string | undefined;
    typographyStyle?: "cyberpunk" | "kinetic-neon" | "liquid-gold" | "minimal-infographic" | undefined;
    visualizerColor?: string | undefined;
}>;
export declare const TTSVoiceSchema: z.ZodEnum<["Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede", "Autonoe", "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome", "Fenrir", "Gacrux", "Iapetus", "Kore", "Laomedeia", "Leda", "Orus", "Puck", "Pulcherrima", "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel", "Vindemiatrix", "Zephyr", "Zubenelgenubi"]>;
/** Durable single-speaker TTS request. requestId makes callable retries idempotent. */
export declare const GenerateAudioSchema: z.ZodObject<{
    prompt: z.ZodString;
    voice: z.ZodDefault<z.ZodEnum<["Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede", "Autonoe", "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome", "Fenrir", "Gacrux", "Iapetus", "Kore", "Laomedeia", "Leda", "Orus", "Puck", "Pulcherrima", "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar", "Sulafat", "Umbriel", "Vindemiatrix", "Zephyr", "Zubenelgenubi"]>>;
    requestId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    requestId: string;
    prompt: string;
    voice: "Achernar" | "Achird" | "Algenib" | "Algieba" | "Alnilam" | "Aoede" | "Autonoe" | "Callirrhoe" | "Charon" | "Despina" | "Enceladus" | "Erinome" | "Fenrir" | "Gacrux" | "Iapetus" | "Kore" | "Laomedeia" | "Leda" | "Orus" | "Puck" | "Pulcherrima" | "Rasalgethi" | "Sadachbia" | "Sadaltager" | "Schedar" | "Sulafat" | "Umbriel" | "Vindemiatrix" | "Zephyr" | "Zubenelgenubi";
}, {
    requestId: string;
    prompt: string;
    voice?: "Achernar" | "Achird" | "Algenib" | "Algieba" | "Alnilam" | "Aoede" | "Autonoe" | "Callirrhoe" | "Charon" | "Despina" | "Enceladus" | "Erinome" | "Fenrir" | "Gacrux" | "Iapetus" | "Kore" | "Laomedeia" | "Leda" | "Orus" | "Puck" | "Pulcherrima" | "Rasalgethi" | "Sadachbia" | "Sadaltager" | "Schedar" | "Sulafat" | "Umbriel" | "Vindemiatrix" | "Zephyr" | "Zubenelgenubi" | undefined;
}>;
export type BaseMediaRequest = z.infer<typeof BaseMediaRequestSchema>;
export type GenerateImage = z.infer<typeof GenerateImageSchema>;
export type GenerateVideo = z.infer<typeof GenerateVideoSchema>;
export type OmniVideoTask = z.infer<typeof OmniVideoTaskSchema>;
export type GenerateOmniRemix = z.infer<typeof GenerateOmniRemixSchema>;
export type GenerateAudio = z.infer<typeof GenerateAudioSchema>;
//# sourceMappingURL=creative.d.ts.map