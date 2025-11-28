
import { getAll, deleteImage, deleteHistoryItem, DB_STORES } from './db';
import { UploadedImage, HistoryItem } from './types';
import { showToast } from './toast';

/**
 * Removes "orphaned" blobs from IndexedDB.
 * Orphans are:
 * 1. Images not referenced in any Project (if project-based - though current DB design has projectId on image)
 * 2. Blobs that exist but are not referenced (harder to detect in IDB without traversing all keys)
 *
 * For this version, we will focus on:
 * - Finding images/history that have NO projectId (if any exists from old versions)
 * - (Optional) Removing history items older than 30 days if explicitly requested (not default)
 *
 * But a true "Garbage Collection" in this app context implies:
 * "Find images that are visually hidden (deleted from UI) but still in DB?"
 * No, the delete button in UI calls `deleteImage` which removes from DB.
 *
 * So the main "leak" source is actually `state.generatedHistory` vs `db.history`.
 * If we implement a "Trash Can" feature later, this would empty it.
 *
 * For now, "Vacuum" will:
 * 1. Verify integrity (check if base64 data is valid/present)
 * 2. Remove items with missing base64 data (corrupted)
 */
export async function vacuumDatabase() {
    try {
        const images = await getAll<UploadedImage>(DB_STORES.IMAGES);
        const history = await getAll<HistoryItem>(DB_STORES.HISTORY);

        let removedCount = 0;
        let corruptedCount = 0;

        // Check Images
        for (const img of images) {
            if (!img.base64 || img.base64.length < 50) {
                await deleteImage(img.id);
                corruptedCount++;
            }
        }

        // Check History
        for (const h of history) {
            if (!h.base64 || h.base64.length < 50) {
                await deleteHistoryItem(h.id);
                corruptedCount++;
            }
        }

        if (corruptedCount > 0) {
            showToast(`Vacuum Complete: Removed ${corruptedCount} corrupted files.`, 'success');
        } else {
            showToast('Database is healthy. No corrupted files found.', 'success');
        }

    } catch (e) {
        console.error("Vacuum failed", e);
        showToast("Vacuum failed: " + e, 'error');
    }
}
