
import * as dom from './dom';
import { state } from './state';
import * as gallery from './gallery';
import * as db from './db';

export function openAnnotationModal(imageId: string) {
    const img = state.uploadedImages.find(i => i.id === imageId);
    if (!img) return;
    state.currentAnnotationId = imageId;
    dom.annotationModal.classList.remove('hidden');
    dom.annotationImage.src = img.base64;
    const isMotionMode = state.currentMode === 'video' && dom.motionBrushRadio && dom.motionBrushRadio.checked;
    if (isMotionMode) {
        dom.annotationTitle.textContent = "Paint Motion Mask";
        setBrushColor('rgba(37, 99, 235, 0.6)');
    } else {
        dom.annotationTitle.textContent = "Edit Mask";
        setBrushColor('rgba(220, 38, 38, 0.6)'); 
    }
    setTimeout(() => {
        dom.annotationCanvas.width = dom.annotationImage.clientWidth;
        dom.annotationCanvas.height = dom.annotationImage.clientHeight;
        const ctx = dom.annotationCanvas.getContext('2d');
        if (ctx) {
             ctx.clearRect(0,0,dom.annotationCanvas.width, dom.annotationCanvas.height);
             const maskToLoad = isMotionMode ? img.motionMask : img.mask;
             if (maskToLoad) {
                const maskImg = new Image();
                maskImg.src = maskToLoad;
                maskImg.onload = () => ctx.drawImage(maskImg, 0, 0, dom.annotationCanvas.width, dom.annotationCanvas.height);
             }
        }
    }, 100);
}

export function closeAnnotationModal() { dom.annotationModal.classList.add('hidden'); state.currentAnnotationId = null; }

export function setDrawingTool(tool: 'brush' | 'eraser') {
    state.currentTool = tool;
    dom.toolBrushBtn.classList.toggle('bg-blue-600', tool === 'brush');
    dom.toolEraserBtn.classList.toggle('bg-blue-600', tool === 'eraser');
}

export function setBrushColor(color: string) { state.currentBrushColor = color; }

export function startDrawing(e: MouseEvent) { state.isDrawing = true; draw(e); }
export function stopDrawing() { state.isDrawing = false; dom.annotationCanvas.getContext('2d')?.beginPath(); }

export function draw(e: MouseEvent) {
    if (!state.isDrawing) return;
    const ctx = dom.annotationCanvas.getContext('2d');
    if (!ctx) return;
    const rect = dom.annotationCanvas.getBoundingClientRect();
    ctx.lineWidth = parseInt(dom.brushSizeInput.value);
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = state.currentTool === 'brush' ? 'source-over' : 'destination-out';
    ctx.strokeStyle = state.currentBrushColor;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

export function clearCanvas() { dom.annotationCanvas.getContext('2d')?.clearRect(0, 0, dom.annotationCanvas.width, dom.annotationCanvas.height); }

export function invertMask() {
    const ctx = dom.annotationCanvas.getContext('2d');
    if(!ctx) return;
    const imageData = ctx.getImageData(0, 0, dom.annotationCanvas.width, dom.annotationCanvas.height);
    const data = imageData.data;
    const parts = state.currentBrushColor.replace(/[^\d,.]/g, '').split(',');
    let r=0,g=0,b=0,a=255;
    if(parts.length>=3){r=parseInt(parts[0]);g=parseInt(parts[1]);b=parseInt(parts[2]);}
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) data[i + 3] = 0;
        else { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a; }
    }
    ctx.putImageData(imageData, 0, 0);
}

export function saveMask() {
    if (!state.currentAnnotationId) return;
    const img = state.uploadedImages.find(i => i.id === state.currentAnnotationId);
    if (img) {
        if (state.currentMode === 'video' && dom.motionBrushRadio.checked) img.motionMask = dom.annotationCanvas.toDataURL();
        else img.mask = dom.annotationCanvas.toDataURL();
        
        // Save Updated Image with mask to DB
        db.saveImage(img);
    }
    gallery.updateGalleryUI();
    closeAnnotationModal();
}
