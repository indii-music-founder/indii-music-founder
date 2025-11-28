
import { state } from './state';
import * as dom from './dom';
import { v4 as uuidv4 } from 'uuid';
import { AI } from './ai';
import * as db from './db';
import * as ui from './ui';

// Camera State
let canvasScale = 1;
let canvasOffsetX = 0;
let canvasOffsetY = 0;

// Interaction State
let isPanning = false;
let isDraggingImage: string | null = null;
let startX = 0, startY = 0;
let isSelectingRegion = false;
let selectionRegion = { x: 0, y: 0, w: 0, h: 0 };

// Pinch Zoom Vars
let initialPinchDistance = 0;
let initialScale = 1;

// Image Cache to prevent flickering and repeated loads
const imageCache = new Map<string, HTMLImageElement>();

export function setupCanvasInteractions() {
    resizeCanvas();
    
    // Resize Observer
    window.addEventListener('resize', () => {
        resizeCanvas();
        drawCanvas();
    });

    // Mouse Events
    dom.infiniteCanvas.onmousedown = (e) => handleStart(e.clientX, e.clientY, e.shiftKey, e.button === 2);
    dom.infiniteCanvas.onmousemove = (e) => handleMove(e.clientX, e.clientY);
    dom.infiniteCanvas.onmouseup = handleEnd;
    dom.infiniteCanvas.onmouseleave = handleEnd;
    
    // Drag & Drop from Film Strip (Fix coordinates)
    dom.infiniteCanvas.ondragover = (e) => { e.preventDefault(); };
    dom.infiniteCanvas.ondrop = (e) => {
        e.preventDefault();
        const id = e.dataTransfer?.getData('text/plain');
        if (id) {
            const histItem = state.generatedHistory.find(h => h.id === id);
            const uploadItem = state.uploadedImages.find(u => u.id === id);
            const source = histItem ? histItem.base64 : (uploadItem ? uploadItem.base64 : null);
            
            if (source) {
                // Calculate drop position in World Coordinates
                const rect = dom.infiniteCanvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                const worldX = (mouseX - canvasOffsetX) / canvasScale;
                const worldY = (mouseY - canvasOffsetY) / canvasScale;
                
                addImageToCanvas(source, worldX, worldY);
            }
        }
    };

    // Touch Events
    dom.infiniteCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            initialPinchDistance = getPinchDistance(e.touches);
            initialScale = canvasScale;
        } else if (e.touches.length === 1) {
            e.preventDefault(); 
            handleStart(e.touches[0].clientX, e.touches[0].clientY, false, false);
        }
    }, { passive: false });

    dom.infiniteCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 2) {
            const dist = getPinchDistance(e.touches);
            const zoomFactor = dist / initialPinchDistance;
            const newScale = initialScale * zoomFactor;
            if (newScale > 0.1 && newScale < 5) {
                canvasScale = newScale;
                drawCanvas();
            }
        } else if (e.touches.length === 1) {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });

    dom.infiniteCanvas.addEventListener('touchend', handleEnd);
    
    // Wheel Zoom (Zoom toward mouse pointer)
    dom.infiniteCanvas.onwheel = (e) => { 
        e.preventDefault(); 
        const z = Math.exp((e.deltaY < 0 ? 1 : -1) * 0.1); 
        
        // Mouse position relative to canvas
        const rect = dom.infiniteCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        // Calculate offset adjustment to keep mouse point stable
        canvasOffsetX = mx - (mx - canvasOffsetX) * z;
        canvasOffsetY = my - (my - canvasOffsetY) * z;
        
        canvasScale *= z; 
        drawCanvas(); 
    };
    dom.infiniteCanvas.oncontextmenu = (e) => e.preventDefault();
}

function resizeCanvas() {
    dom.infiniteCanvas.width = window.innerWidth;
    dom.infiniteCanvas.height = window.innerHeight;
}

function getPinchDistance(touches: TouchList) {
    return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );
}

export function setCanvasTool(tool: 'pan' | 'generate') {
    state.canvasTool = tool;
    updateCanvasHUD();
    if (dom.canvasToolPan) {
        dom.canvasToolPan.classList.toggle('bg-blue-600', tool === 'pan');
        dom.canvasToolPan.classList.toggle('text-white', tool === 'pan');
        dom.canvasToolPan.classList.toggle('bg-gray-700', tool !== 'pan');
        dom.canvasToolPan.classList.toggle('text-gray-300', tool !== 'pan');
    }
    if (dom.canvasToolGenerate) {
        dom.canvasToolGenerate.classList.toggle('bg-purple-600', tool === 'generate');
        dom.canvasToolGenerate.classList.toggle('text-white', tool === 'generate');
        dom.canvasToolGenerate.classList.toggle('bg-gray-700', tool !== 'generate');
        dom.canvasToolGenerate.classList.toggle('text-gray-300', tool !== 'generate');
    }
    
    // Update cursor
    dom.infiniteCanvas.style.cursor = tool === 'generate' ? 'crosshair' : 'default';
}

export function updateCanvasHUD() {
    if (!dom.canvasHud) return;
    if (state.canvasTool === 'pan') {
        dom.canvasHud.innerHTML = "✋ <b>Move Mode:</b> Click to Select. Drag to Move. Drag images from bottom to import.";
    } else {
        dom.canvasHud.innerHTML = "✨ <b>Generate/Outpaint:</b> Draw a box. Overlap an image to extend it.";
    }
}

export function addImageToCanvas(base64: string, x: number, y: number) {
    const img = new Image();
    img.onload = () => {
        const aspect = img.width / img.height;
        const w = 300;
        const h = 300 / aspect;
        const newImg = {
            id: uuidv4(),
            base64: base64,
            x: x - w/2, // Center
            y: y - h/2,
            width: w,
            height: h,
            aspect,
            projectId: state.currentProjectId
        };
        state.canvasImages.push(newImg);
        db.saveCanvasImage(newImg);
        
        // Cache immediately
        imageCache.set(newImg.id, img);
        
        state.selectedCanvasImageId = newImg.id; // Auto select
        drawCanvas();
    };
    img.src = base64;
}

export function syncFromGallery() {
    const selected = state.uploadedImages.filter(i => i.selected);
    let added = false;
    
    // Start placing images in a grid if the canvas is empty-ish
    let startX = -((selected.length * 320) / 2);
    
    selected.forEach((img, idx) => {
        const exists = state.canvasImages.some(ci => ci.base64 === img.base64);
        if (!exists) {
            addImageToCanvas(img.base64, startX + (idx * 320), -150);
            added = true;
        }
    });
    
    if (added || state.canvasImages.length > 0) {
        setTimeout(fitContentToBounds, 100); // Small delay to let images load
    } else {
        resetCanvasView();
    }
}

// --- SMART CAMERA LOGIC ---

export function resetCanvasView() {
    if (state.canvasImages.length === 0) {
        // Reset to 0,0 if empty
        canvasScale = 1;
        canvasOffsetX = dom.infiniteCanvas.width / 2;
        canvasOffsetY = dom.infiniteCanvas.height / 2;
        drawCanvas();
    } else {
        fitContentToBounds();
    }
}

function fitContentToBounds() {
    if (state.canvasImages.length === 0) return;

    // 1. Calculate Bounding Box of all images
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.canvasImages.forEach(img => {
        minX = Math.min(minX, img.x);
        minY = Math.min(minY, img.y);
        maxX = Math.max(maxX, img.x + img.width);
        maxY = Math.max(maxY, img.y + img.height);
    });

    // 2. Determine Center of Content
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // 3. Calculate Scale to Fit (with padding)
    const padding = 100;
    const bottomOffset = 200; // Account for film strip height
    const screenW = dom.infiniteCanvas.width;
    const screenH = dom.infiniteCanvas.height - bottomOffset; 
    
    const scaleX = (screenW - padding * 2) / contentWidth;
    const scaleY = (screenH - padding * 2) / contentHeight;
    let targetScale = Math.min(scaleX, scaleY);
    
    // Clamp scale
    targetScale = Math.min(Math.max(targetScale, 0.2), 1.5);

    // 4. Center Camera
    canvasScale = targetScale;
    canvasOffsetX = (dom.infiniteCanvas.width / 2) - (contentCenterX * canvasScale);
    canvasOffsetY = ((dom.infiniteCanvas.height - bottomOffset) / 2) - (contentCenterY * canvasScale);

    drawCanvas();
}

export function deleteSelection() {
    if (state.selectedCanvasImageId) {
        const id = state.selectedCanvasImageId;
        state.canvasImages = state.canvasImages.filter(i => i.id !== id);
        db.deleteCanvasImage(id);
        state.selectedCanvasImageId = null;
        drawCanvas();
    } else {
        clearCanvas();
    }
}

export function clearCanvas() {
    if(confirm("Clear everything on the canvas?")) {
        state.canvasImages = [];
        state.selectedCanvasImageId = null;
        imageCache.clear();
        db.clearStore('canvas');
        drawCanvas();
    }
}

export function toggleCanvasHelp() {
    if(dom.canvasHelpCard) dom.canvasHelpCard.classList.toggle('hidden');
}

// --- EVENT HANDLERS ---

function handleStart(client_cx: number, client_cy: number, shift: boolean, right: boolean) {
    // If clicking toolbar or help, ignore
    if ((dom.canvasHelpCard && !dom.canvasHelpCard.classList.contains('hidden') && (dom.canvasHelpCard.contains(document.elementFromPoint(client_cx, client_cy))))) return;

    const rect = dom.infiniteCanvas.getBoundingClientRect();
    const cx = client_cx - rect.left;
    const cy = client_cy - rect.top;

    // World Coordinates
    const wx = (cx - canvasOffsetX) / canvasScale;
    const wy = (cy - canvasOffsetY) / canvasScale;

    if (state.canvasTool === 'generate' || shift) { 
        isSelectingRegion = true; 
        startX = cx; // Screen coords for selection box
        startY = cy; 
        return; 
    }
    
    if (right) { 
        isPanning = true; 
        startX = cx; 
        startY = cy; 
        return; 
    }

    // Hit Test (Reverse order for top-first)
    let found = false;
    for(let i=state.canvasImages.length-1; i>=0; i--) {
        const img = state.canvasImages[i];
        if(wx >= img.x && wx <= img.x+img.width && wy >= img.y && wy <= img.y+img.height) { 
            isDraggingImage = img.id; 
            state.selectedCanvasImageId = img.id; // SELECT IMAGE
            // Record offset from image origin
            startX = wx - img.x; 
            startY = wy - img.y; 
            found = true; 
            break; 
        }
    }
    
    if(!found) { 
        state.selectedCanvasImageId = null; // DESELECT if background clicked
        isPanning = true; 
        startX = cx; 
        startY = cy; 
    }
    drawCanvas();
}

function handleMove(client_cx: number, client_cy: number) {
    const rect = dom.infiniteCanvas.getBoundingClientRect();
    const cx = client_cx - rect.left;
    const cy = client_cy - rect.top;

    if(isSelectingRegion) { 
        selectionRegion = { 
            x: Math.min(startX, cx), 
            y: Math.min(startY, cy), 
            w: Math.abs(cx - startX), 
            h: Math.abs(cy - startY) 
        }; 
        drawCanvas(); 
        return; 
    }
    
    if(isPanning) { 
        canvasOffsetX += cx - startX; 
        canvasOffsetY += cy - startY; 
        startX = cx; 
        startY = cy; 
        drawCanvas(); 
        return; 
    }
    
    if(isDraggingImage) { 
        const img = state.canvasImages.find(i => i.id === isDraggingImage); 
        if(img) { 
            // Mouse is in Screen Coords
            // We want to place the image such that the click point relative to image remains constant
            // ImageX = MouseWorldX - OffsetX
            const wx = (cx - canvasOffsetX) / canvasScale;
            const wy = (cy - canvasOffsetY) / canvasScale;
            
            img.x = wx - startX; 
            img.y = wy - startY; 
            drawCanvas(); 
        } 
    }
}

function handleEnd() {
    if(isSelectingRegion) { 
        if(selectionRegion.w > 20 && selectionRegion.h > 20) { 
            drawCanvas(false); // Draw without overlay for capture
            promptGenerationForRegion(selectionRegion); 
        } 
        selectionRegion = { x:0,y:0,w:0,h:0 }; 
    }
    
    if(isDraggingImage) { 
        const img = state.canvasImages.find(i => i.id === isDraggingImage); 
        if(img) db.saveCanvasImage(img); 
    }
    
    isPanning = false; 
    isDraggingImage = null; 
    isSelectingRegion = false; 
    drawCanvas();
}

// --- RENDER ENGINE ---

export function drawCanvas(showOverlay = true) {
    const ctx = dom.infiniteCanvas.getContext('2d');
    if (!ctx) return;
    
    // Clear
    ctx.fillStyle = '#151515'; 
    ctx.fillRect(0, 0, dom.infiniteCanvas.width, dom.infiniteCanvas.height);
    
    ctx.save(); 
    
    // Apply Camera Transform
    ctx.translate(canvasOffsetX, canvasOffsetY); 
    ctx.scale(canvasScale, canvasScale);
    
    // 1. Draw Infinite Grid
    drawGrid(ctx);
    
    // 2. Draw Images (using Cache)
    state.canvasImages.forEach(img => { 
        // Check Cache
        let cacheImg = imageCache.get(img.id);
        
        if (!cacheImg) {
            // Load if missing
            cacheImg = new Image();
            cacheImg.src = img.base64;
            // Store immediately
            imageCache.set(img.id, cacheImg);
            
            // Redraw when ready
            cacheImg.onload = () => drawCanvas();
        }
        
        if (cacheImg.complete && cacheImg.naturalWidth > 0) {
            ctx.drawImage(cacheImg, img.x, img.y, img.width, img.height);
            
            // Draw Selection Border
            if (img.id === state.selectedCanvasImageId) {
                ctx.strokeStyle = '#3b82f6'; // Blue
                ctx.lineWidth = 4 / canvasScale;
                ctx.strokeRect(img.x, img.y, img.width, img.height);
            }
        } else {
            // Placeholder while loading
            ctx.fillStyle = '#333';
            ctx.fillRect(img.x, img.y, img.width, img.height);
            ctx.strokeStyle = '#555';
            ctx.strokeRect(img.x, img.y, img.width, img.height);
            ctx.fillStyle = '#aaa';
            ctx.font = '20px Arial';
            ctx.fillText('Loading...', img.x + 10, img.y + 30);
        }
    });
    
    ctx.restore();
    
    // 3. Draw Selection Overlay (Screen Space)
    if (isSelectingRegion && showOverlay) { 
        ctx.strokeStyle = '#9333ea'; 
        ctx.lineWidth = 2; 
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(selectionRegion.x, selectionRegion.y, selectionRegion.w, selectionRegion.h);
        ctx.fillStyle = 'rgba(147, 51, 234, 0.1)';
        ctx.fillRect(selectionRegion.x, selectionRegion.y, selectionRegion.w, selectionRegion.h);
        ctx.setLineDash([]);
    }

    // 4. Handle Empty State Visibility
    if (dom.canvasEmptyState) {
        if (state.canvasImages.length === 0) dom.canvasEmptyState.classList.remove('hidden');
        else dom.canvasEmptyState.classList.add('hidden');
    }
}

function drawGrid(ctx: CanvasRenderingContext2D) {
    // Calculate visible range to optimize drawing (only draw what's on screen)
    // Screen: 0 to width, 0 to height
    // World: (0 - offX)/scale to (width - offX)/scale
    
    const startX = (-canvasOffsetX / canvasScale) - 100;
    const startY = (-canvasOffsetY / canvasScale) - 100;
    const endX = ((dom.infiniteCanvas.width - canvasOffsetX) / canvasScale) + 100;
    const endY = ((dom.infiniteCanvas.height - canvasOffsetY) / canvasScale) + 100;
    
    const gridSize = 100;
    
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1 / canvasScale; // Keep lines sharp
    
    // Snap start to grid
    const firstLineX = Math.floor(startX / gridSize) * gridSize;
    const firstLineY = Math.floor(startY / gridSize) * gridSize;

    ctx.beginPath();
    for (let x = firstLineX; x <= endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
    }
    for (let y = firstLineY; y <= endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
    }
    ctx.stroke();
    
    // Axis Lines
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    if (startX <= 0 && endX >= 0) { ctx.moveTo(0, startY); ctx.lineTo(0, endY); }
    if (startY <= 0 && endY >= 0) { ctx.moveTo(startX, 0); ctx.lineTo(endX, 0); }
    ctx.stroke();
}

function captureRegion(rect: { x: number, y: number, w: number, h: number }): string | null {
    // Logic to determine if we are capturing existing content (Context Aware) or just blank space
    // Convert Rect (Screen) to World
    const wx = (rect.x - canvasOffsetX) / canvasScale;
    const wy = (rect.y - canvasOffsetY) / canvasScale;
    const ww = rect.w / canvasScale;
    const wh = rect.h / canvasScale;
    
    const overlap = state.canvasImages.some(img => (wx < img.x + img.width && wx + ww > img.x && wy < img.y + img.height && wy + wh > img.y));
    
    if (!overlap) return null;
    
    const ctx = dom.infiniteCanvas.getContext('2d');
    if (!ctx) return null;
    
    // Capture from canvas screen coordinates
    const data = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    const t = document.createElement('canvas'); 
    t.width = rect.w; 
    t.height = rect.h; 
    t.getContext('2d')?.putImageData(data, 0, 0);
    return t.toDataURL('image/png');
}

async function promptGenerationForRegion(rect: { x: number, y: number, w: number, h: number }) {
    const contextBase64 = captureRegion(rect);
    const mode = contextBase64 ? 'Outpainting' : 'Generation';
    
    // Use simple prompt for mobile/quick interaction
    const userPrompt = window.prompt(`${mode} Prompt:`);
    if(!userPrompt) return;
    
    // Center of new image in world coords
    const wx = (rect.x - canvasOffsetX) / canvasScale;
    const wy = (rect.y - canvasOffsetY) / canvasScale;
    const ww = rect.w / canvasScale;
    const wh = rect.h / canvasScale;

    // Show a small loading indicator on canvas if possible, or global status
    ui.startEvolution(15000); 
    
    const originalStatus = dom.exitCanvasBtn.innerHTML;
    dom.exitCanvasBtn.innerHTML = `Generating...`;
    dom.exitCanvasBtn.disabled = true;

    try {
        const p = state.projects.find(pr => pr.id === state.currentProjectId);
        const contextStyle = p && p.context ? ` [Style: ${p.context}]` : '';
        let parts: any[] = [];
        let sys = "";

        if (contextBase64) {
            parts.push({ inlineData: { mimeType: 'image/png', data: contextBase64.split(',')[1] } });
            parts.push({ text: `Seamlessly extend and blend: ${userPrompt}${contextStyle}` });
            sys = "Expert outpainting AI. Your goal is to extend the visual context seamlessly.";
        } else {
            parts.push({ text: `${userPrompt}${contextStyle}` });
            sys = "Generate high-quality image.";
        }

        const response = await AI.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: parts },
            systemInstruction: sys,
            config: { imageConfig: { aspectRatio: "1:1", imageSize: '2K' } }
        });
        
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
            const newCanvasImg = {
                id: uuidv4(),
                base64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                x: wx, y: wy, width: ww, height: wh, aspect: ww/wh,
                projectId: state.currentProjectId
            };
            state.canvasImages.push(newCanvasImg);
            db.saveCanvasImage(newCanvasImg);
            drawCanvas();
            
            // Also add to history for reuse
            import('./gallery').then(g => {
               g.addToHistory({ id: uuidv4(), base64: newCanvasImg.base64, prompt: `Canvas: ${userPrompt}`, timestamp: Date.now(), type: 'image', projectId: state.currentProjectId }, true);
            });
        }
    } catch(e: any) { console.error(e); alert("Generation Failed"); } 
    finally { 
        ui.stopEvolution();
        dom.exitCanvasBtn.innerHTML = originalStatus;
        dom.exitCanvasBtn.disabled = false;
        // Auto-switch back to pan tool after generation
        setCanvasTool('pan');
    }
}
