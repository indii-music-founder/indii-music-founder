# Desktop File Browser Tool Design

**Status:** Design Phase (ISSUE-1044)  
**Goal:** Enable cloud agents to search and reference files from the desktop's local file system  
**Scope:** Mobile remote can ask desktop agents to find creative assets

---

## Problem

**Current State:** Cloud agents (Gemini) cannot access the desktop's local file system. When a user asks via phone remote to "find the font logo in photos," the agent cannot browse local folders.

**Gap:** The mobile relay works for chat/commands but not for asset discovery.

**Solution:** Create a bidirectional file browser tool that exposes whitelisted desktop folders to cloud agents.

---

## Architecture Overview

```
Phone Remote (User)
    ↓ "Find font logo in photos"
Cloud Agent (Gemini, Firebase Function)
    ↓ calls browse_local_files(path, filter)
File Browser Tool (Cloud-side)
    ↓ calls Desktop IPC or Firestore Index
Desktop File Service (Electron Main)
    ↓ scans local folder, returns file list
Firestore File Index (optional cache)
    ↓ stores metadata for fast queries
Cloud Agent
    ↓ presents matches to phone
Phone Remote
    ↓ user selects file / agent uses it
```

---

## Two Implementation Paths

### Path A: Real-Time IPC Bridge (Recommended for Speed)

**Desktop Side:**
```typescript
// packages/main/src/ipc/fileServerIPC.ts
ipcMain.handle('browse-files', async (event, args) => {
  const { folderPath, filter, limit = 20 } = args;
  
  // Validate path is whitelisted
  if (!isWhitelistedFolder(folderPath)) {
    throw new Error('Folder not whitelisted');
  }
  
  const files = await scanFolder(folderPath, filter, limit);
  return files.map(f => ({
    name: f.name,
    path: f.relativePath,
    size: f.size,
    modifiedAt: f.mtime.toISOString(),
    type: getFileType(f),
  }));
});
```

**Cloud Side (Cloud Function):**
```typescript
// packages/firebase/src/relay/desktopFileBrowser.ts
export const browseLocalFiles = async (
  context: functions.https.CallableContext,
  params: { folderPath: string; filter: string; limit?: number }
) => {
  const userId = context.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Not signed in');
  
  // For cloud-only or web: query Firestore index
  // For Electron: invoke IPC (requires session ID routing)
  
  // Query Firestore file index
  const snapshot = await admin.firestore()
    .collection('users').doc(userId)
    .collection('file-index')
    .where('folder', '==', folderPath)
    .where('matchesFilter', '==', true)
    .limit(params.limit || 20)
    .get();
  
  return snapshot.docs.map(d => d.data());
};
```

**Pros:**
- Real-time, instant results
- No network latency
- Desktop always in control

**Cons:**
- Requires IPC bridge (Electron-only, not web)
- Complex session routing (which desktop instance?)

---

### Path B: Firestore File Index (Recommended for Scalability)

**Desktop Side (Periodic Sync):**
```typescript
// packages/renderer/src/services/desktop/DesktopFileIndexService.ts
class DesktopFileIndexService {
  async indexFolder(folderPath: string, options?: { recursive: boolean }) {
    const whitelisted = ['Photos', 'Projects', 'Downloads', 'Creative'];
    if (!whitelisted.some(w => folderPath.includes(w))) {
      throw new Error('Folder not whitelisted');
    }
    
    const files = await scanFolder(folderPath, options);
    
    // Write to Firestore
    const batch = writeBatch(db);
    files.forEach(f => {
      const docRef = doc(db, 'users', userId, 'file-index', 
        `${folderPath}-${f.name.replace(/[^\w-]/g, '_')}`);
      batch.set(docRef, {
        folder: folderPath,
        name: f.name,
        path: f.relativePath,
        size: f.size,
        modifiedAt: serverTimestamp(),
        type: getFileType(f),
        indexed: serverTimestamp(),
      });
    });
    
    await batch.commit();
  }
}
```

**Cloud Side (Query Index):**
```typescript
export const browseLocalFiles = async (
  context: functions.https.CallableContext,
  params: { folderPath: string; filter?: string; limit?: number }
) => {
  const userId = context.auth?.uid;
  
  let query = admin.firestore()
    .collection('users').doc(userId)
    .collection('file-index')
    .where('folder', '==', folderPath);
  
  if (params.filter) {
    // Simple filter: *.png → match extension
    const ext = params.filter.split('.').pop();
    query = query.where('name', '>=', `.${ext}`);
  }
  
  query = query.orderBy('name').limit(params.limit || 20);
  
  const snapshot = await query.get();
  return snapshot.docs.map(d => d.data());
};
```

**Pros:**
- Works everywhere (Electron, web, mobile)
- Scalable (Firestore index)
- Offline-capable (cached locally)

**Cons:**
- Slight delay between desktop changes and cloud visibility
- Storage overhead

---

## Agent Tool Definition

```typescript
// packages/firebase/src/relay/agentTools.ts
const BROWSE_LOCAL_FILES_TOOL = {
  name: 'browse_local_files',
  description: 'Search for files in the user\'s local desktop folders (Photos, Projects, Downloads, Creative Cache)',
  inputSchema: {
    type: 'object',
    properties: {
      folder: {
        type: 'string',
        description: 'Folder to search: "Photos", "Projects", "Downloads", or "Creative"',
        enum: ['Photos', 'Projects', 'Downloads', 'Creative'],
      },
      filter: {
        type: 'string',
        description: 'File pattern (e.g., "*.png", "*.psd", "font*")',
      },
      limit: {
        type: 'number',
        description: 'Max results (default 20, max 100)',
        default: 20,
      },
    },
    required: ['folder'],
  },
};
```

**Agent Usage:**
```
User: "Find the font logo in my photos folder"

Agent thinks: "I should search the Photos folder for files matching 'font' or 'logo'"

Agent calls: browse_local_files({ folder: 'Photos', filter: 'font*' })

Result: [
  { name: 'font-guide.pdf', size: 2.4, type: 'pdf', modifiedAt: '2026-07-10T...' },
  { name: 'font-logo-v2.png', size: 1.8, type: 'image', modifiedAt: '2026-07-09T...' },
  { name: 'font-logo-v1.png', size: 2.1, type: 'image', modifiedAt: '2026-07-05T...' },
]

Agent responds to user:
"I found 3 files with 'font' in the name in your Photos folder:
  1. font-logo-v2.png (1.8 MB, modified Jul 9)
  2. font-logo-v1.png (2.1 MB, modified Jul 5)
  3. font-guide.pdf (2.4 MB, modified Jul 10)

Which version would you like to use?"
```

---

## Security Constraints

### Whitelisted Folders Only

| Folder | Path | Purpose | Risk |
|--------|------|---------|------|
| **Photos** | `~/Pictures` or custom Photos folder | Brand assets, reference images | ⚠️ MEDIUM — users might store sensitive personal photos |
| **Projects** | `~/Music/Projects` or workspace root | DAW files, session projects | ⚠️ MEDIUM — may contain unreleased content |
| **Downloads** | `~/Downloads` | Temporary assets, imports | ⚠️ HIGH — Downloads can be arbitrary user files |
| **Creative** | `~/.indii/creative-cache/` | indii app cache, generated assets | ✅ LOW — app-controlled folder |

### Path Validation

```typescript
function isWhitelistedFolder(requestedPath: string): boolean {
  const whitelisted = [
    expandPath('~/Pictures'),
    expandPath('~/Music/Projects'),
    expandPath('~/Downloads'),
    expandPath('~/.indii/creative-cache'),
  ];
  
  // Reject directory traversal: "../../../etc/passwd"
  const realPath = path.resolve(requestedPath);
  return whitelisted.some(w => realPath.startsWith(path.resolve(w)));
}
```

### File Type Filtering

```typescript
const ALLOWED_TYPES = [
  'image/*',      // .png, .jpg, .gif, .webp, .svg
  'audio/*',      // .mp3, .wav, .aiff
  'application/pdf',
  'application/vnd.adobe.photoshop',  // .psd
  'application/zip',      // .zip, .rar (archives)
  'text/plain',   // .txt, .md
];

function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_TYPES.some(allowed => {
    if (allowed.endsWith('*')) {
      const prefix = allowed.slice(0, -1);
      return mimeType.startsWith(prefix);
    }
    return mimeType === allowed;
  });
}
```

---

## Implementation Roadmap

### Phase 1: Desktop Indexing Service (Week 1)
1. Create `DesktopFileIndexService` (scan + Firestore write)
2. Add auto-indexing on app startup
3. Add manual re-index button to Settings
4. Test with Photos, Projects, Downloads folders

### Phase 2: Cloud Tool & Agent Integration (Week 2)
1. Add `browse_local_files` tool to Cloud Function
2. Inject into agent prompts as an available tool
3. Test: phone asks agent to find file → agent calls tool → returns results

### Phase 3: Desktop IPC Bridge (Optional, Week 3)
1. Add Electron IPC handler for real-time browsing
2. Fallback to Firestore index if IPC unavailable
3. Improve latency for Electron-to-Electron scenarios

### Phase 4: UX Polish (Week 4)
1. Add "Recently Used Files" quick access
2. Star/pin favorite assets
3. File preview thumbnails (for images)
4. Integration with Creative Studio file picker

---

## Testing Plan

### Unit Tests
```typescript
// DesktopFileIndexService.test.ts
describe('DesktopFileIndexService', () => {
  test('indexes only whitelisted folders', async () => {
    const service = new DesktopFileIndexService();
    await expect(service.indexFolder('/etc/passwd')).rejects.toThrow('not whitelisted');
    await expect(service.indexFolder('~/Pictures')).resolves.toBeDefined();
  });
  
  test('rejects directory traversal attacks', async () => {
    const service = new DesktopFileIndexService();
    await expect(service.indexFolder('~/Pictures/../../../etc')).rejects.toThrow();
  });
});
```

### E2E Test
```typescript
// mobile-file-browse.spec.ts
test('Phone agent can find desktop file', async () => {
  // Setup: Create test file ~/Pictures/test-font.png
  fs.writeFileSync(path.join(homedir(), 'Pictures', 'test-font.png'), Buffer.alloc(1024));
  
  // Desktop: Index the folder
  const indexService = new DesktopFileIndexService();
  await indexService.indexFolder('~/Pictures');
  
  // Phone: Send command via relay
  const response = await phoneRemote.sendCommand('Find test-font in my photos');
  
  // Verify: Agent found the file
  expect(response).toContain('test-font.png');
  expect(response).toContain('1 KB');
});
```

---

## Future Enhancements

1. **File Download Tool** — agent can download a file and attach it to the conversation
2. **Project Auto-Detection** — automatically find DAW projects, recognize sessions
3. **File History** — "Show me all versions of the font logo"
4. **Selective Sync** — user marks files as "shareable with agents"
5. **Collaborative Access** — team members can browse each other's whitelisted folders

---

## Related Issues

- **ISSUE-1025:** Remote relay architecture (this tool builds on top)
- **ISSUE-676:** Upload/open photo affordance (similar UX need)
- **ISSUE-755:** Persistence (file metadata needs to be durable)

