import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@/services/firebase';
import { StorageService } from '@/services/StorageService';
import { safeStorageFetch } from '@/services/storage/safeStorageFetch';
import { getPrintPreset } from './PrintSpec';
import type { ExportResult } from '@/services/export/AssetExporter';

/** A direct browser download avoids large callable responses and CORS copies. */
export async function preparePressHandoff(results: ExportResult[]): Promise<{ href: string; filename: string } | undefined> {
    if (!results.some(r => getPrintPreset(r.printSettings?.presetId || '')?.category === 'physical')) return;
    if (!auth.currentUser) throw new Error('Sign in to prepare the print handoff.');
    const assets: { uri: string; presetId: string; dpi: number }[] = [];
    for (const result of results) {
        const plan = result.printSettings;
        if (!plan) continue;
        const { blob } = await safeStorageFetch(result.url);
        const uri = await StorageService.uploadFile(blob, `users/${auth.currentUser.uid}/assets/print-${crypto.randomUUID()}.png`);
        assets.push({ uri, presetId: plan.presetId, dpi: plan.dpi });
    }
    const convert = httpsCallable<{ assets: typeof assets }, { url: string }>(functions, 'preparePrintHandoff', { timeout: 120_000 });
    const { data } = await convert({ assets });
    return { href: data.url, filename: assets.length === 1 ? `print-${assets[0]!.presetId}.zip` : 'print-pack.zip' };
}
