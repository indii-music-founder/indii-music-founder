export function cleanupLocalStorage() {
    // 1. Clear stale Firestore coordination keys from previous sessions
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('firestore_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

}
