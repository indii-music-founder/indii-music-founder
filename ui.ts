
import * as dom from './dom';
import { state } from './state';
import { OperationMode } from './types';
import { STUDIO_TAGS } from './constants';

function getModeConfig(mode: string) {
    const configs: Record<string, { activeBtn?: HTMLElement, show?: (HTMLElement | null)[], hide?: (HTMLElement | null)[], overflow?: boolean }> = {
        generate: { activeBtn: dom.modeGenerateBtn, show: [dom.storyChainWrapper, dom.countContainer], hide: [dom.videoConfigModal, dom.infiniteCanvas, dom.canvasHud] },
        video: { activeBtn: dom.modeGenerateBtn, show: [dom.videoConfigModal], hide: [dom.countContainer, dom.storyChainWrapper, dom.infiniteCanvas, dom.canvasHud] },
        edit: { activeBtn: dom.modeEditBtn, show: [dom.countContainer], hide: [dom.videoConfigModal, dom.storyChainWrapper, dom.infiniteCanvas, dom.canvasHud] },
        reference: { activeBtn: dom.modeReferenceBtn, show: [dom.countContainer], hide: [dom.videoConfigModal, dom.storyChainWrapper, dom.infiniteCanvas, dom.canvasHud] },
        remix: { activeBtn: dom.modeRemixBtn, show: [dom.countContainer, dom.remixContentDrop?.parentElement], hide: [dom.videoConfigModal, dom.storyChainWrapper, dom.infiniteCanvas, dom.canvasHud] },
        showroom: { activeBtn: dom.modeShowroomBtn, show: [dom.countContainer, dom.showroomContainer], hide: [dom.videoConfigModal, dom.storyChainWrapper, dom.infiniteCanvasContainer] },
        canvas: { activeBtn: dom.modeCanvasBtn, show: [dom.infiniteCanvasContainer, dom.canvasHud], hide: [dom.videoConfigModal, dom.countContainer, dom.storyChainWrapper], overflow: true }
    };
    return configs[mode] || configs.generate;
}

export function setMode(mode: OperationMode) {
    state.currentMode = mode;
    const cfg = getModeConfig(mode);

    // Reset Buttons
    [dom.modeGenerateBtn, dom.modeEditBtn, dom.modeReferenceBtn, dom.modeRemixBtn, dom.modeCanvasBtn, dom.modeShowroomBtn, dom.modeAgentBtn]
        .forEach(b => b?.classList.remove('bg-blue-600', 'text-white'));
    cfg.activeBtn?.classList.add('bg-blue-600', 'text-white');

    // Visibility Toggles
    // We need to hide EVERYTHING that might be shown in other modes
    // To be safe, we hide all potential containers
    const allContainers = [
        dom.remixContentDrop?.parentElement,
        dom.showroomContainer, // Use the container ID
        dom.videoConfigModal,
        dom.countContainer,
        dom.storyChainWrapper,
        dom.infiniteCanvasContainer,
        dom.canvasHud
    ];
    allContainers.forEach(el => el?.classList.add('hidden'));
    
    cfg.show?.forEach(el => el?.classList.remove('hidden'));
    if(dom.viewStudio) dom.viewStudio.classList.toggle('overflow-hidden', !!cfg.overflow);

    updateGenerateButtonLabel();
    updateVideoInstructionUI();
}

export function updateVideoInstructionUI() {
    if (state.currentMode !== 'video' || !dom.videoGridInstruction) return;
    const modes = [
        { el: dom.draftModeRadio, text: "<b>Draft Mode:</b> Fast generation." },
        { el: dom.agentModeRadio, text: "<b>Showrunner:</b> Agent storyboard." },
        { el: dom.infiniteReelRadio, text: "<b>Infinite Reel:</b> Extend video." },
        { el: dom.musicModeRadio, text: "<b>Music Video:</b> Sync to audio." },
        { el: dom.motionBrushRadio, text: "<b>Motion Brush:</b> Animate mask." },
        { el: dom.keyframeModeRadio, text: "<b>Keyframes:</b> Morph images." }
    ];
    const match = modes.find(m => m.el?.checked);
    dom.videoGridInstruction.innerHTML = match ? match.text : "Select a mode.";
}

export function updateGenerateButtonLabel() {
    if (!dom.generateTrigger) return;
    let label = 'Generate';
    if (state.currentMode === 'video') label = dom.directorsCutToggle?.checked ? 'Generate Video (Director)' : 'Generate Video';
    else if (state.currentMode === 'edit') label = 'Generate Edits';
    else if (state.currentMode === 'remix') label = 'Remix';
    else if (state.currentMode === 'showroom') label = 'Mockup';
    else if (dom.storyChainCheckbox?.checked) label = 'Generate Chain';
    
    const span = dom.generateTrigger.querySelector('span');
    if(span) span.textContent = label; else dom.generateTrigger.textContent = label;
}

export function initPromptBuilder() {
    if (!dom.promptBuilderToggle || !dom.promptBuilderContent) return;
    const grid = document.getElementById('prompt-builder-grid');
    if (grid && grid.children.length === 0) {
        Object.entries(STUDIO_TAGS).forEach(([category, tags]) => {
            const div = document.createElement('div');
            div.innerHTML = `<label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">${category}</label>`;
            const select = document.createElement('select');
            select.className = "w-full bg-[#1a1a1a] border border-gray-700 text-gray-300 text-xs rounded p-2 outline-none";
            select.innerHTML = `<option value="">Select ${category}...</option>`;
            
            const addOpts = (list: string[], group?: HTMLElement) => list.forEach(t => {
                const o = document.createElement('option'); o.value = t; o.textContent = t; (group || select).appendChild(o);
            });

            if (Array.isArray(tags)) addOpts(tags);
            else Object.entries(tags).forEach(([gName, gTags]) => {
                const grp = document.createElement('optgroup'); grp.label = gName; select.appendChild(grp); addOpts(gTags, grp);
            });

            select.onchange = () => {
                if (select.value) {
                    dom.promptEl.value = (dom.promptEl.value.trim() ? dom.promptEl.value + ', ' : '') + select.value;
                    select.value = "";
                }
            };
            div.appendChild(select); grid.appendChild(div);
        });
    }
    dom.promptBuilderToggle.onclick = () => { dom.promptBuilderContent.classList.toggle('hidden'); dom.promptBuilderArrow.classList.toggle('rotate-180'); };
}

export function initStudioControlPanel() {
    if (dom.studioControlToggle) dom.studioControlToggle.onclick = () => { dom.studioControlContent.classList.toggle('hidden'); dom.studioControlArrow.classList.toggle('rotate-180'); };
}

export function initGenerateMenu() {
    if (dom.modeGenerateBtn) {
        dom.modeGenerateBtn.onclick = (e) => { e.stopPropagation(); dom.modeGenerateMenu.classList.toggle('hidden'); };
        document.addEventListener('click', (e) => { if (!dom.modeGenerateBtn.contains(e.target as Node)) dom.modeGenerateMenu.classList.add('hidden'); });
        if(dom.modeGenImage) dom.modeGenImage.onclick = () => { setMode('generate'); dom.modeGenerateMenu.classList.add('hidden'); };
        if(dom.modeGenVideo) dom.modeGenVideo.onclick = () => { setMode('video'); dom.modeGenerateMenu.classList.add('hidden'); };
    }
}

export function updateProjectsUI() {
    if (!dom.projectSelector) return;
    dom.projectSelector.innerHTML = '';
    state.projects.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if(p.id === state.currentProjectId) option.selected = true;
        dom.projectSelector.appendChild(option);
    });
    const newOpt = document.createElement('option');
    newOpt.value = 'new';
    newOpt.textContent = 'Dashboard / New...';
    dom.projectSelector.appendChild(newOpt);
}

export function startEvolution(ms: number, btn?: HTMLElement) { if(dom.statusEl) { dom.statusEl.classList.add('animate-pulse'); dom.statusEl.textContent = 'Processing...'; } }
export function stopEvolution(btn?: HTMLElement) { if(dom.statusEl) { dom.statusEl.classList.remove('animate-pulse'); dom.statusEl.textContent = 'Ready'; } }
export function triggerHaptic() { if (navigator.vibrate) navigator.vibrate(10); }
