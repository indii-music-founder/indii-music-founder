
import * as dom from './dom';
import { AI } from './ai';
import { state } from './state';
import * as ui from './ui';
import * as imageLogic from './image';
import * as videoLogic from './video';
import * as gallery from './gallery';
import * as db from './db';
import * as lightbox from './lightbox';
import * as promptLogic from './prompt';
import { v4 as uuidv4 } from 'uuid';
import * as utils from './utils';
import * as canvasLogic from './canvas';
import * as memory from './agent_memory';
import { showToast } from './toast';

let isProcessing = false;

const BASE_TOOLS = `
AVAILABLE TOOLS:
1. set_mode(mode: string) - Switch studio mode. Values: 'generate', 'edit', 'video', 'canvas', 'remix', 'showroom'.
2. update_prompt(text: string) - Write text into the main prompt box.
3. generate_image(count: number, aspect_ratio: string) - Click the generate button. Aspect ratios: "1:1", "16:9", "9:16".
4. generate_video(prompt: string) - Switch to video mode and generate a video (uses current submode).
5. read_history() - Get a summary of the last 5 generated items.
6. select_history_item(index: number) - Select an item from history (0 is newest) to use as context.
7. save_bible_context(context: string) - Update the Show Bible context rules.
8. configure_studio(settings: { directors_cut?: boolean, story_chain?: boolean, resolution?: string, image_count?: number, seed?: number }) - Toggle switches and dropdowns. Valid resolutions: '1K', '2K', '4K'. Set seed to -1 for Random.
9. apply_style_to_selection(style_source_index: number, prompt_override?: string) - Take the style from a history item (by index) and apply it to ALL currently selected images in the gallery.
10. verify_output(history_id: string, goal: string) - Self-Reflection. Critique the generated item against the user goal.
11. request_approval(content: string, type: string) - Pause and ask user to approve TEXT content.
12. request_visual_approval(history_id: string) - Pause and show the generated IMAGE to the user for sign-off.
13. run_motion_brush(image_index: number) - Run Motion Brush on a history item (requires mask).
14. export_reel() - Stitch video history into a movie file.
15. improve_prompt(concept: string) - Consult the Prompt Improver to expand a concept.
16. delete_history_item(index: number) - Delete a bad generation from history.
17. set_video_submode(mode: string) - Select video engine. Values: 'draft', 'showrunner', 'reel', 'music', 'motion', 'keyframe'.
18. assign_asset_slot(history_id: string, slot: string) - Put an image into a specific slot. Slots: 'remix_content', 'remix_style', 'showroom_asset'.
19. set_story_time_delta(value: number) - Set Story Chain slider (0-100).
20. add_to_canvas(history_id: string, x?: number, y?: number) - Place a history image onto the infinite canvas.
21. save_memory(content: string, type: string) - Save a fact, rule, or summary to long-term memory. Type: 'fact' | 'rule'.
22. recall_memories(query: string) - Search long-term memory for info.
`;

const PERSONA_DEFINITIONS: Record<string, string> = {
    GENERALIST: `You are Agent R, the Autonomous Studio Manager. Generalist: video, image, text ops. Respect settings unless overriding.`,
    ARCHITECT: `You are Agent R, Senior Architectural Visualizer. Focus: batch_style_transfer, 4K, 16:9, consistent geometry.`,
    FASHION: `You are Agent R, Digital Fashion Stylist. Focus: 9:16, fabric textures, social media.`,
    DIRECTOR: `You are Agent R, Creative Director. Focus: Cohesive video, Director's Cut, Show Bible consistency.`
};

function detectPersona(): string {
    const p = state.projects.find(p => p.id === state.currentProjectId);
    const ctx = ((p?.name || "") + " " + (p?.context || "")).toLowerCase();
    if (ctx.match(/house|building|arch/)) return 'ARCHITECT';
    if (ctx.match(/fashion|dress|wear/)) return 'FASHION';
    if (ctx.match(/movie|film|story/)) return 'DIRECTOR';
    return 'GENERALIST';
}

function getProjectVisualContext(): string {
    // Get last 3 generated items to give Agent awareness of recent visual style
    const recent = state.generatedHistory.slice(0, 3).map(h => `[${h.type.toUpperCase()}] "${h.prompt}"`).join('; ');
    return recent ? `RECENT VISUAL HISTORY: ${recent}` : "";
}

// --- TOOL REGISTRY ---
const TOOL_REGISTRY: Record<string, (args: any) => Promise<string | void> | string | void> = {
    set_mode: (args) => {
        if (['generate', 'edit', 'video', 'canvas', 'remix', 'showroom'].includes(args.mode)) {
            ui.setMode(args.mode);
            return `Switched to ${args.mode} mode.`;
        }
        return `Invalid mode: ${args.mode}`;
    },
    update_prompt: (args) => { dom.promptEl.value = args.text; return `Prompt updated.`; },
    generate_image: async (args) => {
        if (args.aspect_ratio) dom.aspectRatioEl.value = args.aspect_ratio;
        if (args.count) dom.generationCountEl.value = args.count.toString();
        if (state.currentMode !== 'generate' && state.currentMode !== 'edit') ui.setMode('generate');
        const id = await imageLogic.generateImages();
        return id ? `Image generated: ${id}` : "Generation initiated.";
    },
    generate_video: async (args) => {
        ui.setMode('video');
        dom.promptEl.value = args.prompt;
        const id = await videoLogic.runDirectVideo();
        return id ? `Video generated: ${id}` : "Video failed.";
    },
    read_history: () => {
        return state.generatedHistory.slice(0, 5).map((h, i) => `[${i}] ID:${h.id} (${h.type}): ${h.prompt.substring(0, 50)}...`).join('\n') || "History empty.";
    },
    select_history_item: (args) => {
        const item = state.generatedHistory[args.index];
        if (!item) return "Item not found.";
        state.activeHistoryId = item.id;
        import('./lightbox').then(m => m.renderFilmStrip());
        return `Selected item ${args.index} (ID: ${item.id}).`;
    },
    save_bible_context: (args) => {
        const p = state.projects.find(pr => pr.id === state.currentProjectId);
        if (p) { p.context = args.context; db.saveSettings('projects', state.projects); return "Bible updated."; }
        return "No project.";
    },
    configure_studio: (args) => {
        const out = [];
        if (args.directors_cut !== undefined) { dom.directorsCutToggle.checked = args.directors_cut; out.push(`DC:${args.directors_cut}`); }
        if (args.story_chain !== undefined && dom.storyChainCheckbox) { dom.storyChainCheckbox.checked = args.story_chain; out.push(`Chain:${args.story_chain}`); }
        if (args.resolution) { dom.resolutionEl.value = args.resolution; out.push(`Res:${args.resolution}`); }
        if (args.image_count) { dom.generationCountEl.value = args.image_count.toString(); out.push(`Count:${args.image_count}`); }
        if (args.seed !== undefined) { dom.seedInput.value = args.seed === -1 ? "" : args.seed.toString(); out.push(`Seed:${args.seed}`); }
        return `Configured: ${out.join(', ')}`;
    },
    apply_style_to_selection: async (args) => {
        const src = state.generatedHistory[args.style_source_index];
        const tgts = state.uploadedImages.filter(i => i.selected);
        if (!src || !tgts.length) return "Invalid source or no selection.";
        await imageLogic.runBatchRemix(src, tgts, args.prompt_override);
        return `Batch applied to ${tgts.length} images.`;
    },
    verify_output: async (args) => {
        const item = state.generatedHistory.find(h => h.id === args.history_id);
        if (!item) return "Item not found.";
        const content: any = [{ text: `Goal: "${args.goal}". Rate 1-10. If <7 explain.` }];
        content.push(item.type === 'video' ? { text: "[Video]" } : { inlineData: { mimeType: 'image/png', data: item.base64.split(',')[1] } });
        const res = await AI.generateContent({ model: 'gemini-3-pro-preview', contents: { parts: content }, config: { responseMimeType: 'application/json' } });
        const data = AI.parseJSON(res.text);
        return JSON.stringify({ pass: data.score >= 7, reason: data.reason });
    },
    request_approval: (args) => new Promise(res => {
        dom.agentApprovalModal.classList.remove('hidden');
        dom.approvalImageContainer.classList.add('hidden');
        dom.approvalContent.value = args.content;
        dom.approvalApproveBtn.onclick = () => { dom.agentApprovalModal.classList.add('hidden'); res(`Approved: "${dom.approvalContent.value}"`); };
        dom.approvalRejectBtn.onclick = () => { dom.agentApprovalModal.classList.add('hidden'); res("Rejected"); };
    }),
    request_visual_approval: (args) => {
        const item = state.generatedHistory.find(h => h.id === args.history_id);
        if (!item) return Promise.resolve("Item not found");
        return new Promise(res => {
            dom.agentApprovalModal.classList.remove('hidden');
            dom.approvalImageContainer.classList.remove('hidden');
            dom.approvalImage.src = item.base64;
            dom.approvalContent.value = "Visual Check";
            dom.approvalApproveBtn.onclick = () => { dom.agentApprovalModal.classList.add('hidden'); res(JSON.stringify({ status: "approved" })); };
            dom.approvalRejectBtn.onclick = () => { dom.agentApprovalModal.classList.add('hidden'); res(JSON.stringify({ status: "rejected" })); };
        });
    },
    run_motion_brush: async (args) => {
        if (state.currentMode === 'video' && dom.motionBrushRadio.checked) { await videoLogic.runMotionBrush(); return "Motion Brush running."; }
        return "Enable Motion Brush mode first.";
    },
    export_reel: async () => { await lightbox.exportReel(); return "Export started."; },
    improve_prompt: () => "Use update_prompt directly.",
    delete_history_item: (args) => "Deletion simulated.",
    set_video_submode: (args) => {
        const map: any = { 'draft': dom.draftModeRadio, 'showrunner': dom.agentModeRadio, 'reel': dom.infiniteReelRadio, 'music': dom.musicModeRadio, 'motion': dom.motionBrushRadio, 'keyframe': dom.keyframeModeRadio };
        if (map[args.mode]) { map[args.mode].checked = true; map[args.mode].dispatchEvent(new Event('change')); return `Submode: ${args.mode}`; }
        return "Invalid submode.";
    },
    assign_asset_slot: (args) => {
        const item = state.generatedHistory.find(h => h.id === args.history_id);
        if (!item || item.type !== 'image') return "Invalid item.";
        const asset = { base64: item.base64, mimeType: 'image/png', width: 1024, height: 1024 };
        if (args.slot === 'remix_content') { state.remixContent = asset; dom.remixContentPreview.src = asset.base64; dom.remixContentPreview.classList.remove('hidden'); }
        else if (args.slot === 'remix_style') { state.remixStyle = asset; dom.remixStylePreview.src = asset.base64; dom.remixStylePreview.classList.remove('hidden'); }
        else if (args.slot === 'showroom_asset') { state.showroomAsset = asset; dom.showroomAssetPreview.src = asset.base64; dom.showroomAssetPreview.classList.remove('hidden'); }
        return `Assigned to ${args.slot}.`;
    },
    set_story_time_delta: (args) => {
        if (!dom.consistencySlider) return "No slider.";
        dom.consistencySlider.value = Math.max(0, Math.min(100, args.value)).toString();
        dom.consistencySlider.dispatchEvent(new Event('input'));
        return `Time Delta: ${args.value}`;
    },
    add_to_canvas: (args) => {
        const item = state.generatedHistory.find(h => h.id === args.history_id);
        if (item && item.type === 'image') { canvasLogic.addImageToCanvas(item.base64, args.x || 0, args.y || 0); return "Added to canvas."; }
        return "Invalid item.";
    },
    save_memory: async (args) => {
        await memory.saveMemory(state.currentProjectId, args.content, args.type || 'fact');
        showToast("Memory saved", "success");
        return "Memory saved.";
    },
    recall_memories: async (args) => {
        const mems = await memory.retrieveRelevantMemories(state.currentProjectId, args.query);
        return mems.length ? `MEMORIES FOUND:\n${mems.join('\n')}` : "No relevant memories found.";
    }
};

const SCHEMAS: {[key: string]: any} = {
    generate_image: { count: 'number' },
    set_mode: { mode: 'string' },
    save_memory: { content: 'string' },
    recall_memories: { query: 'string' }
};

async function executeTool(toolName: string, args: any): Promise<string> {
    console.log(`[AgentR] Executing ${toolName}`, args);

    // Schema Validation (Lightweight)
    if (SCHEMAS[toolName]) {
        const res = memory.validateSchema(args, SCHEMAS[toolName]);
        if (!res.valid) {
            const err = `Validation Error: ${res.error}`;
            showToast(err, 'error');
            return err;
        }
    }

    const tool = TOOL_REGISTRY[toolName];
    if (tool) {
        try {
            const res = await tool(args);
            return res ? res.toString() : "Done.";
        } catch (e: any) { return `Error: ${e.message}`; }
    }
    return `Unknown tool: ${toolName}`;
}

// --- REACT LOOP ---

export async function runAgentLoop(userGoal: string, attachedImages?: { mimeType: string, base64: string }[]) {
    if (isProcessing) return;
    isProcessing = true;
    
    await addMessage('user', userGoal, attachedImages);
    renderChat();
    
    dom.agentSendBtn.disabled = true;
    dom.agentInput.disabled = true;

    const persona = detectPersona();
    const visualCtx = getProjectVisualContext();
    const systemPrompt = `${PERSONA_DEFINITIONS[persona]}\n${BASE_TOOLS}\n${visualCtx}\nRULES:\n1. Use tools via JSON.\n2. Output format: { "thought": "...", "tool": "...", "args": {} }\n3. Or { "final_response": "..." }`;

    try {
        let iterations = 0;
        let currentInput = userGoal;

        while (iterations < 10) {
            const parts: any[] = [];
            state.agentHistory.forEach(msg => {
                if (msg.role === 'user' && msg.attachments) {
                    msg.attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64.split(',')[1] } }));
                }
                parts.push({ text: `${msg.role.toUpperCase()}: ${msg.text}` });
            });
            parts.push({ text: `${systemPrompt}\n\nLast Input: ${currentInput}\nNext Step (JSON):` });

            await addMessage('system', iterations === 0 ? `Thinking (${persona})...` : 'Thinking...');
            renderChat();
            
            const res = await AI.generateContent({ model: 'gemini-3-pro-preview', contents: { parts }, config: { responseMimeType: 'application/json' } });
            const result = AI.parseJSON(res.text);
            state.agentHistory.pop(); // Remove "Thinking..."

            if (result.final_response) { await addMessage('model', result.final_response); break; }
            if (result.tool) {
                await addMessage('model', `⚙️ ${result.tool}`);
                renderChat();
                const output = await executeTool(result.tool, result.args);
                await addMessage('system', `Output: ${output}`);

                // Auto-Reflection Logic
                if (result.tool === 'generate_image') {
                    currentInput = `Tool ${result.tool} Output: ${output}. \nCRITICAL STEP: Critique the generated image against the user's goal. If it's bad, plan a retry. If good, confirm.`;
                } else {
                    currentInput = `Tool ${result.tool} Output: ${output}. Continue.`;
                }
            }
            iterations++;
        }
    } catch (e: any) { await addMessage('system', `Error: ${e.message}`); } 
    finally { isProcessing = false; dom.agentSendBtn.disabled = false; dom.agentInput.disabled = false; dom.agentInput.focus(); renderChat(); }
}

async function addMessage(role: 'user' | 'model' | 'system', text: string, attachments?: { mimeType: string, base64: string }[]) {
    const msg: any = { id: uuidv4(), role, text, projectId: state.currentProjectId, timestamp: Date.now(), attachments };
    state.agentHistory.push(msg);
    await db.saveAgentMessage(msg);
}

export function renderChat() {
    if (!dom.agentChatContainer) return;
    dom.agentChatContainer.innerHTML = '';
    const greet = document.createElement('div');
    greet.innerHTML = `<div class="flex gap-2"><div class="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-[10px] font-bold">AR</div><div class="bg-[#1a1a1a] p-2 rounded-lg text-xs text-gray-300 border border-gray-800">I am Agent R (v2.3).</div></div>`;
    dom.agentChatContainer.appendChild(greet);

    state.agentHistory.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'flex gap-2 mb-2 ' + (msg.role === 'user' ? 'justify-end' : '');
        let attHtml = msg.attachments?.map(a => `<img src="${a.base64}" class="h-12 border border-gray-600">`).join('') || '';
        if (attHtml) attHtml = `<div class="flex gap-1 mt-1">${attHtml}</div>`;
        
        if (msg.role === 'user') div.innerHTML = `<div class="bg-blue-900/30 p-2 rounded-lg text-xs text-blue-100 border border-blue-800 max-w-[80%]">${msg.text}${attHtml}</div>`;
        else if (msg.role === 'model') div.innerHTML = `<div class="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-[10px] flex-shrink-0 font-bold">AR</div><div class="bg-[#1a1a1a] p-2 rounded-lg text-xs text-gray-300 border border-gray-800 max-w-[90%]">${msg.text}</div>`;
        else div.innerHTML = `<div class="w-full text-center text-[10px] text-gray-600 italic animate-pulse">${msg.text}</div>`;
        dom.agentChatContainer.appendChild(div);
    });
    dom.agentChatContainer.scrollTop = dom.agentChatContainer.scrollHeight;
}

// --- INIT & DRAG ---
function makeDraggable(el: HTMLElement) {
    const h = el.querySelector('.bg-\\[\\#1a1a1a\\]') as HTMLElement;
    if(!h) return;
    h.onmousedown = (e) => {
        e.preventDefault();
        let startX = e.clientX, startY = e.clientY;
        document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; db.saveSettings('agentWindowPos', { top: el.style.top, left: el.style.left }); };
        document.onmousemove = (mv) => {
            el.style.top = (el.offsetTop - (startY - mv.clientY)) + "px";
            el.style.left = (el.offsetLeft - (startX - mv.clientX)) + "px";
            startX = mv.clientX; startY = mv.clientY;
        };
    };
}

export async function handleAgentFileUpload(files: File[]) {
    const attachments = await Promise.all(files.map(async f => ({ mimeType: f.type, base64: await utils.fileToBase64(f) })));
    if (attachments.length) {
        await addMessage('user', `[Uploaded ${attachments.length} files]`, attachments);
        renderChat();
        runAgentLoop("Analyze uploaded files.");
    }
}

export async function initAgentZero() {
    const pos = await db.getSettings('agentWindowPos');
    if (pos && dom.agentWindow) { dom.agentWindow.style.top = pos.top; dom.agentWindow.style.left = pos.left; }
    else if (dom.agentWindow) { dom.agentWindow.style.top = '80px'; dom.agentWindow.style.left = '16px'; }
    if (dom.agentWindow) { makeDraggable(dom.agentWindow); }
    
    // Note: Event listener for toggling window is handled in index.tsx
    // The below was redundant with index.tsx and causing potential conflicts if multiple listeners
    // if (dom.modeAgentBtn) dom.modeAgentBtn.onclick = () => { dom.agentWindow.classList.toggle('hidden'); renderChat(); };

    const send = () => { const t = dom.agentInput.value.trim(); if(t) { dom.agentInput.value=''; runAgentLoop(t); } };
    if (dom.agentSendBtn) dom.agentSendBtn.onclick = send;
    if (dom.agentInput) dom.agentInput.onkeydown = (e) => { if(e.key === 'Enter') send(); };
    if (dom.agentMinimizeBtn) dom.agentMinimizeBtn.onclick = () => dom.agentChatContainer.classList.toggle('hidden');
    if (dom.agentCloseBtn) dom.agentCloseBtn.onclick = () => dom.agentWindow.classList.add('hidden');
    if (dom.agentClearBtn) dom.agentClearBtn.onclick = () => { if(confirm("Clear memory?")) { state.agentHistory = []; db.clearProjectAgentMemory(state.currentProjectId); renderChat(); } };
    if (dom.agentUploadBtn) dom.agentUploadBtn.onclick = () => dom.agentFileInput.click();
    if (dom.agentFileInput) dom.agentFileInput.onchange = (e: any) => { if(e.target.files?.length) handleAgentFileUpload(Array.from(e.target.files)); };
}
