
import * as dom from './dom';
import { state } from './state';
import { v4 as uuidv4 } from 'uuid';
import * as utils from './utils';
import * as canvasLogic from './canvas';
import { HistoryItem, UploadedImage } from './types';
import * as ui from './ui';
import * as lightbox from './lightbox';
import * as annotation from './annotation';
import * as db from './db';
import { extractImageStyle } from './image';

export async function handleFiles(files: FileList) {
    ui.triggerHaptic();
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('audio/')) {
            const base64 = await utils.fileToBase64(file);
            state.uploadedAudio = { id: uuidv4(), base64, mimeType: file.type, name: file.name };
            db.saveSettings('uploadedAudio', state.uploadedAudio); // Persist Audio
            dom.audioContainer.classList.remove('hidden');
            dom.audioFilename.textContent = file.name;
            dom.audioPlayer.src = base64;
            if (state.currentMode === 'video') {
                dom.musicModeRadio.checked = true;
                ui.updateGenerateButtonLabel();
            }
            continue;
        }
        if (!file.type.startsWith('image/')) continue;
        const base64 = await utils.fileToBase64(file);
        const img = new Image();
        img.src = base64;
        await new Promise(resolve => img.onload = resolve);
        
        const newImg: UploadedImage = {
            id: uuidv4(),
            base64,
            mimeType: file.type,
            selected: true,
            selectionTimestamp: Date.now(),
            isAnchor: false,
            width: img.width,
            height: img.height,
            projectId: state.currentProjectId // Tag with Project ID
        };

        state.uploadedImages.push(newImg);
        // Save to DB
        db.saveImage(newImg);

        if (state.currentMode === 'canvas') {
            const canvasImg = {
                id: uuidv4(),
                base64,
                x: 100 + (state.canvasImages.length * 50),
                y: 100 + (state.canvasImages.length * 50),
                width: 300,
                height: 300 * (img.height / img.width),
                aspect: img.width / img.height,
                projectId: state.currentProjectId // Tag with Project ID
            };
            state.canvasImages.push(canvasImg);
            db.saveCanvasImage(canvasImg); // Persist to Canvas DB
            canvasLogic.drawCanvas();
        }
    }
    updateGalleryUI();
}

export function removeImage(id: string) {
    ui.triggerHaptic();
    state.uploadedImages = state.uploadedImages.filter(img => img.id !== id);
    db.deleteImage(id); // Remove from DB
    updateGalleryUI();
}

export function clearGallery(onlySelected = false) {
    ui.triggerHaptic();
    if(onlySelected) {
        // Find IDs to delete
        const idsToDelete = state.uploadedImages.filter(img => img.selected).map(i => i.id);
        state.uploadedImages = state.uploadedImages.filter(img => !img.selected);
        // Delete each from DB
        idsToDelete.forEach(id => db.deleteImage(id));
    }
    else if(confirm("Clear all images from gallery?")) {
        // Only clear for current project from state, DB clearStore clears ALL, so we must delete strictly
        // To keep isolation perfect, we iterate and delete items matching current project from DB.
        // Ideally db.ts would have a clearProjectImages, but for now we just delete displayed items.
        state.uploadedImages.forEach(img => db.deleteImage(img.id));
        state.uploadedImages = [];
    }
    updateGalleryUI();
}

export function updateGalleryUI() {
    dom.imageGallery.innerHTML = '';
    
    if (state.uploadedImages.length > 0) {
        dom.imageGallery.classList.remove('hidden');
        dom.uploadPlaceholder.classList.add('hidden');
        if(dom.galleryHint) dom.galleryHint.classList.remove('hidden');
        dom.dropZone.classList.remove('items-center', 'justify-center');
    } else {
        dom.imageGallery.classList.add('hidden');
        dom.uploadPlaceholder.classList.remove('hidden');
        if(dom.galleryHint) dom.galleryHint.classList.add('hidden');
        dom.dropZone.classList.add('items-center', 'justify-center');
    }
    
    const anchorCount = state.uploadedImages.filter(i => i.isAnchor).length;
    const selectedCount = state.uploadedImages.filter(i => i.selected).length;
    const isKeyframeMode = state.currentMode === 'video' && dom.keyframeModeRadio?.checked;
    
    if(dom.galleryActionBtn) {
        if(state.uploadedImages.length > 0) {
            dom.galleryActionBtn.classList.remove('hidden');
            if (selectedCount > 0) {
                dom.galleryActionBtn.textContent = `Delete Selected (${selectedCount})`;
                dom.galleryActionBtn.onclick = () => clearGallery(true);
            } else {
                dom.galleryActionBtn.textContent = "Clear All";
                dom.galleryActionBtn.onclick = () => clearGallery(false);
            }
        } else {
            dom.galleryActionBtn.classList.add('hidden');
        }
    }

    const orderedSelection = state.uploadedImages.filter(i => i.selected).sort((a,b) => a.selectionTimestamp - b.selectionTimestamp);

    state.uploadedImages.forEach(img => {
        const el = document.createElement('div');
        let borderClass = 'border-gray-700';
        if (img.isAnchor) borderClass = 'border-yellow-500 shadow-[0_0_0_1px_rgba(234,179,8,1)]';
        else if (img.selected) borderClass = 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,1)]';

        el.className = `relative cursor-pointer border-2 ${borderClass} rounded-lg overflow-hidden image-thumbnail group aspect-square bg-[#111]`;
        
        let frameLabel = '';
        if (isKeyframeMode && img.selected) {
             const index = orderedSelection.findIndex(s => s.id === img.id);
             if (index === 0) frameLabel = '<span class="bg-green-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">START FRAME</span>';
             else if (index === 1) frameLabel = '<span class="bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">END FRAME</span>';
             else if (index > 1) frameLabel = `<span class="bg-gray-600/90 text-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">#${index + 1}</span>`;
        }

        el.innerHTML = `
            <img src="${img.base64}" class="w-full h-full object-cover">
            <button class="delete-btn absolute top-1 left-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <div class="absolute top-1 right-1 pointer-events-none transition-opacity duration-200 ${img.selected ? 'opacity-100' : 'opacity-0'}">
                <div class="bg-blue-600 rounded-full p-0.5 shadow-sm"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><polyline points="20 6 9 17 4 12"/></svg></div>
            </div>
            <div class="absolute bottom-1 left-1 flex flex-col gap-1 pointer-events-none items-start z-10">
                ${frameLabel}
                <div class="flex gap-1">
                    ${img.mask ? '<span class="bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">MASKED</span>' : ''}
                    ${img.motionMask ? '<span class="bg-cyan-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">MOTION</span>' : ''}
                    ${img.isAnchor ? '<span class="bg-yellow-500/90 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">ANCHOR</span>' : ''}
                </div>
            </div>
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center p-3 gap-2 backdrop-blur-[1px]">
                <button class="mask-btn w-full bg-white hover:bg-gray-100 text-gray-900 text-[10px] font-bold py-1.5 rounded shadow-lg">EDIT MASK</button>
                <div class="flex w-full gap-1">
                    <button class="action-select flex-1 bg-gray-800/80 hover:bg-blue-600 text-white py-1.5 rounded text-[10px]">Select</button>
                    <button class="action-style flex-1 bg-purple-900/80 hover:bg-purple-600 text-white py-1.5 rounded text-[10px]" title="Extract Style">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mx-auto"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M3 5h4"/><path d="M3 9h4"/></svg>
                    </button>
                    <button class="action-anchor flex-1 bg-gray-800/80 hover:bg-yellow-500 hover:text-black text-gray-300 py-1.5 rounded text-[10px]">Anc</button>
                </div>
            </div>
        `;
        
        el.onclick = (e) => { if(!(e.target as HTMLElement).closest('button')) { toggleSelection(); } };
        const toggleSelection = () => {
             ui.triggerHaptic();
             if (!img.selected) { img.selected = true; img.selectionTimestamp = Date.now(); } else { img.selected = false; }
             // Only UI update, selection state not necessarily persisted or needed to be
             db.saveImage(img); // Save updated selection state
             updateGalleryUI();
        };

        (el.querySelector('.action-select') as HTMLButtonElement).onclick = (e) => { e.stopPropagation(); toggleSelection(); };
        (el.querySelector('.delete-btn') as HTMLButtonElement).onclick = (e) => { e.stopPropagation(); removeImage(img.id); };
        (el.querySelector('.action-anchor') as HTMLButtonElement).onclick = (e) => {
            e.stopPropagation();
            ui.triggerHaptic();
            if (!img.isAnchor && anchorCount >= 3) { alert("Maximum 3 Character Anchors allowed."); return; }
            img.isAnchor = !img.isAnchor;
            db.saveImage(img); // Persist anchor state
            updateGalleryUI();
        };
        (el.querySelector('.mask-btn') as HTMLButtonElement).onclick = (e) => { e.stopPropagation(); ui.triggerHaptic(); annotation.openAnnotationModal(img.id); };
        
        const styleBtn = el.querySelector('.action-style') as HTMLButtonElement;
        styleBtn.onclick = (e) => {
            e.stopPropagation();
            const originalHtml = styleBtn.innerHTML;
            styleBtn.innerHTML = `<svg class="animate-spin mx-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
            extractImageStyle(img).finally(() => {
                styleBtn.innerHTML = originalHtml;
            });
        };

        dom.imageGallery.appendChild(el);
    });
    
    dom.selectionCountEl.textContent = `${selectedCount} selected`;
    
    if (anchorCount > 0 && state.currentMode === 'video') {
        dom.anchorStatusEl.classList.remove('hidden');
        dom.anchorStatusEl.querySelector('p.font-bold')!.textContent = `Character Anchor Active (${anchorCount}/3)`;
    } else {
        dom.anchorStatusEl.classList.add('hidden');
    }
    ui.updateGenerateButtonLabel();
}

export function addToHistory(item: HistoryItem, silent = false) {
    // Ensure Project ID is attached before saving state
    item.projectId = state.currentProjectId;
    state.generatedHistory.unshift(item);
    db.saveHistoryItem(item); // Persist History
    updateHistoryUI();
    lightbox.renderFilmStrip(); 
    if (!silent) lightbox.openLightbox(0);
}

export function updateHistoryUI() {
    dom.historyList.innerHTML = '';
    state.generatedHistory.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
            ${item.type === 'video' ? '<div class="history-thumb flex items-center justify-center text-xl">🎬</div>' : `<img src="${item.base64}" class="history-thumb">`}
            <div class="history-info"><p class="history-prompt">${item.prompt}</p></div>`;
        el.onclick = () => lightbox.openLightbox(index);
        dom.historyList.appendChild(el);
    });
    lightbox.renderFilmStrip();
}

export function setupRemixDropZone(el: HTMLDivElement, type: 'content' | 'style') {
    if (!el) return;
    
    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/')) return;
        const base64 = await utils.fileToBase64(file);
        const img = new Image();
        img.src = base64;
        await new Promise(r => img.onload = r);
        
        if(type === 'content') {
            state.remixContent = { base64, mimeType: file.type, width: img.width, height: img.height };
            dom.remixContentPreview.src = base64;
            dom.remixContentPreview.classList.remove('hidden');
        } else {
            state.remixStyle = { base64, mimeType: file.type, width: img.width, height: img.height };
            dom.remixStylePreview.src = base64;
            dom.remixStylePreview.classList.remove('hidden');
        }
    };

    el.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => { if(input.files?.[0]) handleFile(input.files[0]); };
        input.click();
    };
    el.ondragover = (e) => { e.preventDefault(); el.classList.add('bg-blue-900/20', 'border-blue-400'); };
    el.ondragleave = () => { el.classList.remove('bg-blue-900/20', 'border-blue-400'); };
    el.ondrop = async (e) => {
        e.preventDefault();
        el.classList.remove('bg-blue-900/20', 'border-blue-400');
        if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
    };
}

export function getProjectContext() {
    const p = state.projects.find(pr => pr.id === state.currentProjectId);
    return p && p.context ? ` [Project Style: ${p.context}]` : '';
}
