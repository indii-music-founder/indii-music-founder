
import * as dom from './dom';
import { state } from './state';
import { AI } from './ai';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db';
import { SavedPrompt } from './types';

let tempSelectedPrompt: string | null = null;

export async function saveCurrentPrompt() {
    const text = dom.promptEl.value.trim();
    if (!text) { alert("Please enter a prompt text to save."); return; }
    const defaultTitle = text.split(' ').slice(0, 4).join(' ') + (text.split(' ').length > 4 ? '...' : '');
    const title = prompt("Enter a name for this prompt:", defaultTitle);
    if (title) {
        const newPrompt: SavedPrompt = { id: uuidv4(), text: text, title: title, date: Date.now() };
        state.savedPrompts.unshift(newPrompt);
        await db.savePrompt(newPrompt);
        const originalText = dom.savePromptBtn.innerHTML;
        dom.savePromptBtn.innerHTML = `<span class="text-green-400">Saved!</span>`;
        setTimeout(() => { dom.savePromptBtn.innerHTML = originalText; }, 1500);
    }
}

export function openPromptLibrary() {
    dom.promptLibraryModal.classList.remove('hidden');
    renderPromptLibrary();
}

export function renderPromptLibrary() {
    dom.promptList.innerHTML = '';
    if (state.savedPrompts.length === 0) {
        dom.promptList.innerHTML = '<p class="text-center text-gray-500 mt-10">No saved prompts yet.</p>';
        return;
    }
    state.savedPrompts.forEach(p => {
        const div = document.createElement('div');
        div.className = 'bg-[#1E1F20] border border-gray-700 rounded-lg p-3 hover:border-blue-500 transition-colors group';
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-white text-sm truncate pr-4">${p.title}</h4>
                <div class="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                     <button class="load-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">Load</button>
                     <button class="delete-btn text-xs bg-red-900/50 hover:bg-red-600 text-red-200 px-2 py-1 rounded">Delete</button>
                </div>
            </div>
            <p class="text-xs text-gray-400 line-clamp-2">${p.text}</p>
            <p class="text-[10px] text-gray-600 mt-1">${new Date(p.date).toLocaleDateString()}</p>
        `;
        div.querySelector('.load-btn')!.addEventListener('click', () => {
            dom.promptEl.value = p.text;
            dom.promptLibraryModal.classList.add('hidden');
        });
        div.querySelector('.delete-btn')!.addEventListener('click', async () => {
            if (confirm(`Delete "${p.title}"?`)) {
                state.savedPrompts = state.savedPrompts.filter(sp => sp.id !== p.id);
                await db.deletePrompt(p.id);
                renderPromptLibrary();
            }
        });
        dom.promptList.appendChild(div);
    });
}

export async function generateMagicWords() {
    const current = dom.promptEl.value.trim();
    
    const btn = dom.magicBtn;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
        <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span class="animate-pulse">Conjuring...</span>
    `;

    try {
        const response = await AI.generateContent({
            model: 'gemini-3-pro-preview',
            contents: current ? `Enhance: "${current}"` : "Generate 8 artistic adjectives.",
            systemInstruction: "Return a simple comma-separated list of 6-8 descriptive adjectives. Do not use Markdown. Do not use JSON.",
            config: { temperature: 1.0 }
        });
        let words = (response.text || '').replace(/```[\s\S]*?```/g, '').replace(/[\{\}\[\]"]/g, '').trim();
        if (words) dom.promptEl.value = current + (current ? ', ' : '') + words;
    } catch(e: any) { 
        console.error(e); 
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

export async function openPromptImprover(overridePrompt?: string) {
    const current = overridePrompt || dom.promptEl.value;
    if(!current) return;
    
    dom.improverModal.classList.remove('hidden');
    dom.improverContent.classList.add('hidden');
    dom.improverLoading.classList.remove('hidden');
    dom.originalPromptDisplay.textContent = current;
    dom.acceptImprovementBtn.disabled = true;
    tempSelectedPrompt = null;
    
    try {
        const systemInstruction = `You are an Expert Image Prompt Engineer. Transform the conceptual idea into a six-part comprehensive visual script (Intent, Subject, Environment, Lighting, Technical, Composition). Generate 4 distinct variations (e.g. Cinematic, Artistic, Realistic, Abstract). Return strictly JSON: { "variations": [{ "title": "...", "text": "..." }] }`;
        const response = await AI.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: `Original Concept: "${current}"`,
            systemInstruction,
            config: { responseMimeType: 'application/json' }
        });
        const data = AI.parseJSON(response.text);
        dom.improverLoading.classList.add('hidden');
        dom.improverContent.classList.remove('hidden');
        const grid = document.getElementById('improver-options-grid');
        if(grid) {
            grid.innerHTML = '';
            data.variations.forEach((v: any) => {
                const card = document.createElement('div');
                card.className = 'relative p-3 border border-gray-700 rounded bg-[#252628] hover:border-blue-500 cursor-pointer flex flex-col gap-2 transition-all group';
                
                // Header with Title and Refine Button
                const header = document.createElement('div');
                header.className = 'flex justify-between items-center';
                header.innerHTML = `<h4 class="text-blue-400 font-bold text-xs uppercase tracking-wider">${v.title}</h4>`;
                
                const refineBtn = document.createElement('button');
                refineBtn.className = 'text-[10px] bg-purple-900/30 text-purple-400 hover:bg-purple-600 hover:text-white px-2 py-1 rounded transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1';
                refineBtn.innerHTML = '✨ Refine';
                refineBtn.title = "Generate new variations based on this option";
                
                header.appendChild(refineBtn);
                card.appendChild(header);

                // Editable Text Area
                const textarea = document.createElement('textarea');
                textarea.className = 'w-full bg-[#1a1b1d] text-gray-300 text-xs resize-none outline-none h-24 custom-scrollbar border border-gray-700 focus:border-blue-500 rounded p-2 transition-colors';
                textarea.value = v.text;
                card.appendChild(textarea);

                // Refine Logic
                refineBtn.onclick = (e) => {
                    e.stopPropagation();
                    openPromptImprover(textarea.value); // Recursive call with new context
                };

                // Selection Logic
                const selectCard = () => {
                     tempSelectedPrompt = textarea.value;
                     dom.acceptImprovementBtn.disabled = false;
                     Array.from(grid.children).forEach(c => c.classList.remove('ring-2', 'ring-blue-500', 'bg-gray-800'));
                     card.classList.add('ring-2', 'ring-blue-500', 'bg-gray-800');
                };

                textarea.onfocus = selectCard;
                textarea.oninput = () => {
                    tempSelectedPrompt = textarea.value;
                };
                
                card.onclick = (e) => {
                    if(e.target !== textarea && e.target !== refineBtn) {
                        textarea.focus();
                        selectCard();
                    }
                };
                
                grid.appendChild(card);
            });
        }
    } catch(e: any) { console.error(e); closeImproverModal(); }
}

export function closeImproverModal() { 
    dom.improverModal.classList.add('hidden'); 
    tempSelectedPrompt = null;
}

export function applyImprovedPrompt() { 
    if (tempSelectedPrompt) {
        dom.promptEl.value = tempSelectedPrompt;
    }
    closeImproverModal(); 
}
