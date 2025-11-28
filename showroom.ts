
import { state } from './state';
import * as dom from './dom';
import * as utils from './utils';
import * as ui from './ui';
import * as gallery from './gallery';
import { AI } from './ai';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db';

export function initShowroom() {
    setupShowroomDropZone();

    // Wire up Scene Presets
    const presetBtns = document.querySelectorAll('.showroom-preset-btn');
    presetBtns.forEach(btn => {
        (btn as HTMLElement).onclick = () => {
            const val = (btn as HTMLElement).dataset.prompt;
            if(val && dom.promptEl) dom.promptEl.value = val;
        };
    });
}

export function setupShowroomDropZone() {
    if (!dom.showroomDropZone) return;

    const handleFile = async (file: File) => {
         if (!file.type.startsWith('image/')) return;
         const base64 = await utils.fileToBase64(file);
         state.showroomAsset = { base64, mimeType: file.type };
         db.saveSettings('showroomAsset', state.showroomAsset);
         if (dom.showroomAssetPreview) {
             dom.showroomAssetPreview.src = base64;
             dom.showroomAssetPreview.classList.remove('hidden');
         }
    };

    dom.showroomDropZone.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => { if (input.files?.[0]) handleFile(input.files[0]); };
        input.click();
    };
    // Drag/Drop handlers omitted for brevity, same as original
    dom.showroomDropZone.ondragover = (e) => { e.preventDefault(); dom.showroomDropZone.classList.add('bg-purple-900/20', 'border-purple-400'); };
    dom.showroomDropZone.ondrop = async (e) => {
        e.preventDefault();
        dom.showroomDropZone.classList.remove('bg-purple-900/20', 'border-purple-400');
        if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
    };
}

export async function generateMagicMotion() {
    const scenePrompt = dom.promptEl.value.trim();
    if (!scenePrompt) { alert("Describe scene first."); return; }
    const originalText = dom.magicMotionBtn.innerHTML;
    dom.magicMotionBtn.innerHTML = `<span class="animate-pulse">Thinking...</span>`;
    dom.magicMotionBtn.disabled = true;
    try {
        const product = dom.showroomProductType.value;
        const currentMotion = dom.showroomMotionPrompt.value;
        const response = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Scene: ${scenePrompt}. Product: ${product}. Current Motion Idea: ${currentMotion || "None"}. Suggest a cinematic motion description.`,
            systemInstruction: `Director of Photography. Suggest cinematic motion. Output ONLY text.`,
            config: { temperature: 0.8 }
        });
        const motion = (response.text || '').replace(/```/g, '').trim();
        if (motion) dom.showroomMotionPrompt.value = motion;
    } catch(e: any) { console.error(e); } finally {
        dom.magicMotionBtn.innerHTML = originalText;
        dom.magicMotionBtn.disabled = false;
    }
}

export async function runShowroomMockup() {
    if (!state.showroomAsset) { alert("Upload graphic first."); return; }
    if (!dom.promptEl.value.trim()) { alert("Describe scene."); return; }
    dom.statusEl.textContent = 'Mocking Up...';
    ui.startEvolution(18000, dom.showroomMockupBtn);
    try {
        const product = dom.showroomProductType.value;
        const placement = dom.showroomPlacement ? dom.showroomPlacement.value : "Center Chest";
        const response = await AI.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [
                    { inlineData: { mimeType: state.showroomAsset.mimeType, data: state.showroomAsset.base64.split(',')[1] } },
                    { text: "Apply this graphic." },
                    { text: `Scene: ${dom.promptEl.value.trim()}. Product: ${product}. Placement: ${placement}. ${gallery.getProjectContext()}` }
            ]},
            systemInstruction: "Apply graphic to product in scene.",
            config: { imageConfig: { aspectRatio: '1:1', imageSize: '2K' } }
        });
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
            const url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            state.currentMockup = { base64: url, mimeType: part.inlineData.mimeType };
            gallery.addToHistory({ id: uuidv4(), base64: url, prompt: `Showroom`, timestamp: Date.now(), type: 'image', projectId: state.currentProjectId });
            dom.showroomVideoBtn.disabled = false;
            dom.showroomVideoBtn.classList.remove('cursor-not-allowed', 'bg-gray-700');
            dom.showroomVideoBtn.classList.add('bg-purple-600');
        }
    } catch (e: any) { console.error(e); dom.statusEl.textContent = 'Error'; } finally { ui.stopEvolution(dom.showroomMockupBtn); }
}

export async function runShowroomVideo() {
    if (!state.currentMockup) return;
    if (!dom.showroomMotionPrompt.value.trim()) { alert("Describe motion."); return; }
    dom.statusEl.textContent = 'Animating...';
    ui.startEvolution(60000, dom.showroomVideoBtn);
    try {
        const uri = await AI.generateVideo({
            model: 'veo-3.1-generate-preview', 
            prompt: dom.showroomMotionPrompt.value.trim(),
            image: { imageBytes: state.currentMockup.base64.split(',')[1], mimeType: state.currentMockup.mimeType },
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
        if (uri) await import('./video').then(v => v.processGeneratedVideo(uri, "Showroom Video"));
    } catch(e: any) { console.error(e); dom.statusEl.textContent = 'Error'; } finally { ui.stopEvolution(dom.showroomVideoBtn); }
}
