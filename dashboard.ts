
import * as dom from './dom';
import * as db from './db';
import * as router from './router';
import { state } from './state';
import * as ui from './ui';
import { v4 as uuidv4 } from 'uuid';

export async function renderProjectGrid() {
    if (!dom.projectGrid) return;
    dom.projectGrid.innerHTML = '';

    // Create New Project Card
    const createCard = document.createElement('div');
    createCard.className = 'aspect-video bg-[#1a1a1a] border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-[#222] transition-all group';
    createCard.innerHTML = `
        <div class="w-12 h-12 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="text-sm font-bold text-gray-400 group-hover:text-white">New Project</span>
    `;
    createCard.onclick = createNewProject;
    dom.projectGrid.appendChild(createCard);

    // Render Existing Projects
    const projects = await db.getSettings('projects') || [];
    
    for (const p of projects) {
        if(p.id === 'default') continue; // Optional: Hide default if unwanted

        const meta = await db.getProjectMetadata(p.id);
        const card = document.createElement('div');
        card.className = 'aspect-video bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all relative group';
        
        const thumb = meta.thumbnail 
            ? `<img src="${meta.thumbnail}" class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity">` 
            : `<div class="w-full h-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-gray-600 text-xs">No Assets</div>`;

        card.innerHTML = `
            ${thumb}
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
                <h3 class="text-white font-bold text-lg truncate">${p.name}</h3>
                <p class="text-xs text-gray-400">${meta.imageCount} Images • ${meta.videoCount} Videos</p>
            </div>
            <button class="delete-proj-btn absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all" title="Delete Project">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        
        card.onclick = (e) => {
            if((e.target as HTMLElement).closest('.delete-proj-btn')) return;
            openProject(p.id);
        };

        const delBtn = card.querySelector('.delete-proj-btn') as HTMLButtonElement;
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            if(confirm(`Delete project "${p.name}" and all its files?`)) {
                // In a real app, this would cascade delete from DB. 
                // For now, remove from project list.
                state.projects = state.projects.filter(pr => pr.id !== p.id);
                await db.saveSettings('projects', state.projects);
                renderProjectGrid();
            }
        };

        dom.projectGrid.appendChild(card);
    }
}

async function createNewProject() {
    const name = prompt("Project Name:");
    if (!name) return;
    
    const id = uuidv4();
    const newProj = { id, name, context: '' };
    
    state.projects.push(newProj);
    await db.saveSettings('projects', state.projects);
    
    openProject(id);
}

async function openProject(id: string) {
    // Save ID
    await db.saveSettings('currentProjectId', id);
    // Reload App State (triggering init logic in index.tsx via reload)
    window.location.reload(); 
}
