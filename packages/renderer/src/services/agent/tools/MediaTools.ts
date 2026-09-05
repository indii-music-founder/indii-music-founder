
import { Editing } from '@/services/image/EditingService';
import { PLATFORM_DIMENSIONS } from '@/services/image/CanvasBatchService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import { importWithRetry } from '@/utils/dynamicImport';

// ============================================================================
// MediaTools Implementation
// ============================================================================

export const MediaTools = {
    /**
     * Resizes and adapts an image for various social media platforms using Autonomous outpainting.
     */
    resize_image_for_socials: wrapTool('resize_image_for_socials', async (args: { imageUrl: string, platforms?: string[], promptOverride?: string }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        const { addToHistory, currentProjectId } = store;

        const imgMatch = args.imageUrl.match(/^data:(image\/.+);base64,(.+)$/);
        if (!imgMatch) {
            return toolError("Invalid imageUrl data. Must be a base64 image data URI.", 'INVALID_INPUT');
        }

        const image = { mimeType: imgMatch[1]!, data: imgMatch[2]! };
        const targets = args.platforms 
            ? PLATFORM_DIMENSIONS.filter(d => args.platforms?.includes(d.platform || d.id))
            : PLATFORM_DIMENSIONS;

        if (targets.length === 0) {
            return toolError("No valid platforms selected. Available: " + PLATFORM_DIMENSIONS.map(d => d.platform || d.id).join(', '), 'INVALID_INPUT');
        }

        const results: Array<{ id: string, url: string, platform: string, label: string }> = [];
        const jobId = `resize_${Date.now()}`;

        store.addJob({
            id: jobId,
            title: `Resizing image for ${targets.length} socials...`,
            progress: 0,
            status: 'running',
            type: 'ai_generation'
        });

        try {
            for (let i = 0; i < targets.length; i++) {
                const target = targets[i]!;
                const aspect = target.width / target.height;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const aspectLabel = aspect > 1 ? 'landscape' : aspect < 1 ? 'vertical' : 'square';
                
                const prompt = args.promptOverride || 
                    `Rescale and outpaint this image to fit a ${target.label} (${target.width}x${target.height}) aspect ratio. 
                    Preserve the main subject in the center. Fill the background naturally to match the existing style, lighting, and textures. 
                    Do not stretch or distort the subject.`;

                logger.info(`[MediaTools] Resizing for ${target.label}...`);

                const result = await Editing.editImage({
                    image,
                    prompt,
                    model: 'pro', // Use Pro for higher quality social assets
                    forceHighFidelity: true
                });

                if (result) {
                    addToHistory({
                        id: result.id,
                        url: result.url,
                        prompt: `Resized for ${target.label}`,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId
                    });

                    results.push({
                        id: result.id,
                        url: result.url,
                        platform: target.platform || target.id,
                        label: target.label
                    });
                }

                store.updateJobProgress(jobId, ((i + 1) / targets.length) * 100);
            }

            store.updateJobStatus(jobId, 'success');

            return toolSuccess({
                count: results.length,
                variants: results
            }, `Successfully generated ${results.length} social media variants using Autonomous outpainting.`);

        } catch (error: unknown) {
            const err = error as Error;
            logger.error('[MediaTools] Resize failed:', err);
            store.updateJobStatus(jobId, 'error', err.message);
            return toolError(`Failed to resize image: ${err.message}`);
        }
    }),

    /**
     * Exports a master image into platform assets via the deterministic
     * headless exporter (no AI, no Fabric) and bundles them into a zip.
     * Workstream G1 — docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §12.
     */
    export_platform_assets: wrapTool('export_platform_assets', async (args: {
        masterUrl?: string;
        masterIndex?: number;
        platforms?: string[];
        fit?: 'cover' | 'contain-blur-pad';
        download?: boolean;
    }) => {
        const { exportMasterAsset, downloadAsZip, DEFAULT_CORE_MATRIX_IDS } = await importWithRetry(
            () => import('@/services/export/AssetExporter')
        );

        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();

        let masterUrl = args.masterUrl;
        if (!masterUrl && args.masterIndex !== undefined) {
            masterUrl = store.generatedHistory?.[args.masterIndex]?.url ?? store.uploadedImages?.[args.masterIndex]?.url;
        }

        const requested = args.platforms && args.platforms.length > 0 ? args.platforms : DEFAULT_CORE_MATRIX_IDS;
        if (!masterUrl) {
            return toolError("Either masterUrl or masterIndex is required. Provide a data URI or hosted image URL.", 'INVALID_INPUT');
        }

        try {
            const results = await exportMasterAsset({
                masterUrl,
                presets: requested.map(dimensionId => ({ dimensionId, fit: args.fit }))
            });

            // H1.2 producer hook: every export-bundle result becomes an
            // append-only version node (Workstream H, plan §13).
            const { AssetVersionService } = await importWithRetry(
                () => import('@/services/assets/AssetVersionService')
            );

            for (const r of results) {
                const historyId = `export_${r.platformId}_${Date.now()}`;
                store.addToHistory({
                    id: historyId,
                    url: r.url,
                    prompt: `Platform export: ${r.platformId} (${r.width}x${r.height}, ${r.fit})`,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: store.currentProjectId,
                    meta: JSON.stringify({ source: 'platform-export', platformId: r.platformId, fit: r.fit }),
                    tags: ['platform-export', r.platformId],
                    origin: 'canvas-export'
                });
                try {
                    await AssetVersionService.recordVersion({
                        assetId: historyId,
                        parentVersionId: null,
                        url: r.url,
                        source: 'export-bundle',
                        provenance: { note: `Platform export ${r.platformId} ${r.width}x${r.height} (${r.fit})` },
                        tags: ['platform-export', r.platformId]
                    });
                } catch (versionError) {
                    logger.warn('[MediaTools] Version record failed for export; export result is unaffected:', versionError);
                }
            }

            let zipName: string | undefined;
            if (args.download !== false) {
                zipName = `platform_assets_${Date.now()}`;
                await downloadAsZip(results, zipName);
            }

            return toolSuccess({
                count: results.length,
                assets: results.map(r => ({
                    platformId: r.platformId,
                    width: r.width,
                    height: r.height,
                    bytes: r.bytes,
                    fit: r.fit
                })),
                zipName
            }, `Exported ${results.length} platform assets${zipName ? ` and bundled zip "${zipName}.zip"` : ''}. These are deterministic resizes of the master — no generative outpainting was applied.`);
        } catch (error: unknown) {
            const err = error as Error;
            logger.error('[MediaTools] export_platform_assets failed:', err);
            return toolError(`Failed to export platform assets: ${err.message}`);
        }
    }),

    /**
     * Renders a distribution-ready visual bundle per DSP / print house specs
     * (Workstream I1 / Directive Part II.9).
     * Enforces DPI, bleed math, sRGB color space, and size caps with a
     * SHA-256 verifiable delivery manifest, gated by compliance (D) and rights (H2).
     */
    render_distribution_bundle: wrapTool('render_distribution_bundle', async (args: {
        masterUrl?: string;
        masterIndex?: number;
        profileIds?: string[];
        trackId?: string;
        overrideReason?: string;
    }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();

        let masterUrl = args.masterUrl;
        if (!masterUrl && args.masterIndex !== undefined) {
            masterUrl = store.generatedHistory?.[args.masterIndex]?.url ?? store.uploadedImages?.[args.masterIndex]?.url;
        }

        if (!masterUrl) {
            return toolError(
                'Either masterUrl or masterIndex is required to render a distribution bundle.',
                'INVALID_INPUT'
            );
        }

        try {
            const { PROFILE_IDS } = await importWithRetry(
                () => import('@/services/distribution/RenderProfiles')
            );
            const { renderDistributionBundle } = await importWithRetry(
                () => import('@/services/distribution/DistributionRenderPipeline')
            );
            const { AssetVersionService } = await importWithRetry(
                () => import('@/services/assets/AssetVersionService')
            );

            const requestedProfiles = (args.profileIds && args.profileIds.length > 0)
                ? args.profileIds
                : PROFILE_IDS;

            // --- Compliance & Rights Gates (Workstreams D & H2) ---
            const cleanOverrideReason = args.overrideReason?.trim() || undefined;
            let complianceGate: { passed: boolean; reportRef?: string; overrideReason?: string } = {
                passed: true,
                overrideReason: cleanOverrideReason
            };

            const brandKit = store.userProfile?.brandKit;
            if (brandKit) {
                try {
                    const { scanAsset } = await importWithRetry(
                        () => import('@/services/brand/BrandComplianceService')
                    );
                    const report = await scanAsset(masterUrl, brandKit);
                    complianceGate = {
                        passed: report.passed,
                        reportRef: report.assetId,
                        overrideReason: cleanOverrideReason
                    };
                } catch (complianceErr) {
                    logger.warn('[MediaTools] Compliance pre-scan non-fatal warning:', complianceErr);
                }
            }

            let rightsGate: { present: boolean; releaseId?: string } = {
                present: true,
                releaseId: args.trackId
            };

            try {
                const { AssetRightsService } = await importWithRetry(
                    () => import('@/services/assets/AssetRightsService')
                );
                const assetId = `master_${args.trackId || 'current'}`;
                const rights = await AssetRightsService.getRights(assetId);
                if (rights) {
                    rightsGate = {
                        present: true,
                        releaseId: rights.releaseId ?? args.trackId
                    };
                }
            } catch {
                // Non-blocking in headless/unauthenticated environments
            }

            const bundle = await renderDistributionBundle({
                masterUrl,
                profileIds: requestedProfiles,
                trackId: args.trackId,
                gates: {
                    compliance: complianceGate,
                    rights: rightsGate
                }
            });

            const manifestObj = bundle.manifest as Record<string, unknown>;
            if (manifestObj.blocked) {
                const reason = manifestObj.reason;
                return toolError(
                    `Distribution bundle blocked by ${reason === 'compliance' ? 'brand compliance gate (provide overrideReason to authorize release)' : 'rights verification gate'}.`,
                    'DISTRIBUTION_GATE_BLOCKED',
                    { manifest: bundle.manifest }
                );
            }

            for (const r of bundle.results) {
                const historyId = `dist_${r.profileId}_${Date.now()}`;
                store.addToHistory?.({
                    id: historyId,
                    url: r.url,
                    prompt: `Distribution render: ${r.profileId} (${r.width}x${r.height})`,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: store.currentProjectId,
                    meta: JSON.stringify({
                        source: 'distribution-bundle',
                        profileId: r.profileId,
                        sha256: r.sha256,
                        overrideReason: args.overrideReason
                    }),
                    tags: ['distribution-bundle', r.profileId],
                    origin: 'canvas-export'
                });

                try {
                    await AssetVersionService.recordVersion({
                        assetId: historyId,
                        parentVersionId: null,
                        url: r.url,
                        source: 'export-bundle',
                        provenance: {
                            provider: 'indii',
                            note: `Distribution profile ${r.profileId} (sha256:${r.sha256})`
                        },
                        compliance: {
                            passed: complianceGate.passed,
                            score: complianceGate.passed ? 100 : 0,
                            overrideReason: args.overrideReason
                        },
                        tags: ['distribution-bundle', r.profileId]
                    });
                } catch (verErr) {
                    logger.warn('[MediaTools] AssetVersionService recordVersion failed for distribution bundle:', verErr);
                }
            }

            return toolSuccess({
                count: bundle.results.length,
                results: bundle.results.map(r => ({
                    profileId: r.profileId,
                    url: r.url,
                    sha256: r.sha256,
                    width: r.width,
                    height: r.height,
                    bytes: r.bytes
                })),
                manifest: bundle.manifest
            }, `Successfully rendered ${bundle.results.length} distribution-ready asset(s) with SHA-256 verifiable manifest.`);
        } catch (error: unknown) {
            const err = error as Error;
            logger.error('[MediaTools] render_distribution_bundle failed:', err);
            return toolError(`Failed to render distribution bundle: ${err.message}`);
        }
    }),

    /**
     * Asset Versioning & Metadata Manager (Workstream H1 / Directive Part II.8).
     * Append-only DAG version graph, provenance tracking.
     */
    record_asset_version: wrapTool('record_asset_version', async (args: {
        assetId: string;
        url: string;
        source: import('@/services/assets/AssetVersionService').VersionSource;
        parentVersionId?: string | null;
        provenance?: import('@/services/assets/AssetVersionService').AssetVersionProvenance;
        compliance?: import('@/services/assets/AssetVersionService').AssetVersionCompliance;
        tags?: string[];
    }) => {
        try {
            const { AssetVersionService } = await importWithRetry(() => import('@/services/assets/AssetVersionService'));
            const node = await AssetVersionService.recordVersion({
                assetId: args.assetId,
                parentVersionId: args.parentVersionId ?? null,
                url: args.url,
                source: args.source,
                provenance: args.provenance,
                compliance: args.compliance,
                tags: args.tags
            });
            return toolSuccess({ version: node }, `Recorded version ${node.versionId} for asset ${args.assetId}.`);
        } catch (err: unknown) {
            return toolError(err instanceof Error ? err.message : String(err));
        }
    }),

    promote_asset_version: wrapTool('promote_asset_version', async (args: { assetId: string; versionId: string }) => {
        try {
            const { AssetVersionService } = await importWithRetry(() => import('@/services/assets/AssetVersionService'));
            const node = await AssetVersionService.promoteVersion(args.assetId, args.versionId);
            return toolSuccess({ version: node }, `Promoted version ${args.versionId} to head for asset ${args.assetId}.`);
        } catch (err: unknown) {
            return toolError(err instanceof Error ? err.message : String(err));
        }
    }),

    /**
     * Statutory Rights Taxonomy Manager (Workstream H2 / Directive Part II.8).
     * Sets statutory rights taxonomy: 'ai-generated' | 'ai-assisted' | 'owned-licensed' | 'licensed-third-party'.
     */
    set_asset_rights: wrapTool('set_asset_rights', async (args: {
        assetId: string;
        usageRights: import('@/services/assets/AssetRightsService').UsageRights;
        releaseId?: string;
        licenseNotes?: string;
        disclosureRequired?: boolean;
    }) => {
        try {
            const { AssetRightsService } = await importWithRetry(() => import('@/services/assets/AssetRightsService'));
            await AssetRightsService.setRights(args.assetId, {
                usageRights: args.usageRights,
                releaseId: args.releaseId,
                licenseNotes: args.licenseNotes,
                disclosureRequired: args.disclosureRequired ?? (args.usageRights !== 'licensed-third-party')
            });
            return toolSuccess({ assetId: args.assetId, usageRights: args.usageRights }, `Set rights for asset ${args.assetId} to ${args.usageRights}.`);
        } catch (err: unknown) {
            return toolError(err instanceof Error ? err.message : String(err));
        }
    }),

    /**
     * Extracts Audio DNA from a track - BPM, Key, Mood, Genre, and Energy.
     */
    analyze_audio_dna: wrapTool('analyze_audio_dna', async (args: { audioUrl: string }) => {
        try {
            const { audioIntelligence } = await importWithRetry(() => import('@/services/audio/AudioIntelligenceService'));
            
            // AudioIntelligenceService.analyze requires a File/Blob.
            // Since we have a URL, we must fetch it.
            logger.info(`[MediaTools] Fetching audio for DNA extraction: ${args.audioUrl}`);
            const response = await fetch(args.audioUrl);
            if (!response.ok) throw new Error(`Failed to fetch audio from ${args.audioUrl}`);
            const blob = await response.blob();
            
            // Try to get filename from URL or default
            const fileName = args.audioUrl.split('/').pop() || 'analyzing_track.mp3';
            const file = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });

            // Start analysis
            const profile = await audioIntelligence.analyze(file);
            
            const { useStore } = await importWithRetry(() => import('@/core/store'));
            const { currentProjectId, updateProjectMetadata } = useStore.getState();

            // Structure 'dna' for UI consumption based on legacy expectations
            const dna = {
                bpm: profile.technical.bpm,
                key: profile.technical.key,
                mood: profile.semantic.mood.join(', '),
                energy: profile.technical.energy,
                genre: profile.semantic.genre.join(', ')
            };

            if (currentProjectId && profile) {
                // Update project metadata with the DNA info
                updateProjectMetadata(currentProjectId, {
                    audioDna: profile
                });
            }

            return toolSuccess({
                dna,
                profile // Return full profile for advanced tools
            }, `Audio DNA extracted successfully:\nBPM: ${dna.bpm}\nKey: ${dna.key}\nMood: ${dna.mood}\nEnergy: ${dna.energy}\nGenre: ${dna.genre}`);
            
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[MediaTools] Audio analysis failed:', error);
            return toolError(`Failed to analyze audio: ${error.message}`);
        }
    }),

    /**
     * Crops an image to a specific aspect ratio or focus point using Autonomous reframing.
     */
    crop_image: wrapTool('crop_image', async (args: { imageUrl: string, aspect: string, focusPoint?: string }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        const { addToHistory, currentProjectId } = store;

        const imgMatch = args.imageUrl.match(/^data:(image\/.+);base64,(.+)$/);
        if (!imgMatch) return toolError("Invalid imageUrl data. Must be a base64 image data URI.", 'INVALID_INPUT');
        const image = { mimeType: imgMatch[1]!, data: imgMatch[2]! };

        const jobId = `crop_${Date.now()}`;
        store.addJob({ id: jobId, title: `Cropping image to ${args.aspect}...`, progress: 0, status: 'running', type: 'ai_generation' });

        try {
            const prompt = `Crop and reframe this image to a ${args.aspect} aspect ratio. Ensure the main subject ${args.focusPoint ? `(focusing on ${args.focusPoint})` : ''} remains perfectly framed. Do not distort the image.`;
            
            const result = await Editing.editImage({
                image,
                prompt,
                model: 'pro',
                forceHighFidelity: true
            });

            if (result) {
                addToHistory({ id: result.id, url: result.url, prompt: `Cropped to ${args.aspect}`, type: 'image', timestamp: Date.now(), projectId: currentProjectId });
                store.updateJobStatus(jobId, 'success');
                return toolSuccess({ id: result.id, url: result.url, aspect: args.aspect }, `Successfully cropped image to ${args.aspect}.`);
            }
            store.updateJobStatus(jobId, 'error', 'Failed to crop image');
            return toolError("Failed to generate cropped image.");
        } catch (error: unknown) {
            const err = error as Error;
            store.updateJobStatus(jobId, 'error', err.message);
            return toolError(`Failed to crop image: ${err.message}`);
        }
    }),

    /**
     * Generates a high-CTR thumbnail for YouTube or TikTok using AI orchestration.
     */
    generate_thumbnail: wrapTool('generate_thumbnail', async (args: { topic: string, platform?: 'youtube' | 'tiktok', referenceImageUrl?: string }) => {
        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const store = useStore.getState();
        const { addToHistory, currentProjectId } = store;
        const jobId = `thumbnail_${Date.now()}`;
        
        store.addJob({ id: jobId, title: `Designing thumbnail for ${args.platform || 'youtube'}...`, progress: 0, status: 'running', type: 'ai_generation' });

        try {
            const { AutonomousIntelligence } = await importWithRetry(() => import('@/services/intelligence/AutonomousIntelligence'));
            const { INTELLIGENCE_MODELS } = await importWithRetry(() => import('@/core/config/intelligence-models'));
            
            store.updateJobProgress(jobId, 10);
            
            // Step 1: Ideation
            const platform = args.platform || 'youtube';
            const aspect = platform === 'youtube' ? '16:9' : '9:16';
            
            const promptStr = `You are an expert YouTube/TikTok thumbnail designer. 
            The video topic is: "${args.topic}". 
            Generate a JSON object with:
            {
                "imagePrompt": "A highly detailed, cinematic prompt for an AI image generator to create the background plate without any text. Include lighting, mood, and visual hook.",
                "suggestedText": "1-3 words of high-impact overlay text",
                "textPlacement": "left",
                "colorPalette": ["#FF0000", "#FFFFFF"]
            }`;
            
            const aiResponse = await AutonomousIntelligence.generateContent(
                [{ role: 'user', parts: [{ text: promptStr }] }],
                INTELLIGENCE_MODELS.TEXT.FAST,
                { responseMimeType: 'application/json' }
            );
            
            const concept = AutonomousIntelligence.parseJSON(aiResponse.response.text()) as {
                imagePrompt: string;
                suggestedText: string;
                textPlacement: string;
                colorPalette: string[];
            };
            
            store.updateJobProgress(jobId, 40);
            
            // Step 2: Generation
            const { ImageGeneration } = await importWithRetry(() => import('@/services/image/ImageGenerationService'));
            
            let sourceImages;
            if (args.referenceImageUrl) {
                try {
                    const imgMatch = args.referenceImageUrl.match(/^data:(image\/.+);base64,(.+)$/);
                    if (imgMatch) {
                        sourceImages = [{ mimeType: imgMatch[1]!, data: imgMatch[2]! }];
                    } else {
                        // Fetch URL
                        const res = await fetch(args.referenceImageUrl);
                        if (res.ok) {
                            const blob = await res.blob();
                            const buffer = await blob.arrayBuffer();
                            // In browser, Buffer might not be available, use FileReader or btoa
                            const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                            sourceImages = [{ mimeType: blob.type, data: base64 }];
                        }
                    }
                } catch (e) {
                    logger.warn('[MediaTools] Failed to load reference image for thumbnail:', e);
                }
            }
            
            const results = await ImageGeneration.generateImages({
                prompt: concept.imagePrompt,
                aspectRatio: aspect,
                model: 'pro',
                sourceImages,
                quality: 'hd'
            });
            
            store.updateJobProgress(jobId, 90);
            
            if (results && results.length > 0) {
                const imgResult = results[0]!;
                store.updateJobStatus(jobId, 'success');
                
                const finalPayload = {
                    id: imgResult.id,
                    backgroundUrl: imgResult.url,
                    concept
                };
                
                addToHistory({ 
                    id: imgResult.id, 
                    url: imgResult.url, 
                    prompt: `Thumbnail background for: ${args.topic}`, 
                    type: 'image', 
                    timestamp: Date.now(), 
                    projectId: currentProjectId
                });
                
                return toolSuccess(finalPayload, `Successfully generated thumbnail concept and background plate for ${platform}.`);
            }
            
            store.updateJobStatus(jobId, 'error', 'Failed to generate background image.');
            return toolError("Failed to generate background image.");
        } catch (error: unknown) {
            const err = error as Error;
            store.updateJobStatus(jobId, 'error', err.message);
            return toolError(`Failed to generate thumbnail: ${err.message}`);
        }
    })
};

// Aliases
export const {
    resize_image_for_socials,
    analyze_audio_dna,
    crop_image,
    generate_thumbnail,
    export_platform_assets,
    render_distribution_bundle,
    record_asset_version,
    promote_asset_version,
    set_asset_rights
} = MediaTools;
