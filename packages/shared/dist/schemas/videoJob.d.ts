import { z } from 'zod';
export declare const VideoJobStatusSchema: z.ZodEnum<["PENDING", "QUEUED", "PROCESSING", "STITCHING", "COMPLETED", "FAILED", "CANCELLED", "queued", "processing", "stitching", "completed", "failed", "cancelled"]>;
export declare const VideoJobModeSchema: z.ZodEnum<["text_to_video", "image_to_video", "temporal_inpaint", "video_remix", "long_form", "video"]>;
export declare const VideoJobDirectorPhysicsSchema: z.ZodObject<{
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
}>;
export declare const VideoJobPayloadSchema: z.ZodObject<{
    prompt: z.ZodString;
    sourceVideoUri: z.ZodOptional<z.ZodString>;
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
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    prompt: z.ZodString;
    sourceVideoUri: z.ZodOptional<z.ZodString>;
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
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    prompt: z.ZodString;
    sourceVideoUri: z.ZodOptional<z.ZodString>;
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
}, z.ZodTypeAny, "passthrough">>;
export declare const VideoJobDirectorSettingsSchema: z.ZodObject<{
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
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
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
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
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
}, z.ZodTypeAny, "passthrough">>;
export declare const VideoJobDocumentSchema: z.ZodObject<{
    id: z.ZodString;
    schemaVersion: z.ZodDefault<z.ZodNumber>;
    userId: z.ZodString;
    orgId: z.ZodOptional<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    mode: z.ZodEnum<["text_to_video", "image_to_video", "temporal_inpaint", "video_remix", "long_form", "video"]>;
    status: z.ZodEnum<["PENDING", "QUEUED", "PROCESSING", "STITCHING", "COMPLETED", "FAILED", "CANCELLED", "queued", "processing", "stitching", "completed", "failed", "cancelled"]>;
    progress: z.ZodDefault<z.ZodNumber>;
    prompt: z.ZodOptional<z.ZodString>;
    payload: z.ZodObject<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, z.ZodTypeAny, "passthrough">>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
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
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
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
    }, z.ZodTypeAny, "passthrough">>>;
    inputUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tempUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    persistentUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    maskMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    operationName: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    costEstimate: z.ZodOptional<z.ZodNumber>;
    costReservationId: z.ZodOptional<z.ZodString>;
    actualCost: z.ZodOptional<z.ZodNumber>;
    retryCount: z.ZodDefault<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    updatedAt: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    completedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    cancelledAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    resultUri: z.ZodOptional<z.ZodString>;
    downloadUrl: z.ZodOptional<z.ZodString>;
    videoUrl: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    output: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        url?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        url?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    schemaVersion: z.ZodDefault<z.ZodNumber>;
    userId: z.ZodString;
    orgId: z.ZodOptional<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    mode: z.ZodEnum<["text_to_video", "image_to_video", "temporal_inpaint", "video_remix", "long_form", "video"]>;
    status: z.ZodEnum<["PENDING", "QUEUED", "PROCESSING", "STITCHING", "COMPLETED", "FAILED", "CANCELLED", "queued", "processing", "stitching", "completed", "failed", "cancelled"]>;
    progress: z.ZodDefault<z.ZodNumber>;
    prompt: z.ZodOptional<z.ZodString>;
    payload: z.ZodObject<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, z.ZodTypeAny, "passthrough">>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
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
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
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
    }, z.ZodTypeAny, "passthrough">>>;
    inputUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tempUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    persistentUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    maskMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    operationName: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    costEstimate: z.ZodOptional<z.ZodNumber>;
    costReservationId: z.ZodOptional<z.ZodString>;
    actualCost: z.ZodOptional<z.ZodNumber>;
    retryCount: z.ZodDefault<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    updatedAt: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    completedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    cancelledAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    resultUri: z.ZodOptional<z.ZodString>;
    downloadUrl: z.ZodOptional<z.ZodString>;
    videoUrl: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    output: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        url?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        url?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    schemaVersion: z.ZodDefault<z.ZodNumber>;
    userId: z.ZodString;
    orgId: z.ZodOptional<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    mode: z.ZodEnum<["text_to_video", "image_to_video", "temporal_inpaint", "video_remix", "long_form", "video"]>;
    status: z.ZodEnum<["PENDING", "QUEUED", "PROCESSING", "STITCHING", "COMPLETED", "FAILED", "CANCELLED", "queued", "processing", "stitching", "completed", "failed", "cancelled"]>;
    progress: z.ZodDefault<z.ZodNumber>;
    prompt: z.ZodOptional<z.ZodString>;
    payload: z.ZodObject<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        prompt: z.ZodString;
        sourceVideoUri: z.ZodOptional<z.ZodString>;
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
    }, z.ZodTypeAny, "passthrough">>;
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
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
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
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
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
    }, z.ZodTypeAny, "passthrough">>>;
    inputUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tempUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    persistentUris: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    maskMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    operationName: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    costEstimate: z.ZodOptional<z.ZodNumber>;
    costReservationId: z.ZodOptional<z.ZodString>;
    actualCost: z.ZodOptional<z.ZodNumber>;
    retryCount: z.ZodDefault<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    updatedAt: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    completedAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    cancelledAt: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    resultUri: z.ZodOptional<z.ZodString>;
    downloadUrl: z.ZodOptional<z.ZodString>;
    videoUrl: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    output: z.ZodOptional<z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        url?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        url?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.ZodTypeAny, "passthrough">>;
export type VideoJobDocument = z.infer<typeof VideoJobDocumentSchema>;
//# sourceMappingURL=videoJob.d.ts.map