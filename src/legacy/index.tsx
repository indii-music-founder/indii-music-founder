
import * as dom from './dom';
import { state } from './state';
import * as ui from './ui';
import * as gallery from './gallery';
import * as imageLogic from './image';
import * as videoLogic from './video';
import * as promptLogic from './prompt';
import * as canvasLogic from './canvas';
import * as showroomLogic from './showroom';
import * as lightboxLogic from './lightbox';
import * as annotationLogic from './annotation';
import * as agents from './agents';
import * as db from './db';
import * as agentZero from './agent_zero';
import * as router from './router';
import * as dashboard from './dashboard';
import * as toast from './toast';

import { events, APP_EVENTS } from './events';

async function reloadProjectData(projectId: string) {
    try {
        // Reset State
        state.uploadedImages = []; state.generatedHistory = []; state.canvasImages = []; state.agentHistory = [];
        if (dom.imageGallery) dom.imageGallery.innerHTML = '';
        if (dom.historyList) dom.historyList.innerHTML = '';
        
        const data = await db.loadAllData(projectId);
        Object.assign(state, {
            uploadedImages: data.images, generatedHistory: data.history, savedPrompts: data.prompts, projects: data.projects,
            currentProjectId: projectId, canvasImages: data.canvasImages, uploadedAudio: data.audio, agentHistory: data.agentHistory
        });
        if(data.showroomAsset) state.showroomAsset = data.showroomAsset;
        
        gallery.updateGalleryUI(); gallery.updateHistoryUI(); canvasLogic.drawCanvas(); agentZero.renderChat();
        if (dom.projectSelector) ui.updateProjectsUI();

        events.emit(APP_EVENTS.PROJECT_LOADED, projectId);
    } catch(e) { console.error("Reload failed", e); }
}

async function initApp() {
    // 1. Initialize DOM Elements
    if (dom.initDOM) dom.initDOM();
    events.emit(APP_EVENTS.DOM_READY);

    // 2. Initialize DB
    await db.initDB();
    events.emit(APP_EVENTS.DB_READY);

    // 3. Load Project Data
    let savedProjId = await db.getSettings('currentProjectId') || 'default';
    await reloadProjectData(savedProjId);

    // 4. Initialize Router
    router.switchView('studio');

    // 5. Restore UI State
    if(state.showroomAsset && dom.showroomAssetPreview) { dom.showroomAssetPreview.src = state.showroomAsset.base64; dom.showroomAssetPreview.classList.remove('hidden'); }
    if(state.uploadedAudio && dom.audioContainer) { dom.audioContainer.classList.remove('hidden'); dom.audioFilename.textContent = state.uploadedAudio.name; dom.audioPlayer.src = state.uploadedAudio.base64; }
    
    const savedVidMode = await db.getSettings('videoMode');
    if(savedVidMode) { const radio = document.getElementById(savedVidMode) as HTMLInputElement; if(radio) radio.checked = true; }
    if(dom.directorsCutToggle) dom.directorsCutToggle.checked = await db.getSettings('directorsCut') || false;

    // 6. Initialize UI Components
    ui.initPromptBuilder(); ui.initStudioControlPanel(); ui.initGenerateMenu(); ui.updateVideoInstructionUI(); ui.updateGenerateButtonLabel();
    gallery.updateGalleryUI(); gallery.updateHistoryUI(); canvasLogic.setupCanvasInteractions(); agentZero.initAgentZero();

    // 7. Setup Event Bindings
    setupEventBindings();

    // 8. Signal App Ready
    events.emit(APP_EVENTS.APP_READY);
    console.log("🚀 Rndr-AI initialized via EventBus");
}

function setupEventBindings() {
    const bind = (el: HTMLElement | null, evt: string, fn: (e:any)=>void) => { if(el) el.addEventListener(evt, fn); };
    const click = (el: HTMLElement | null, fn: (e:any)=>void) => bind(el, 'click', fn);

    // Nav & Modes
    click(dom.homeBtn, () => { dashboard.initDashboard(); router.switchView('dashboard'); });
    click(dom.modeEditBtn, () => ui.setMode('edit'));
    click(dom.modeReferenceBtn, () => ui.setMode('reference'));
    click(dom.modeRemixBtn, () => ui.setMode('remix'));
    click(dom.modeCanvasBtn, () => ui.setMode('canvas'));
    click(dom.modeShowroomBtn, () => ui.setMode('showroom'));
    
    // AGENT R TOGGLE
    click(dom.modeAgentBtn, () => { 
        dom.agentWindow.classList.toggle('hidden'); 
        agentZero.renderChat(); 
    });

    // Generation
    click(dom.generateTrigger, () => {
        // Agent Mode is now overlay, so bottom trigger mainly for underlying mode
        if (state.currentMode === 'video') {
            if (dom.infiniteReelRadio?.checked) videoLogic.runDirectVideo();
            else if (dom.keyframeModeRadio?.checked) videoLogic.runKeyframeTransition();
            else if (dom.musicModeRadio?.checked) agents.runMusicVideoAgent();
            else if (dom.motionBrushRadio?.checked) videoLogic.runMotionBrush();
            else if (dom.agentModeRadio?.checked) agents.runShowrunner();
            else videoLogic.runDirectVideo();
        }
        else if (state.currentMode === 'remix') imageLogic.runRemix();
        else if (state.currentMode === 'showroom') showroomLogic.runShowroomMockup();
        else {
            if (dom.storyChainCheckbox?.checked) imageLogic.runStoryChainGeneration();
            else imageLogic.generateImages();
        }
    });

    click(dom.genActionImage, (e) => { e.stopPropagation(); ui.setMode('generate'); setTimeout(imageLogic.generateImages, 100); });
    click(dom.genActionVideo, (e) => { e.stopPropagation(); ui.setMode('video'); setTimeout(videoLogic.runDirectVideo, 100); });

    // Project & Bible
    if(dom.projectSelector) dom.projectSelector.onchange = async () => {
        if (dom.projectSelector.value === 'new') router.switchView('dashboard');
        else { await db.saveSettings('currentProjectId', dom.projectSelector.value); await reloadProjectData(dom.projectSelector.value); router.switchView('studio'); }
    };
    click(dom.editBibleBtn, () => { 
        const p = state.projects.find(pr => pr.id === state.currentProjectId);
        if(p) { dom.bibleProjectName.value = p.name; dom.bibleContext.value = p.context; dom.bibleModal.classList.remove('hidden'); }
    });
    click(dom.closeBibleBtn, () => {
        const p = state.projects.find(pr => pr.id === state.currentProjectId);
        if(p) {
            p.name = dom.bibleProjectName.value;
            p.context = dom.bibleContext.value;
            db.saveSettings('projects', state.projects);
            ui.updateProjectsUI();
            toast.show("Bible Saved", "success");
        }
        dom.bibleModal.classList.add('hidden');
    });

    // Prompt Tools
    click(dom.magicBtn, promptLogic.generateMagicWords);
    click(dom.improveBtn, () => promptLogic.openPromptImprover());
    click(dom.savePromptBtn, promptLogic.saveCurrentPrompt);
    click(dom.loadPromptBtn, promptLogic.openPromptLibrary);
    click(dom.closeLibraryBtn, () => dom.promptLibraryModal.classList.add('hidden'));
    click(dom.clearPromptBtn, () => { dom.promptEl.value = ''; dom.promptEl.focus(); });
    click(dom.acceptImprovementBtn, promptLogic.applyImprovedPrompt);
    click(dom.cancelImprovementBtn, promptLogic.closeImproverModal);
    click(dom.closeModalBtn, promptLogic.closeImproverModal);
    click(dom.improverModal, (e) => { if(e.target === dom.improverModal) promptLogic.closeImproverModal(); });

    // Inputs & Files
    if(dom.fileInput) dom.fileInput.onchange = (e: any) => gallery.handleFiles(e.target.files);
    document.addEventListener('paste', (e) => { if(e.clipboardData?.files.length) gallery.handleFiles(e.clipboardData.files); });
    
    if(dom.dropZone) {
        click(dom.dropZone, (e) => { if(!(e.target as HTMLElement).closest('button, .image-thumbnail')) dom.fileInput.click(); });
        dom.dropZone.ondragover = (e) => { e.preventDefault(); dom.dropZone.classList.add('border-blue-500'); };
        dom.dropZone.ondragleave = () => dom.dropZone.classList.remove('border-blue-500');
        dom.dropZone.ondrop = (e) => { e.preventDefault(); dom.dropZone.classList.remove('border-blue-500'); if(e.dataTransfer?.files) gallery.handleFiles(e.dataTransfer.files); };
    }

    if (dom.storyChainCheckbox) dom.storyChainCheckbox.onchange = () => {
        dom.storyConsistencyContainer?.classList.toggle('opacity-50', !dom.storyChainCheckbox.checked);
        dom.storyConsistencyContainer?.classList.toggle('pointer-events-none', !dom.storyChainCheckbox.checked);
        ui.updateGenerateButtonLabel();
    };
    if (dom.consistencySlider) dom.consistencySlider.oninput = () => {
        const val = parseInt(dom.consistencySlider.value), delta = ((val - 50) / 50) * 8;
        dom.timeDeltaDisplay.textContent = delta > 0 ? `+${delta.toFixed(1)}s Future` : delta < 0 ? `${delta.toFixed(1)}s Past` : '0s Present';
    };

    // Sub-Features
    gallery.setupRemixDropZone(dom.remixContentDrop, 'content');
    gallery.setupRemixDropZone(dom.remixStyleDrop, 'style');
    showroomLogic.initShowroom();
    click(dom.showroomMockupBtn, showroomLogic.runShowroomMockup);
    click(dom.showroomVideoBtn, showroomLogic.runShowroomVideo);
    click(dom.magicMotionBtn, showroomLogic.generateMagicMotion);

    // Canvas
    click(dom.canvasToolPan, () => canvasLogic.setCanvasTool('pan'));
    click(dom.canvasToolGenerate, () => canvasLogic.setCanvasTool('generate'));
    click(dom.canvasResetView, canvasLogic.resetCanvasView);
    click(dom.canvasClear, canvasLogic.clearCanvas);
    click(dom.canvasInfoBtn, canvasLogic.toggleCanvasHelp);
    click(dom.closeCanvasHelpBtn, canvasLogic.toggleCanvasHelp);
    click(dom.exitCanvasBtn, () => ui.setMode('generate'));
    click(dom.canvasUploadBtn, () => {
        const i = document.createElement('input'); i.type='file'; i.multiple=true; i.accept='image/*';
        i.onchange=()=>gallery.handleFiles(i.files!); i.click();
    });

    // Video Config
    click(dom.closeVideoConfigBtn, () => dom.videoConfigModal.classList.add('hidden'));
    const updateVideoMode = (e: any) => { if(e.target.checked) { db.saveSettings('videoMode', e.target.id); ui.updateVideoInstructionUI(); ui.updateGenerateButtonLabel(); }};
    [dom.draftModeRadio, dom.agentModeRadio, dom.infiniteReelRadio, dom.keyframeModeRadio, dom.musicModeRadio, dom.motionBrushRadio].forEach(r => bind(r, 'change', updateVideoMode));
    if(dom.directorsCutToggle) dom.directorsCutToggle.onchange = () => { db.saveSettings('directorsCut', dom.directorsCutToggle.checked); ui.updateGenerateButtonLabel(); };

    // Annotation
    click(dom.cancelAnnotationBtn, annotationLogic.closeAnnotationModal);
    click(dom.saveAnnotationBtn, annotationLogic.saveMask);
    click(dom.clearMaskBtn, annotationLogic.clearCanvas);
    click(dom.invertMaskBtn, annotationLogic.invertMask);
    click(dom.toolBrushBtn, () => annotationLogic.setDrawingTool('brush'));
    click(dom.toolEraserBtn, () => annotationLogic.setDrawingTool('eraser'));
    if(dom.annotationCanvas) {
        bind(dom.annotationCanvas, 'mousedown', annotationLogic.startDrawing);
        bind(dom.annotationCanvas, 'mousemove', annotationLogic.draw);
        bind(dom.annotationCanvas, 'mouseup', annotationLogic.stopDrawing);
        bind(dom.annotationCanvas, 'mouseleave', annotationLogic.stopDrawing);
    }

    // Lightbox & History
    click(dom.lightboxClose, () => dom.lightboxModal.classList.add('hidden'));
    click(dom.lightboxPrev, () => lightboxLogic.navigateLightbox(-1));
    click(dom.lightboxNext, () => lightboxLogic.navigateLightbox(1));
    click(dom.lightboxPlayReelBtn, lightboxLogic.playReel);
    click(dom.lightboxDownload, () => lightboxLogic.downloadItem(state.generatedHistory[state.currentLightboxIndex]));
    lightboxLogic.setupLightboxEdit();
    click(dom.exportReelBtn, lightboxLogic.exportReel);
    if(dom.lightboxCompareBtn) {
        bind(dom.lightboxCompareBtn, 'mousedown', () => lightboxLogic.toggleCompare(true));
        bind(dom.lightboxCompareBtn, 'mouseup', () => lightboxLogic.toggleCompare(false));
        bind(dom.lightboxCompareBtn, 'mouseleave', () => lightboxLogic.toggleCompare(false));
        bind(dom.lightboxCompareBtn, 'touchstart', (e) => { e.preventDefault(); lightboxLogic.toggleCompare(true); });
        bind(dom.lightboxCompareBtn, 'touchend', (e) => { e.preventDefault(); lightboxLogic.toggleCompare(false); });
    }
    
    click(dom.openHistoryBtn, () => dom.historySidebar.classList.remove('translate-x-full'));
    click(dom.closeHistoryBtn, () => dom.historySidebar.classList.add('translate-x-full'));
    click(dom.downloadAllBtn, lightboxLogic.downloadAllResults);
    click(dom.clearHistoryBtn, () => { if(confirm("Clear history?")) { state.generatedHistory=[]; gallery.updateHistoryUI(); } });
    click(dom.closeStoryboardBtn, () => dom.storyboardContainer.classList.add('hidden'));
    click(dom.removeAudioBtn, () => { state.uploadedAudio=null; dom.audioContainer.classList.add('hidden'); dom.audioPlayer.pause(); db.saveSettings('uploadedAudio', null); });
    
    if(dom.filmScrollLeft) click(dom.filmScrollLeft, () => dom.filmStripContainer.scrollBy({ left: -200, behavior: 'smooth' }));
    if(dom.filmScrollRight) click(dom.filmScrollRight, () => dom.filmStripContainer.scrollBy({ left: 200, behavior: 'smooth' }));

    // Global Keys
    document.addEventListener('keydown', (e) => {
        if(e.key === 'Escape') [dom.improverModal, dom.bibleModal, dom.videoConfigModal, dom.lightboxModal, dom.annotationModal, dom.promptLibraryModal, dom.storyboardContainer].forEach(el => el?.classList.add('hidden'));
        if(state.currentMode === 'canvas' && (e.key === 'Delete' || e.key === 'Backspace')) canvasLogic.deleteSelection();

        // Power User Shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
             dom.generateTrigger?.click();
        }
        if (e.key === '[') {
            const range = dom.brushSizeInput;
            if(range) { range.value = Math.max(5, parseInt(range.value) - 5).toString(); range.dispatchEvent(new Event('input')); }
        }
        if (e.key === ']') {
            const range = dom.brushSizeInput;
            if(range) { range.value = Math.min(100, parseInt(range.value) + 5).toString(); range.dispatchEvent(new Event('input')); }
        }
    });
}

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);
