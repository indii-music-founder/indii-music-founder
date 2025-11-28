
import * as dom from './dom';
import { state } from './state';
import * as utils from './utils';
import * as ui from './ui';
import * as gallery from './gallery';
import * as lightbox from './lightbox';
import { AI } from './ai';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db';
import * as toast from './toast';
import { UploadedImage, HistoryItem } from './types';

export async function generateImages(): Promise<string | null> {
    const prompt = dom.promptEl.value.trim();
    if (!prompt) return null;

    const countStr = dom.generationCountEl.value;
    let count = parseInt(countStr);
    if (isNaN(count) || count < 1) count = 1;
    
    dom.statusEl.textContent = count > 1 ? 'Generating 1 of ' + count + '...' : 'Generating...';
    ui.startEvolution(15000 * count); 

    let lastGeneratedId: string | null = null;

    try {
        const baseConfig: any = { imageConfig: {} };
        
        // Resolve Source Images (Priority: Film Strip > Gallery Selection)
        let sourceImages: { mimeType: string, data: string, width?: number, height?: number }[] = [];
        
        if (state.activeHistoryId) {
            const historyItem = state.generatedHistory.find(h => h.id === state.activeHistoryId);
            if (historyItem) {
                if (historyItem.type === 'image') {
                    sourceImages.push({ 
                        mimeType: 'image/png', 
                        data: historyItem.base64.split(',')[1]
                    });
                } else if (historyItem.type === 'video') {
                    dom.statusEl.textContent = 'Extracting Frame...';
                    const frame = await utils.extractVideoFrame(historyItem.base64);
                    sourceImages.push({
                        mimeType: 'image/jpeg',
                        data: frame.base64.split(',')[1],
                        width: frame.width,
                        height: frame.height
                    });
                }
            }
        } 
        else if (state.uploadedImages.some(i => i.selected)) {
            sourceImages = state.uploadedImages.filter(i => i.selected).map(img => ({
                mimeType: img.mimeType,
                data: img.base64.split(',')[1],
                width: img.width,
                height: img.height
            }));
        }

        // Aspect Ratio Logic
        if (dom.aspectRatioEl.value === 'original' && sourceImages.length > 0 && sourceImages[0].width && sourceImages[0].height) {
            baseConfig.imageConfig.aspectRatio = utils.getClosestAspectRatio(sourceImages[0].width, sourceImages[0].height);
        } else if (dom.aspectRatioEl.value && dom.aspectRatioEl.value !== 'original') {
            baseConfig.imageConfig.aspectRatio = dom.aspectRatioEl.value;
        }
        
        baseConfig.imageConfig.imageSize = dom.resolutionEl.value || '2K';
        const userSeed = dom.seedInput.value ? parseInt(dom.seedInput.value) : undefined;

        for (let i = 0; i < count; i++) {
            if(count > 1) dom.statusEl.textContent = `Generating ${i + 1} of ${count}...`;
            try {
                 const iterConfig = JSON.parse(JSON.stringify(baseConfig));
                 if (userSeed !== undefined) iterConfig.seed = userSeed + i;

                 const contents: any = { parts: [] };
                 
                 // Add Reference Images
                 if (state.currentMode === 'edit' || state.currentMode === 'reference' || (state.activeHistoryId)) {
                      sourceImages.forEach(img => {
                          contents.parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
                      });
                 }
                 
                 const fullPrompt = prompt + gallery.getProjectContext() + (dom.negativePromptInput.value ? ` --negative_prompt: ${dom.negativePromptInput.value}` : '');
                 contents.parts.push({ text: fullPrompt });

                 // Use AI Core
                 const response = await AI.generateContent({ 
                     model: 'gemini-3-pro-image-preview', 
                     contents, 
                     config: iterConfig 
                 });

                 for (const part of response.candidates?.[0]?.content?.parts || []) {
                     if (part.inlineData) {
                         const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                         const newId = uuidv4();
                         lastGeneratedId = newId;
                         gallery.addToHistory({ 
                             id: newId, 
                             base64: url, 
                             prompt, 
                             timestamp: Date.now(), 
                             type: 'image',
                             projectId: state.currentProjectId 
                         }, i > 0);
                     }
                 }
            } catch(err: any) {
                 console.error(err);
            }
        }
        dom.statusEl.textContent = 'Ready';
        if (count > 1 && state.generatedHistory.length > 0) lightbox.openLightbox(0);
    } catch (e) { console.error(e); dom.statusEl.textContent = 'Error'; } 
    finally { ui.stopEvolution(); }
    
    return lastGeneratedId;
}

export async function runStoryChainGeneration() {
    const prompt = dom.promptEl.value.trim();
    if (!prompt) { toast.show("Enter a topic.", "error"); return; }
    let count = parseInt(dom.generationCountEl.value) || 4;
    
    dom.statusEl.textContent = 'Planning Timeline...';
    ui.startEvolution(count * 15000);

    try {
        // Slider Logic: Map 0-100 to Past <-> Present <-> Future (+/- 8 seconds)
        const sliderVal = parseInt(dom.consistencySlider.value) || 50;
        
        // 50 is 0s. 100 is +8s. 0 is -8s.
        // Formula: (val - 50) / 50 * 8
        const timeDelta = ((sliderVal - 50) / 50) * 8;
        const timeLabel = timeDelta > 0 ? `+${timeDelta.toFixed(1)}s` : `${timeDelta.toFixed(1)}s`;
        
        let temporalMode = "PRESENT";
        let promptModifier = "Maintain exact framing. Bullet-time freeze.";
        let visionQuery = "Analyze the scene.";
        
        if (timeDelta > 0.5) {
            temporalMode = "FUTURE";
            promptModifier = `Advance the timeline by exactly ${timeLabel}. Show the CONSEQUENCE of movement/physics.`;
            visionQuery = `Predict what happens ${timeLabel} later based on current velocity vectors.`;
        } else if (timeDelta < -0.5) {
            temporalMode = "PAST";
            promptModifier = `Rewind the timeline by exactly ${timeLabel}. Show what caused this moment.`;
            visionQuery = `Deduce the state of objects ${timeLabel} before this moment.`;
        }

        // Use AI Core for Planning
        const plannerPrompt = `We are generating a sequence of ${count} images with a time jump of ${timeLabel} per frame based on: "${prompt}". 
        Break this into ${count} specific scene descriptions. Return JSON { "scenes": [] }`;
        
        const planRes = await AI.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: plannerPrompt, 
            config: { responseMimeType: 'application/json' }
        });
        const plan = AI.parseJSON(planRes.text);
        const scenes = plan.scenes || [];
        while(scenes.length < count) scenes.push(`${prompt} (${timeLabel} Sequence)`);

        let previousImageBase64: string | null = null;
        let previousMimeType: string | null = null;
        
        // Initial Context
        if (state.activeHistoryId) {
            const hist = state.generatedHistory.find(h => h.id === state.activeHistoryId);
            if (hist) {
                if (hist.type === 'image') {
                    previousImageBase64 = hist.base64;
                    previousMimeType = 'image/png';
                } else if (hist.type === 'video') {
                    dom.statusEl.textContent = 'Extracting Context...';
                    const frame = await utils.extractVideoFrame(hist.base64);
                    previousImageBase64 = frame.base64;
                    previousMimeType = 'image/jpeg';
                }
            }
        } else {
            const selectedStart = state.uploadedImages.find(i => i.selected);
            if (selectedStart) { previousImageBase64 = selectedStart.base64; previousMimeType = selectedStart.mimeType; }
        }

        const baseConfig: any = { 
            imageConfig: { imageSize: dom.resolutionEl.value || '2K' }
        };
        if (dom.aspectRatioEl.value !== 'original') baseConfig.imageConfig.aspectRatio = dom.aspectRatioEl.value;

        let visualContext = "";

        for (let i = 0; i < count; i++) {
             dom.statusEl.textContent = `Scene ${i+1}/${count}`;
             try {
                 // --- STEP 1: TEMPORAL VISION ANALYSIS ---
                 if (previousImageBase64 && previousMimeType) {
                     dom.statusEl.textContent = `Analyzing ${timeLabel} Context...`;
                     const analysisRes = await AI.generateContent({
                         model: 'gemini-3-pro-preview',
                         contents: { parts: [
                             { inlineData: { mimeType: previousMimeType, data: previousImageBase64.split(',')[1] } },
                             { text: `You are a Visual Physics Engine. ${visionQuery} Return a concise visual description to guide the next frame generation.` }
                         ] }
                     });
                     visualContext = analysisRes.text || "";
                 }

                 // --- STEP 2: GENERATION ---
                 dom.statusEl.textContent = `Generating Scene ${i+1}...`;
                 const contents: any = { parts: [] };
                 
                 if (previousImageBase64 && previousMimeType) {
                     contents.parts.push({ inlineData: { mimeType: previousMimeType, data: previousImageBase64.split(',')[1] } });
                     contents.parts.push({ text: `[Reference Frame]` });
                 }
                 
                 const promptText = `Next keyframe (Time Delta: ${timeLabel}): ${scenes[i]}. \n\nVisual DNA & Temporal Context: ${visualContext}. \n\nDirection: ${promptModifier} ${gallery.getProjectContext()}`;
                 contents.parts.push({ text: promptText });
                 
                 // Use AI Core for Generation
                 const response = await AI.generateContent({ model: 'gemini-3-pro-image-preview', contents, config: baseConfig });
                 
                 const part = response.candidates?.[0]?.content?.parts?.[0];
                 if (part && part.inlineData) {
                     const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                     previousImageBase64 = url; previousMimeType = part.inlineData.mimeType;
                     gallery.addToHistory({ 
                         id: uuidv4(), 
                         base64: url, 
                         prompt: `Chain (${timeLabel}): ${scenes[i]}`, 
                         timestamp: Date.now(), 
                         type: 'image',
                         projectId: state.currentProjectId 
                     }, i > 0);
                 }
             } catch (err: any) {
                 console.error(err);
             }
        }
        dom.statusEl.textContent = 'Chain Complete';
        if (state.generatedHistory.length > 0) lightbox.openLightbox(0);
    } catch(e) { console.error(e); dom.statusEl.textContent = 'Chain Error'; } finally { ui.stopEvolution(); }
}

export async function runRemix() {
    if (!state.remixContent || !state.remixStyle) { toast.show("Provide Content & Style.", "error"); return; }
    dom.statusEl.textContent = 'Remixing...';
    ui.startEvolution(20000);
    try {
        const response = await AI.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [
                    { inlineData: { mimeType: state.remixContent.mimeType, data: state.remixContent.base64.split(',')[1] } }, { text: "Content Ref" },
                    { inlineData: { mimeType: state.remixStyle.mimeType, data: state.remixStyle.base64.split(',')[1] } }, { text: "Style Ref" },
                    { text: `Generate: ${dom.promptEl.value.trim() || "Fusion"} ${gallery.getProjectContext()}` }
            ]},
            config: { imageConfig: { imageSize: '2K' } }
        });
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) gallery.addToHistory({ 
            id: uuidv4(), 
            base64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, 
            prompt: "Remix", 
            timestamp: Date.now(), 
            type: 'image',
            projectId: state.currentProjectId 
        });
    } catch (e: any) { console.error(e); dom.statusEl.textContent = 'Error'; } finally { ui.stopEvolution(); }
}

export async function runBatchRemix(styleImage: HistoryItem, targetImages: UploadedImage[], promptOverride?: string) {
    dom.statusEl.textContent = 'Batch Restyling...';
    ui.startEvolution(targetImages.length * 15000);
    
    try {
        for (let i = 0; i < targetImages.length; i++) {
            dom.statusEl.textContent = `Restyling ${i + 1}/${targetImages.length}...`;
            const target = targetImages[i];
            
            const response = await AI.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts: [
                    // Content (Structure)
                    { inlineData: { mimeType: target.mimeType, data: target.base64.split(',')[1] } }, 
                    { text: "[Content Reference: Keep this structure/geometry]" },
                    // Style (Aesthetic)
                    { inlineData: { mimeType: 'image/png', data: styleImage.base64.split(',')[1] } }, 
                    { text: "[Style Reference: Apply these colors, materials, and lighting]" },
                    // Prompt
                    { text: `Render the Content image exactly in the style of the Reference image. ${promptOverride || dom.promptEl.value.trim() || "Architectural visualization"}` }
                ]},
                config: { imageConfig: { imageSize: '2K', aspectRatio: utils.getClosestAspectRatio(target.width, target.height) } }
            });

            const part = response.candidates?.[0]?.content?.parts?.[0];
            if (part && part.inlineData) {
                const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                gallery.addToHistory({ 
                    id: uuidv4(), 
                    base64: url, 
                    prompt: `Batch Style: ${promptOverride || "Restyle"}`, 
                    timestamp: Date.now(), 
                    type: 'image',
                    projectId: state.currentProjectId 
                }, i > 0);
            }
        }
        dom.statusEl.textContent = 'Batch Complete';
        lightbox.openLightbox(0);
    } catch (e: any) { console.error(e); dom.statusEl.textContent = 'Batch Error'; } 
    finally { ui.stopEvolution(); }
}

export async function runCompositeGeneration(images: UploadedImage[], prompt: string): Promise<string | null> {
    dom.statusEl.textContent = 'Compositing...';
    ui.startEvolution(20000);
    try {
        const contents: any = { parts: [] };
        images.forEach((img, idx) => {
            contents.parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64.split(',')[1] } });
            contents.parts.push({ text: `[Reference ${idx+1}]` });
        });
        contents.parts.push({ text: `Combine these references. ${prompt} ${gallery.getProjectContext()}` });
        
        const response = await AI.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents,
            config: { imageConfig: { imageSize: '2K' } }
        });
        
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
            const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            const id = uuidv4();
            gallery.addToHistory({ id, base64: url, prompt: "Composite", timestamp: Date.now(), type: 'image', projectId: state.currentProjectId });
            return id;
        }
    } catch(e) { console.error(e); dom.statusEl.textContent = 'Error'; }
    finally { ui.stopEvolution(); }
    return null;
}

export async function extractImageStyle(img: UploadedImage) {
    ui.triggerHaptic();
    dom.statusEl.textContent = 'Analyzing Style...';
    try {
        const response = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [
                { inlineData: { mimeType: img.mimeType, data: img.base64.split(',')[1] } },
                { text: `Analyze this image. Return JSON: { "prompt_desc": "Visual description", "style_context": "Artistic style, camera, lighting tags", "negative_prompt": "What to avoid" }` }
            ]},
            config: { responseMimeType: 'application/json' }
        });
        
        const data = AI.parseJSON(response.text);
        
        if (data.prompt_desc) dom.promptEl.value = data.prompt_desc;
        if (data.negative_prompt) dom.negativePromptInput.value = data.negative_prompt;
        
        if (data.style_context) {
            const p = state.projects.find(pr => pr.id === state.currentProjectId);
            if (p) {
                p.context = data.style_context;
                db.saveSettings('projects', state.projects);
                toast.show(`Style Extracted: ${data.style_context.substring(0, 50)}...`, "success");
            }
        }
    } catch (e: any) {
        console.error(e);
        toast.show("Failed to extract style.", "error");
    } finally {
        dom.statusEl.textContent = 'Ready';
    }
}
