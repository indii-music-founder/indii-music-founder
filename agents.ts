
import * as dom from './dom';
import { state } from './state';
import * as ui from './ui';
import * as gallery from './gallery';
import * as videoLogic from './video';
import { AI } from './ai';
import * as lightbox from './lightbox';
import { v4 as uuidv4 } from 'uuid';

export async function runShowrunner() {
    const prompt = dom.promptEl.value.trim();
    if (!prompt) return;
    dom.statusEl.textContent = 'Planning...';
    ui.startEvolution(8000);
    dom.storyboardContainer.classList.remove('hidden');
    dom.storyboardGrid.innerHTML = '<div class="text-white p-4">Thinking...</div>';
    try {
        const response = await AI.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: prompt + gallery.getProjectContext(),
            config: { systemInstruction: "Return JSON { panels: [{ id, visual_prompt, action_prompt }] }", responseMimeType: 'application/json' }
        });
        const plan = AI.parseJSON(response.text);
        renderStoryboard(plan.panels);
    } catch (e: any) { console.error(e); dom.statusEl.textContent = 'Error'; } finally { ui.stopEvolution(); }
}

export async function runMusicVideoAgent() {
    if (!state.uploadedAudio) { alert("Upload audio."); return; }
    dom.statusEl.textContent = 'Analyzing...';
    ui.startEvolution(15000);
    dom.storyboardContainer.classList.remove('hidden');
    try {
        const response = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [ { inlineData: { mimeType: state.uploadedAudio.mimeType, data: state.uploadedAudio.base64.split(',')[1] } }, { text: "Music Video JSON panels." } ] },
            config: { responseMimeType: 'application/json' }
        });
        const plan = AI.parseJSON(response.text);
        renderStoryboard(plan.panels);
    } catch (e: any) { console.error(e); dom.statusEl.textContent = 'Error'; } finally { ui.stopEvolution(); }
}

function renderStoryboard(panels: any[]) {
    dom.storyboardGrid.innerHTML = '';
    if (!panels || panels.length === 0) { dom.storyboardGrid.innerHTML = '<div>No panels.</div>'; return; }
    
    panels.forEach((panel) => {
        const div = document.createElement('div');
        div.className = 'storyboard-card group relative';
        div.innerHTML = `
            <div class="storyboard-image-container bg-gray-800 h-32 w-full overflow-hidden relative cursor-zoom-in">
                <div class="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">Generating...</div>
            </div>
            <div class="p-2 bg-[#252628]">
                <p class="text-[10px] text-gray-400 line-clamp-2 mb-2 h-8">${panel.visual_prompt}</p>
                <button id="anim-btn-${panel.id}" class="w-full text-xs bg-gray-700 hover:bg-blue-600 text-white py-1.5 rounded transition-colors flex items-center justify-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Animate Shot
                </button>
            </div>
        `;
        dom.storyboardGrid.appendChild(div);
        
        // Generate Panel Image
        AI.generateContent({ 
            model: 'gemini-3-pro-image-preview', 
            contents: panel.visual_prompt, 
            config: { imageConfig: { aspectRatio: '16:9', imageSize: '2K' } } 
        }).then(res => {
            const part = res.candidates?.[0]?.content?.parts?.[0];
            if (part && part.inlineData) {
                const src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                const id = uuidv4();
                
                // Silently add to history so it's accessible in lightbox/daisy-chain
                gallery.addToHistory({ 
                    id, 
                    base64: src, 
                    prompt: `Storyboard: ${panel.visual_prompt}`, 
                    timestamp: Date.now(), 
                    type: 'image' 
                }, true);

                const imgContainer = div.querySelector('.storyboard-image-container') as HTMLElement;
                imgContainer.innerHTML = `<img src="${src}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">`;
                
                // Click to expand in lightbox
                imgContainer.onclick = () => {
                    const idx = state.generatedHistory.findIndex(h => h.id === id);
                    if (idx !== -1) lightbox.openLightbox(idx);
                };

                // Animate Button Logic
                const btn = div.querySelector(`#anim-btn-${panel.id}`) as HTMLButtonElement;
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const originalText = btn.innerHTML;
                    btn.innerHTML = 'Animating...';
                    btn.disabled = true;
                    const uri = await AI.generateVideo({ 
                        model: 'veo-3.1-fast-generate-preview', 
                        prompt: panel.action_prompt, 
                        image: { imageBytes: part.inlineData.data, mimeType: 'image/jpeg' } 
                    });
                    if(uri) {
                        await videoLogic.processGeneratedVideo(uri, panel.visual_prompt);
                    }
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                };
            }
        }).catch(err => {
            console.error(err);
            const imgContainer = div.querySelector('.storyboard-image-container');
            if(imgContainer) imgContainer.innerHTML = `<div class="flex items-center justify-center h-full text-red-500 text-xs">Failed</div>`;
        });
    });
}
