export function cleanupLocalStorage() {
    // 1. Clear stale Firestore coordination keys from previous sessions
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('firestore_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 2. Clear metadata persistence queue if oversized (>50KB)
    try {
        const queue = localStorage.getItem('indiiOS_pendingMetadataSaves');
        if (queue && queue.length > 50000) {
            localStorage.removeItem('indiiOS_pendingMetadataSaves');
        }
    } catch { /* already broken, try removing anyway */
        try { localStorage.removeItem('indiiOS_pendingMetadataSaves'); } catch { /* ignore removal failure */ }
    }
}
