
import * as dom from './dom';
import { state } from './state';
import * as utils from './utils';
import * as ui from './ui';
import * as gallery from './gallery';
import { AI, VideoGenerationReferenceType } from './ai';
import { v4 as uuidv4 } from 'uuid';

export async function runMotionBrush() {
    const selected = state.uploadedImages.find(i => i.selected && i.motionMask);
    if (!selected || !selected.motionMask) { alert("Select masked image."); return; }
    dom.statusEl.textContent = 'Planning...';
    ui.startEvolution(60000);
    try {
        // Step 1: Plan Motion
        const analysisRes = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [
                    { inlineData: { mimeType: selected.mimeType, data: selected.base64.split(',')[1] } },
                    { inlineData: { mimeType: 'image/png', data: selected.motionMask.split(',')[1] } },
                    { text: "Describe masked area motion prompt. JSON: {video_prompt}" }
            ]},
            config: { responseMimeType: 'application/json' }
        });
        const plan = AI.parseJSON(analysisRes.text);
        
        // Step 2: Generate Video
        const uri = await AI.generateVideo({
            model: 'veo-3.1-generate-preview', 
            prompt: plan.video_prompt || "Animate",
            image: { imageBytes: selected.base64.split(',')[1], mimeType: selected.mimeType },
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });

        if (uri) await processGeneratedVideo(uri, "Motion Brush");
    } catch(e: any) { console.error(e); dom.statusEl.textContent = 'Error'; } finally { ui.stopEvolution(); }
}

export async function runDirectVideo(): Promise<string | null> {
    if (!dom.promptEl.value.trim()) return null;
    dom.statusEl.textContent = 'Generating Video...';
    ui.startEvolution(60000);
    try {
        const anchors = state.uploadedImages.filter(i => i.isAnchor);
        const selected = state.uploadedImages.find(i => i.selected);
        
        // DAISY CHAIN LOGIC
        let chainImage: { imageBytes: string, mimeType: string } | undefined = undefined;
        if (state.activeHistoryId) {
            const historyItem = state.generatedHistory.find(h => h.id === state.activeHistoryId);
            if (historyItem) {
                if (historyItem.type === 'image') {
                    chainImage = { imageBytes: historyItem.base64.split(',')[1], mimeType: 'image/png' };
                } else if (historyItem.type === 'video') {
                    dom.statusEl.textContent = 'Extracting Context...';
                    const frame = await utils.extractVideoFrame(historyItem.base64);
                    chainImage = { imageBytes: frame.base64.split(',')[1], mimeType: 'image/jpeg' };
                }
            }
        }

        let model = 'veo-3.1-fast-generate-preview';
        let config: any = { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' };
        if (anchors.length > 0) {
            model = 'veo-3.1-generate-preview';
            config.referenceImages = anchors.map(img => ({ image: { imageBytes: img.base64.split(',')[1], mimeType: img.mimeType }, referenceType: VideoGenerationReferenceType.ASSET }));
        }
        
        const inputImage = chainImage || (selected ? { imageBytes: selected.base64.split(',')[1], mimeType: selected.mimeType } : undefined);
        
        const uri = await AI.generateVideo({ 
            model, 
            prompt: dom.promptEl.value + gallery.getProjectContext(), 
            image: inputImage, 
            config 
        });

        if (uri) return await processGeneratedVideo(uri, dom.promptEl.value, dom.directorsCutToggle.checked);
        return null;
    } catch (e: any) { console.error(e); dom.statusEl.textContent = 'Error'; return null; } finally { ui.stopEvolution(); }
}

export async function processGeneratedVideo(uri: string, prompt: string, enableDirectorsCut = false, isRetry = false): Promise<string | null> {
    // Note: Fetch still needs API key for download, but we assume it's available if generation succeeded
    const res = await fetch(`${uri}&key=${process.env.API_KEY}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    
    if (enableDirectorsCut && !isRetry) {
        dom.statusEl.textContent = 'Director QA...';
        dom.processorVideo.src = url;
        await new Promise(resolve => { dom.processorVideo.onloadeddata = resolve; });
        dom.processorVideo.currentTime = 1.0; 
        await new Promise(resolve => { dom.processorVideo.onseeked = resolve; });
        dom.processorCanvas.width = dom.processorVideo.videoWidth;
        dom.processorCanvas.height = dom.processorVideo.videoHeight;
        dom.processorCanvas.getContext('2d')?.drawImage(dom.processorVideo, 0, 0);
        const frameBase64 = dom.processorCanvas.toDataURL('image/jpeg');
        
        const critique = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: frameBase64.split(',')[1] } },
                    { text: `You are a film director. Rate this video frame 1-10 based on the prompt: "${prompt}". If score < 8, provide a technically improved prompt to fix it. Return JSON: {score, refined_prompt}` }
            ]}, config: { responseMimeType: 'application/json' }
        });
        const feedback = AI.parseJSON(critique.text);
        
        if (feedback.score < 8) {
            console.log("Director Rejected:", feedback);
            // Trigger Auto-Reshoot
            dom.statusEl.textContent = `Reshooting (${feedback.score}/10)...`;
            
            const newUri = await AI.generateVideo({ 
                model: 'veo-3.1-fast-generate-preview', 
                prompt: feedback.refined_prompt || prompt + " (Improved)", 
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' } 
            });

            if (newUri) {
                // Process the retry, but disable further critiques (avoid infinite loop)
                return await processGeneratedVideo(newUri, feedback.refined_prompt, false, true);
            }
        }
    }
    
    // Save accepted video
    const id = uuidv4();
    const metaLabel = isRetry ? 'DIRECTOR\'S CUT (V2)' : undefined;
    gallery.addToHistory({ 
        id, 
        base64: url, 
        prompt, 
        timestamp: Date.now(), 
        type: 'video', 
        meta: metaLabel,
        projectId: state.currentProjectId 
    });
    dom.statusEl.textContent = 'Ready';
    return id;
}

export async function runKeyframeTransition() {
    const selected = state.uploadedImages.filter(i => i.selected).sort((a,b) => a.selectionTimestamp - b.selectionTimestamp);
    if (selected.length < 2) { alert("Select 2 images."); return; }
    dom.statusEl.textContent = 'Transitioning...';
    ui.startEvolution(40000);
    try {
        const uri = await AI.generateVideo({
            model: 'veo-3.1-fast-generate-preview',
            prompt: dom.promptEl.value.trim() || "Transition",
            image: { imageBytes: selected[0].base64.split(',')[1], mimeType: selected[0].mimeType },
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9', lastFrame: { imageBytes: selected[1].base64.split(',')[1], mimeType: selected[1].mimeType } }
        });
        if (uri) await processGeneratedVideo(uri, "Transition");
    } catch (e: any) { console.error(e); dom.statusEl.textContent = 'Error'; } finally { ui.stopEvolution(); }
}
