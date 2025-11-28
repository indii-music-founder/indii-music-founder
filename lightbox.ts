

import * as dom from './dom';
import { state } from './state';
import { HistoryItem } from './types';
import * as gallery from './gallery';
import * as annotation from './annotation';
import * as ui from './ui';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db';
import * as utils from './utils';

export function openLightbox(index: number) {
    state.currentLightboxIndex = index;
    const item = state.generatedHistory[index];
    if(!item) return;
    dom.lightboxModal.classList.remove('hidden');
    setTimeout(() => dom.lightboxModal.classList.remove('opacity-0'), 10);
    dom.lightboxImage.classList.add('hidden');
    dom.lightboxVideo.classList.add('hidden');
    dom.lightboxPlayReelBtn.classList.add('hidden');
    dom.lightboxVideo.pause();
    dom.lightboxVideo.onended = null;

    if (item.type === 'video') {
        dom.lightboxVideo.src = item.base64;
        dom.lightboxVideo.classList.remove('hidden');
        dom.lightboxVideo.play();
        if (state.generatedHistory.some(i => i.type === 'video')) dom.lightboxPlayReelBtn.classList.remove('hidden');
        if(dom.lightboxEditBtn) dom.lightboxEditBtn.classList.add('hidden');
    } else {
        dom.lightboxImage.src = item.base64;
        dom.lightboxImage.classList.remove('hidden');
        if(dom.lightboxEditBtn) dom.lightboxEditBtn.classList.remove('hidden');
    }
}

export function navigateLightbox(dir: number) {
    let newIndex = state.currentLightboxIndex + dir;
    if (newIndex < 0) newIndex = state.generatedHistory.length - 1;
    if (newIndex >= state.generatedHistory.length) newIndex = 0;
    openLightbox(newIndex);
}

export async function reuseItem(item: HistoryItem) {
    // Visual Feedback Function
    const showFeedback = () => {
        const btn = document.getElementById(`reuse-btn-${item.id}`);
        if(btn) {
            const original = btn.innerHTML;
            btn.innerHTML = `<span class="text-green-400 font-bold">✓</span>`;
            setTimeout(() => btn.innerHTML = original, 1000);
        }
    };

    if (item.type === 'video') {
        // Convert last frame of video to Image
        try {
            const frame = await utils.extractVideoFrame(item.base64);
            const newImg = {
                id: uuidv4(),
                base64: frame.base64,
                mimeType: 'image/jpeg',
                selected: true,
                selectionTimestamp: Date.now(),
                isAnchor: false,
                width: frame.width,
                height: frame.height
            };
            state.uploadedImages.push(newImg);
            db.saveImage(newImg);
            gallery.updateGalleryUI();
            showFeedback();
        } catch(e) {
            console.error("Failed to reuse video frame", e);
            alert("Failed to extract frame from video.");
        }
    } else {
        // Image
        const newImg = {
            id: uuidv4(),
            base64: item.base64,
            mimeType: 'image/png',
            selected: true,
            selectionTimestamp: Date.now(),
            isAnchor: false,
            width: 1024, 
            height: 1024
        };
        state.uploadedImages.push(newImg);
        db.saveImage(newImg);
        gallery.updateGalleryUI();
        showFeedback();
    }
}

export function downloadItem(item: HistoryItem) {
    const a = document.createElement('a');
    a.href = item.base64;
    a.download = `rndr-ai-${item.timestamp}.${item.type === 'video' ? 'mp4' : 'png'}`;
    a.click();
}

export function downloadAllResults() {
    if (window.JSZip) {
        const zip = new window.JSZip();
        state.generatedHistory.forEach((item, i) => {
             const data = item.base64.split(',')[1];
             zip.file(`rndr-ai-${i}.${item.type === 'video' ? 'mp4' : 'png'}`, data, {base64: true});
        });
        zip.generateAsync({type:"blob"}).then((content: Blob) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = "history.zip";
            a.click();
        });
    }
}

export function playReel() {
    const videos = state.generatedHistory.filter(h => h.type === 'video');
    if (videos.length === 0) return;
    let currentVideoIdx = 0;
    const currentHistItem = state.generatedHistory[state.currentLightboxIndex];
    if (currentHistItem && currentHistItem.type === 'video') {
         currentVideoIdx = videos.findIndex(v => v.id === currentHistItem.id);
         if (currentVideoIdx === -1) currentVideoIdx = 0;
    }
    const playNext = () => {
        if (currentVideoIdx >= videos.length) currentVideoIdx = 0;
        const videoItem = videos[currentVideoIdx];
        const mainIndex = state.generatedHistory.findIndex(h => h.id === videoItem.id);
        if (mainIndex !== -1) {
            openLightbox(mainIndex);
            dom.lightboxVideo.onended = () => { currentVideoIdx++; playNext(); };
            dom.lightboxVideo.play();
        }
    };
    playNext();
}

export function setupLightboxEdit() {
    if(dom.lightboxEditBtn) {
      dom.lightboxEditBtn.onclick = () => {
           const item = state.generatedHistory[state.currentLightboxIndex];
           if(item && item.type === 'image') {
               const newId = uuidv4();
               state.uploadedImages.push({
                  id: newId,
                  base64: item.base64,
                  mimeType: 'image/png',
                  selected: true,
                  selectionTimestamp: Date.now(),
                  isAnchor: false,
                  width: 1024,
                  height: 1024
               });
               dom.lightboxClose.click();
               ui.setMode('edit');
               gallery.updateGalleryUI();
               annotation.openAnnotationModal(newId);
           } else {
               alert("Video editing not supported yet.");
           }
      }
  }
}

export async function exportReel() {
    const videos = state.generatedHistory.filter(h => h.type === 'video');
    if (videos.length === 0) { alert("No videos to export."); return; }

    const originalText = dom.exportReelBtn.innerHTML;
    dom.exportReelBtn.innerHTML = 'Rendering...';
    dom.exportReelBtn.disabled = true;

    try {
        const stream = dom.processorCanvas.captureStream(30);
        
        // Determine supported MimeType (Safari vs Chrome)
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
        else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) mimeType = 'video/webm;codecs=h264';
        
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        
        recorder.start();

        for (const videoItem of videos) {
             dom.processorVideo.src = videoItem.base64;
             await new Promise(r => { dom.processorVideo.onloadeddata = r; });
             dom.processorCanvas.width = dom.processorVideo.videoWidth;
             dom.processorCanvas.height = dom.processorVideo.videoHeight;
             const ctx = dom.processorCanvas.getContext('2d');
             
             dom.processorVideo.play();
             const drawFrame = () => {
                 if(dom.processorVideo.paused || dom.processorVideo.ended) return;
                 ctx?.drawImage(dom.processorVideo, 0, 0);
                 requestAnimationFrame(drawFrame);
             };
             drawFrame();

             await new Promise(r => { dom.processorVideo.onended = r; });
        }

        recorder.stop();
        await new Promise(r => { recorder.onstop = r; });

        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rndr-ai-movie-${Date.now()}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
        a.click();

    } catch(e) {
        console.error(e);
        alert("Export failed (Browser may not support media recording)");
    } finally {
        dom.exportReelBtn.innerHTML = originalText;
        dom.exportReelBtn.disabled = false;
    }
}

export function renderFilmStrip() {
    if (!dom.filmStripList || !dom.filmStripContainer) return;
    
    dom.filmStripList.innerHTML = '';
    
    if (state.generatedHistory.length === 0) {
        dom.filmStripContainer.classList.add('hidden');
        return;
    }
    
    dom.filmStripContainer.classList.remove('hidden');

    state.generatedHistory.slice(0, 10).forEach((item, index) => {
        const card = document.createElement('div');
        // If active, show border
        const isActive = state.activeHistoryId === item.id;
        card.className = `relative w-24 h-24 md:w-32 md:h-32 flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden snap-start group border-2 transition-colors ${isActive ? 'border-blue-500' : 'border-transparent'}`;
        card.setAttribute('draggable', 'true');
        card.ondragstart = (e) => {
            e.dataTransfer?.setData('text/plain', item.id);
        };
        
        const img = document.createElement('img');
        img.src = item.base64;
        img.className = 'w-full h-full object-cover pointer-events-none'; // pointer-events-none so dragging starts on div
        
        // --- Overlay Controls ---
        
        // 1. Daisy Chain Checkbox (Top Left)
        const checkContainer = document.createElement('div');
        checkContainer.className = 'absolute top-1 left-1 z-10';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isActive;
        checkbox.className = 'w-4 h-4 text-blue-600 bg-gray-800 border-gray-500 rounded focus:ring-blue-500 cursor-pointer';
        checkbox.onclick = (e) => {
            e.stopPropagation();
            if (state.activeHistoryId === item.id) state.activeHistoryId = null;
            else state.activeHistoryId = item.id;
            renderFilmStrip(); // Re-render to update borders
        };
        checkContainer.appendChild(checkbox);

        // 2. Reuse Button (Top Right)
        const reuseBtn = document.createElement('button');
        reuseBtn.id = `reuse-btn-${item.id}`;
        reuseBtn.className = 'absolute top-1 right-1 bg-gray-900/80 p-1 rounded text-white hover:bg-green-600 z-10 opacity-0 group-hover:opacity-100 transition-opacity';
        reuseBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="22" y1="5" x2="22" y2="11"/><line x1="22" y1="5" x2="12" y2="15"/></svg>`;
        reuseBtn.title = "Reuse as Input (Gallery)";
        reuseBtn.onclick = (e) => { e.stopPropagation(); reuseItem(item); };
        card.appendChild(reuseBtn);

        // 3. Expand Button (Center - on Hover/Tap)
        const expandBtn = document.createElement('button');
        expandBtn.className = 'absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-0';
        expandBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;
        expandBtn.onclick = () => openLightbox(index);

        // 4. Edit Button (Bottom Right)
        const editBtn = document.createElement('button');
        editBtn.className = 'absolute bottom-1 right-1 bg-gray-900/80 p-1.5 rounded-full text-white hover:bg-blue-600 z-10';
        editBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
        editBtn.title = "Edit Mask";
        editBtn.onclick = (e) => {
            e.stopPropagation();
             // Convert to uploaded image to edit
             const newId = uuidv4();
             state.uploadedImages.push({
                id: newId,
                base64: item.base64,
                mimeType: item.type === 'video' ? 'video/mp4' : 'image/png',
                selected: true,
                selectionTimestamp: Date.now(),
                isAnchor: false,
                width: 1024,
                height: 1024
             });
             ui.setMode('edit');
             gallery.updateGalleryUI();
             annotation.openAnnotationModal(newId);
        };

        if (item.type === 'video') {
             const videoIcon = document.createElement('div');
             videoIcon.className = 'absolute bottom-1 left-1 text-white bg-black/50 rounded p-0.5 text-[10px] pointer-events-none z-10';
             videoIcon.innerHTML = 'VIDEO';
             card.appendChild(videoIcon);
        }

        card.appendChild(img);
        card.appendChild(checkContainer);
        card.appendChild(expandBtn);
        card.appendChild(editBtn);
        
        dom.filmStripList.appendChild(card);
    });
}

export function toggleCompare(enable: boolean) {
    if (state.generatedHistory.length === 0) return;
    
    // Determine which item to show
    let targetIndex = state.currentLightboxIndex;
    
    if (enable) {
        // Try to show the previous history item (index + 1, since 0 is newest)
        if (state.generatedHistory.length > 1) {
             const nextIdx = targetIndex + 1;
             if (nextIdx < state.generatedHistory.length) targetIndex = nextIdx;
             else if (targetIndex - 1 >= 0) targetIndex = targetIndex - 1;
        }
    }

    const item = state.generatedHistory[targetIndex];
    if (!item) return;

    if (item.type === 'video') {
        dom.lightboxImage.classList.add('hidden');
        dom.lightboxVideo.src = item.base64;
        dom.lightboxVideo.classList.remove('hidden');
    } else {
        dom.lightboxVideo.classList.add('hidden');
        dom.lightboxImage.src = item.base64;
        dom.lightboxImage.classList.remove('hidden');
    }
}
