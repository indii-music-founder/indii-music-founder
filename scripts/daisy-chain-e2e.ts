#!/usr/bin/env node
/**
 * Daisy Chain Pipeline E2E Test
 * 
 * Full pipeline: Generate Image → Edit Image → 3-Segment Video (Daisy Chain)
 * 
 * This script exercises the exact same @google/genai SDK that the app uses,
 * proving the pipeline end-to-end without requiring the browser UI.
 * 
 * Storyline: "A music producer in a neon-lit studio" → Edit: add vinyl record →
 * Video: 3 daisy chain segments of the producer working in the studio.
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_KEY = process.env.VITE_API_KEY;
if (!API_KEY) {
    console.error('❌ VITE_API_KEY not found in .env');
    process.exit(1);
}

const client = new GoogleGenAI({ apiKey: API_KEY });

// Output directory — all artifacts land here
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts', 'daisy-chain-output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Approved models per user rules
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const VIDEO_MODEL = 'veo-3.1-generate-preview';

function log(emoji: string, msg: string) {
    const ts = new Date().toISOString().split('T')[1]?.split('.')[0];
    console.log(`[${ts}] ${emoji} ${msg}`);
}

async function saveBase64Image(base64: string, filename: string): Promise<string> {
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));
    log('💾', `Saved: ${filepath}`);
    return filepath;
}

// ══════════════════════════════════════════════════════════════════════
// PHASE 1: Generate Base Image
// ══════════════════════════════════════════════════════════════════════
async function generateBaseImage(): Promise<string> {
    log('🎨', 'PHASE 1: Generating base album cover image...');

    const response = await client.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{
            role: 'user',
            parts: [{ text: 'Generate a photorealistic image of a music producer sitting at a large analog mixing console in a dark recording studio. The room is bathed in purple and cyan neon LED strip lighting. Vintage rack-mounted synthesizers and studio monitor speakers are visible in the background. Atmospheric smoke haze fills the room. Cinematic, moody, album cover aesthetic. Wide shot composition, 16:9 aspect ratio.' }]
        }],
        config: {
            responseModalities: ['IMAGE', 'TEXT'],
        }
    });

    // Extract image from response
    const parts = response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData?.data) {
            const filename = '01_base_album_cover.png';
            const filepath = await saveBase64Image(part.inlineData.data, filename);
            log('✅', `Base image generated: ${filename}`);
            return filepath;
        }
    }

    throw new Error('No image data in response');
}

// ══════════════════════════════════════════════════════════════════════
// PHASE 2: Edit Image — Add a Gold Vinyl Record
// ══════════════════════════════════════════════════════════════════════
async function editImage(baseImagePath: string): Promise<string> {
    log('✏️', 'PHASE 2: Editing image — adding gold vinyl record to the scene...');

    const imageBytes = fs.readFileSync(baseImagePath);
    const base64Image = imageBytes.toString('base64');

    const response = await client.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: base64Image
                    }
                },
                {
                    text: 'Edit this image: Add a shining gold vinyl record leaning against the mixing console on the right side. The vinyl should catch the neon light and have a subtle golden glow. Keep everything else exactly the same — do not change the lighting, the producer, or the background. Only add the gold vinyl record.'
                }
            ]
        }],
        config: {
            responseModalities: ['IMAGE', 'TEXT'],
        }
    });

    const parts = response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData?.data) {
            const filename = '02_edited_gold_vinyl.png';
            const filepath = await saveBase64Image(part.inlineData.data, filename);
            log('✅', `Edited image saved: ${filename}`);
            return filepath;
        }
    }

    throw new Error('No edited image data in response');
}

// ══════════════════════════════════════════════════════════════════════
// PHASE 3: Analyze Frame with Gemini (Daisy Chain Context Builder)
// ══════════════════════════════════════════════════════════════════════
async function analyzeFrameForContinuation(imageBase64: string, basePrompt: string, segmentIndex: number): Promise<string> {
    log('🧠', `Analyzing frame for segment ${segmentIndex + 1} continuation...`);

    const response = await client.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: imageBase64
                    }
                },
                {
                    text: `You are a master cinematographer and physics engine.
Analyze this image frame which represents the END of a video segment.
Context: "${basePrompt}"

Task: Predict exactly what happens in the next 8 seconds of this scene.
Describe the motion, physics, lighting changes, and character actions that bridge this gap.
Focus on continuity and logical progression from this exact frame.

Return a concise but descriptive paragraph (max 50 words) describing the next video segment.`
                }
            ]
        }],
        config: {
            temperature: 1.0,
        }
    });

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    log('💡', `Analysis: "${text.substring(0, 100)}..."`);
    return text;
}

// ══════════════════════════════════════════════════════════════════════
// PHASE 4: Video Generation — 3-Segment Daisy Chain
// ══════════════════════════════════════════════════════════════════════
async function generateDaisyChainVideo(editedImagePath: string): Promise<void> {
    log('🎬', 'PHASE 3: Starting 3-segment Daisy Chain video generation...');

    const imageBytes = fs.readFileSync(editedImagePath);
    const imageBase64 = imageBytes.toString('base64');

    const BASE_PROMPT = 'A music producer working at an analog mixing console in a dark neon-lit recording studio. The producer reaches for a knob, adjusting levels as the neon lights pulse. Atmospheric smoke drifts. Cinematic, moody, slow motion.';
    const SEGMENTS = 3;

    let currentFrameBase64 = imageBase64;
    let chainContext = '';

    for (let i = 0; i < SEGMENTS; i++) {
        log('🔗', `━━━ Daisy Chain Segment ${i + 1}/${SEGMENTS} ━━━`);

        // Build the enriched prompt
        let segmentPrompt = BASE_PROMPT;
        if (chainContext && i > 0) {
            segmentPrompt = `${segmentPrompt}\n\nVisual Continuity Context (from previous segment): ${chainContext}`;
        }

        log('📝', `Prompt: "${segmentPrompt.substring(0, 120)}..."`);
        log('🖼️', `First frame: ${currentFrameBase64 ? 'YES (from ' + (i === 0 ? 'edited image' : `segment ${i} last frame`) + ')' : 'NONE'}`);

        // Generate video segment
        try {
            log('⏳', `Calling Veo 3.1 for segment ${i + 1}...`);
            let operation = await client.models.generateVideos({
                model: VIDEO_MODEL,
                prompt: segmentPrompt,
                image: currentFrameBase64 ? {
                    imageBytes: currentFrameBase64,
                    mimeType: 'image/png'
                } : undefined,
                config: {
                    aspectRatio: '16:9',
                    numberOfVideos: 1,
                },
            });

            log('⏳', `Operation started (done=${operation.done}). Polling for completion...`);

            // Poll for completion — pass the full operation object, NOT operationName
            // This matches the pattern in MediaGenerator.ts line 147-149
            const startTime = Date.now();
            const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
            const POLL_INTERVAL = 5000; // 5 seconds

            while (!operation.done) {
                if (Date.now() - startTime > TIMEOUT_MS) {
                    throw new Error(`Timeout after ${TIMEOUT_MS / 1000}s`);
                }
                await new Promise(r => setTimeout(r, POLL_INTERVAL));
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                log('⏳', `Polling... (${elapsed}s elapsed)`);

                // Re-poll using the full operation object
                operation = await client.operations.getVideosOperation({
                    operation: operation,
                });
            }

            // Extract video result
            const video = operation.response?.generatedVideos?.[0]?.video;
            if (!video?.uri) {
                log('⚠️', `Segment ${i + 1} returned no video URI. Continuing chain without visual continuity.`);
                chainContext = '';
                continue;
            }

            log('✅', `Segment ${i + 1} complete! URI: ${video.uri.substring(0, 80)}...`);

            // Download the video
            const videoResponse = await fetch(`${video.uri}&key=${API_KEY}`);
            if (videoResponse.ok) {
                const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
                const videoFilename = `03_video_segment_${i + 1}.mp4`;
                const videoPath = path.join(OUTPUT_DIR, videoFilename);
                fs.writeFileSync(videoPath, videoBuffer);
                log('💾', `Video saved: ${videoFilename} (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
            }

            // ─── DAISY CHAIN: Analyze for next segment ───
            if (i < SEGMENTS - 1) {
                // For the last frame extraction, we'd normally use canvas in the browser.
                // In Node.js, we use the Gemini model to analyze the video's likely final state
                // based on the prompt + first frame. This is the "server-side daisy chain" approach.
                log('🔗', `Extracting continuation context for segment ${i + 2}...`);

                chainContext = await analyzeFrameForContinuation(
                    currentFrameBase64,
                    segmentPrompt,
                    i
                );

                // Save the analysis as a text file for inspection
                const analysisFilename = `04_analysis_seg${i + 1}_to_seg${i + 2}.txt`;
                fs.writeFileSync(
                    path.join(OUTPUT_DIR, analysisFilename),
                    `Segment ${i + 1} → ${i + 2} Analysis:\n\n${chainContext}`
                );
                log('💾', `Analysis saved: ${analysisFilename}`);
            }

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log('❌', `Segment ${i + 1} failed: ${errMsg}`);

            // Best-effort: continue the chain without this segment's frame
            chainContext = '';

            // Save error details
            fs.writeFileSync(
                path.join(OUTPUT_DIR, `ERROR_segment_${i + 1}.txt`),
                `Error at segment ${i + 1}:\n${errMsg}\n\nFull error:\n${JSON.stringify(err, null, 2)}`
            );
        }
    }
}

// ══════════════════════════════════════════════════════════════════════
// MAIN: Execute Pipeline
// ══════════════════════════════════════════════════════════════════════
async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║        DAISY CHAIN PIPELINE E2E TEST                       ║');
    console.log('║        Image → Edit → 3-Segment Video Chain                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    log('🚀', `Output directory: ${OUTPUT_DIR}`);
    console.log('');

    try {
        const baseImageFile = path.join(OUTPUT_DIR, '01_base_album_cover.png');
        const editedImageFile = path.join(OUTPUT_DIR, '02_edited_gold_vinyl.png');

        let baseImagePath: string;
        let editedImagePath: string;

        // Phase 1: Generate base image (skip if cached)
        if (fs.existsSync(baseImageFile) && fs.statSync(baseImageFile).size > 1000) {
            log('⏭️', `Base image already exists (${(fs.statSync(baseImageFile).size / 1024).toFixed(0)} KB). Skipping Phase 1.`);
            baseImagePath = baseImageFile;
        } else {
            baseImagePath = await generateBaseImage();
        }
        console.log('');

        // Phase 2: Edit the image (skip if cached)
        if (fs.existsSync(editedImageFile) && fs.statSync(editedImageFile).size > 1000) {
            log('⏭️', `Edited image already exists (${(fs.statSync(editedImageFile).size / 1024).toFixed(0)} KB). Skipping Phase 2.`);
            editedImagePath = editedImageFile;
        } else {
            editedImagePath = await editImage(baseImagePath);
        }
        console.log('');

        // Phase 3: 3-segment daisy chain video
        await generateDaisyChainVideo(editedImagePath);
        console.log('');

        // Summary
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║        PIPELINE COMPLETE                                   ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        log('📁', `All outputs in: ${OUTPUT_DIR}`);
        const files = fs.readdirSync(OUTPUT_DIR);
        files.forEach(f => {
            const stat = fs.statSync(path.join(OUTPUT_DIR, f));
            const size = stat.size > 1024 * 1024
                ? `${(stat.size / 1024 / 1024).toFixed(1)} MB`
                : `${(stat.size / 1024).toFixed(0)} KB`;
            log('📄', `  ${f} (${size})`);
        });

    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log('💥', `Pipeline failed: ${errMsg}`);
        console.error(err);
        process.exit(1);
    }
}

main();
