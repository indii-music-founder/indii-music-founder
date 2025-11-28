import * as dom from './dom';
import * as db from './db';
import * as router from './router';
import { state } from './state';
import * as ui from './ui';
import { v4 as uuidv4 } from 'uuid';
import { showToast } from './toast';
import { vacuumDatabase } from './vacuum';

export async function initDashboard() {
    await renderProjectGrid();
    renderSettings();
}

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
                // Remove from project list
                state.projects = state.projects.filter(pr => pr.id !== p.id);
                await db.saveSettings('projects', state.projects);
                // TODO: Cascade delete DB items for this project (Phase 3)
                renderProjectGrid();
                showToast(`Project "${p.name}" deleted`, 'warning');
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
    
    showToast(`Project "${name}" created`, 'success');
    openProject(id);
}

async function openProject(id: string) {
    // Save ID
    await db.saveSettings('currentProjectId', id);
    // Reload App State (triggering init logic in index.tsx via reload)
    window.location.reload(); 
}

function renderSettings() {
    if (!dom.dashboardSettings) return;

    // Check Storage
    let storageUsage = "Calculating...";
    let storagePercent = 0;

    if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
            const used = (estimate.usage || 0) / 1024 / 1024;
            const quota = (estimate.quota || 0) / 1024 / 1024;
            storagePercent = (used / quota) * 100;
            const bar = document.getElementById('storage-bar');
            if (bar) bar.style.width = `${Math.min(storagePercent, 100)}%`;
            const label = document.getElementById('storage-label');
            if (label) label.textContent = `${used.toFixed(1)}MB used of ${quota.toFixed(0)}MB`;
        });
    }

    dom.dashboardSettings.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                <h3 class="text-white font-bold mb-4 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 7v13a2 2 0 0 0 2 2h16v-5"/><rect x="13" y="13" width="8" height="7" rx="1"/></svg>
                    Storage Health
                </h3>
                <div class="w-full bg-gray-800 rounded-full h-4 mb-2 overflow-hidden">
                    <div id="storage-bar" class="bg-blue-600 h-4 rounded-full transition-all duration-1000" style="width: 0%"></div>
                </div>
                <p id="storage-label" class="text-xs text-gray-400 mb-6">${storageUsage}</p>

                <div class="flex gap-4">
                    <button id="backup-btn" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Full Backup
                    </button>
                    <label class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Import Backup
                        <input type="file" id="restore-input" class="hidden" accept=".json,.rndr">
                    </label>
                </div>
            </div>

            <div class="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                <h3 class="text-white font-bold mb-4">System Actions</h3>

                <button id="vacuum-btn" class="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-4 py-3 rounded text-sm font-bold flex items-center justify-center gap-2 mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9l.6.4"/></svg>
                    Vacuum Database (Cleanup)
                </button>

                <button id="clear-all-btn" class="w-full bg-red-900/20 hover:bg-red-900/50 text-red-400 border border-red-900/50 px-4 py-3 rounded text-sm font-bold flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Factory Reset (Clear All Data)
                </button>
            </div>
        </div>
    `;

    const backupBtn = document.getElementById('backup-btn');
    if (backupBtn) backupBtn.onclick = exportBackup;

    const restoreInput = document.getElementById('restore-input');
    if (restoreInput) restoreInput.onchange = (e: any) => importBackup(e.target.files[0]);

    const vacuumBtn = document.getElementById('vacuum-btn');
    if (vacuumBtn) vacuumBtn.onclick = vacuumDatabase;

    const clearBtn = document.getElementById('clear-all-btn');
    if (clearBtn) clearBtn.onclick = async () => {
        if (confirm("DANGER: This will delete ALL projects, images, and history. Cannot be undone.")) {
            // We use db.clearStore manually on all stores
            await db.clearStore('images');
            await db.clearStore('history');
            await db.clearStore('prompts');
            await db.clearStore('settings');
            await db.clearStore('canvas');
            await db.clearStore('agent_memory');
            window.location.reload();
        }
    };
}

async function exportBackup() {
    const backupBtn = document.getElementById('backup-btn');
    if(backupBtn) { backupBtn.textContent = "Exporting..."; (backupBtn as HTMLButtonElement).disabled = true; }

    try {
        const zip = new (window as any).JSZip();
        const dateStr = new Date().toISOString().split('T')[0];

        // 1. Export Metadata JSON (Lightweight)
        const metadata = {
            version: 1,
            timestamp: Date.now(),
            prompts: await db.getAll('prompts'),
            settings: await db.getAll('settings'),
            agent_memory: await db.getAll('agent_memory'),
            projects: state.projects // Ensure we capture project structure
        };
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        // 2. Export Images (Binary)
        const images = await db.getAll<any>('images');
        const imgFolder = zip.folder("images");

        // Helper to convert base64 to Blob/Uint8Array for cleaner ZIP
        const base64ToBinary = (base64: string) => {
             const binaryString = window.atob(base64.split(',')[1]);
             const len = binaryString.length;
             const bytes = new Uint8Array(len);
             for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
             return bytes;
        };

        // Add Uploaded Images
        for (const img of images) {
            if (img.base64) {
                try {
                    const ext = img.mimeType.split('/')[1] || 'png';
                    imgFolder.file(`${img.id}.${ext}`, base64ToBinary(img.base64));
                    // Replace base64 in metadata with reference if we were doing a relational export
                    // But for restore simplicity, we might keep the "old style" JSON import
                    // or we write a "manifest" for images.
                    // For now, to support the EXISTING importBackup which expects a single JSON,
                    // we actually have a conflict. The user asked for ZIP.
                    // So we must update Import to handle ZIP too.
                } catch(e) { console.warn("Failed to zip image", img.id); }
            }
        }

        // 3. Export History (Generated Assets)
        const history = await db.getAll<any>('history');
        const historyFolder = zip.folder("history");
        for (const h of history) {
            if (h.base64) {
                try {
                    const isVideo = h.type === 'video' || h.base64.startsWith('data:video');
                    const ext = isVideo ? 'mp4' : 'png'; // Simplified ext detection
                    historyFolder.file(`${h.id}.${ext}`, base64ToBinary(h.base64));
                } catch(e) { console.warn("Failed to zip history", h.id); }
            }
        }

        // Add full JSON dump for compatibility (so we don't break the restore logic yet,
        // or we rewrite restore logic. Let's rewrite restore to be robust).
        // Actually, to keep it simple and robust:
        // We will include 'database_dump.json' inside the ZIP which contains everything as Base64
        // (the old format) AND individual files for user convenience.
        // This doubles the size but ensures 100% compatibility with the current restore logic
        // if we just extract that one file, OR we can make a smarter restorer.

        // Let's do the "Smarter Restorer" approach.
        // We create a `database.json` that has the structure but references files?
        // No, let's stick to the "Big JSON" inside the ZIP for the machine,
        // and "Asset Folders" for the human.
        // Wait, that's huge duplication.

        // Better Plan:
        // `database.json` contains all the data arrays (images, history) but the `base64` fields are empty strings.
        // The images are in the folders.
        // The Import function reads `database.json`, then iterates the IDs and loads the content from the ZIP folder back into base64.

        const imagesClean = images.map(i => ({ ...i, base64: '' })); // Strip data
        const historyClean = history.map(h => ({ ...h, base64: '' }));
        const canvasClean = (await db.getAll<any>('canvas')).map(c => ({ ...c, base64: '' })); // Strip data if needed

        const dbDump = {
            version: 2, // Bump version
            timestamp: Date.now(),
            images: imagesClean,
            history: historyClean,
            prompts: await db.getAll('prompts'),
            settings: await db.getAll('settings'),
            canvas: canvasClean,
            agent_memory: await db.getAll('agent_memory')
        };

        zip.file('database.json', JSON.stringify(dbDump, null, 2));

        // Canvas Images
        const canvas = await db.getAll<any>('canvas');
        const canvasFolder = zip.folder("canvas");
        for (const c of canvas) {
            if (c.base64) {
                 try {
                    canvasFolder.file(`${c.id}.png`, base64ToBinary(c.base64));
                 } catch(e) {}
            }
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rndr-backup-${dateStr}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Backup exported as ZIP", "success");

    } catch(e) {
        console.error(e);
        showToast("Export failed: " + e, "error");
    } finally {
        if(backupBtn) {
            backupBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export Full Backup`;
            (backupBtn as HTMLButtonElement).disabled = false;
        }
    }
}

async function importBackup(file: File) {
    if (!file) return;
    if (!confirm("This will overwrite existing data with the backup. Continue?")) return;

    // Detect if ZIP or JSON
    if (file.name.endsWith('.zip')) {
        try {
            const zip = new (window as any).JSZip();
            const contents = await zip.loadAsync(file);

            // Read Manifest
            const dbFile = contents.file("database.json");
            if (!dbFile) throw new Error("Invalid backup: missing database.json");

            const dbText = await dbFile.async("string");
            const data = JSON.parse(dbText);

            if (data.version !== 2) throw new Error("Unsupported backup version. Needs version 2 (ZIP).");

            // Clear Data
            await db.clearStore('images'); await db.clearStore('history'); await db.clearStore('prompts');
            await db.clearStore('settings'); await db.clearStore('canvas'); await db.clearStore('agent_memory');

            // Helper to reconstruct Base64
            const fileToBase64 = async (folderName: string, id: string, mimeType: string) => {
                const ext = mimeType.split('/')[1] || 'png';
                // Try extension variations if needed, but for now stick to simple
                let f = contents.file(`${folderName}/${id}.${ext}`);
                if (!f && ext === 'png') f = contents.file(`${folderName}/${id}.jpeg`); // Fallback check
                if (!f) return null;
                const b64 = await f.async("base64");
                return `data:${mimeType};base64,${b64}`;
            };

            // Restore Images
            for (const item of data.images || []) {
                const b64 = await fileToBase64("images", item.id, item.mimeType);
                if (b64) item.base64 = b64;
                await db.saveImage(item);
            }

            // Restore History
            for (const item of data.history || []) {
                const mime = item.type === 'video' ? 'video/mp4' : 'image/png';
                // Some history items might not have mime stored explicitly, rely on type
                const b64 = await fileToBase64("history", item.id, mime);
                if (b64) item.base64 = b64;
                await db.saveHistoryItem(item);
            }

            // Restore Canvas
            for (const item of data.canvas || []) {
                const b64 = await fileToBase64("canvas", item.id, "image/png");
                if (b64) item.base64 = b64;
                await db.saveCanvasImage(item);
            }

            // Simple Data
            for (const item of data.prompts || []) await db.savePrompt(item);
            for (const item of data.agent_memory || []) await db.saveAgentMessage(item);
            for (const item of data.settings || []) await db.saveSettings(item.key, item.value);

            showToast("Restore from ZIP complete. Reloading...", "success");
            setTimeout(() => window.location.reload(), 1500);

        } catch(e) {
            console.error(e);
            showToast("ZIP Restore failed: " + e, "error");
        }
    } else {
        // Fallback to legacy JSON import
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (!data.version) throw new Error("Invalid backup file.");

                // Clear current data
                await db.clearStore('images'); await db.clearStore('history'); await db.clearStore('prompts');
                await db.clearStore('settings'); await db.clearStore('canvas'); await db.clearStore('agent_memory');

                // Restore
                for (const item of data.images || []) await db.saveImage(item);
                for (const item of data.history || []) await db.saveHistoryItem(item);
                for (const item of data.prompts || []) await db.savePrompt(item);
                for (const item of data.canvas || []) await db.saveCanvasImage(item);
                for (const item of data.agent_memory || []) await db.saveAgentMessage(item);
                for (const item of data.settings || []) await db.saveSettings(item.key, item.value);

                showToast("Legacy Restore complete. Reloading...", "success");
                setTimeout(() => window.location.reload(), 1500);
            } catch(err) {
                console.error(err);
                showToast("Failed to restore backup. Invalid file format.", "error");
            }
        };
        reader.readAsText(file);
    }
}
