const fs = require('fs');
const path = 'packages/renderer/src/modules/files/FileDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add import
if (!content.includes("import { FileTree }")) {
    content = content.replace(
        "import { DetailRow } from './components/DetailRow';",
        "import { DetailRow } from './components/DetailRow';\nimport { FileTree } from './components/FileTree';"
    );
}

// Add FileTree below Locations
const searchLocations = `<div className="mt-8 mb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Locations</div>
                    <NavItem icon={Folder} label="All Files" onClick={() => setFilterType('all')} active={filterType === 'all'} />
                    <NavItem icon={Trash2} label="Trash" />`;

const replaceLocations = `<div className="mt-8 mb-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Locations</div>
                    <NavItem icon={Folder} label="All Files" onClick={() => setFilterType('all')} active={filterType === 'all'} />
                    <NavItem icon={Trash2} label="Trash" />
                    
                    <div className="mt-4 px-2">
                        <FileTree nodes={fileNodes} parentId={null} />
                    </div>`;

content = content.replace(searchLocations, replaceLocations);

// Let's also update the "Main Content" grid to optionally show folders or be dependent on a selected folder, 
// but for now, the existing displayNodes logic is okay if we just remove the `node.type !== 'folder'` exclusion so we can see folders in the grid view.
content = content.replace(
    "return matchesSearch && matchesFilter && node.type !== 'folder'; // Exclude folders for flat asset view, or keep them?",
    "return matchesSearch && matchesFilter; // Show folders in grid view"
);

fs.writeFileSync(path, content);
console.log("Updated FileDashboard.tsx");
