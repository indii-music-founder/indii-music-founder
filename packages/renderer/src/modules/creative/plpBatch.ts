export type PlpVariantKind = 'image' | 'video';
export type PlpVariantStatus = 'queued' | 'completed' | 'failed';

export interface PlpVariantResult {
    id: string;
    url: string;
    prompt: string;
}

export interface PlpVariantSlot {
    index: number;
    kind: PlpVariantKind;
    status: PlpVariantStatus;
    attempt: number;
    jobId?: string;
    result?: PlpVariantResult;
    error?: string;
}

export interface PlpBatch {
    id: string;
    projectId: string;
    prompt: string;
    slots: PlpVariantSlot[];
    startedAt: number;
    launchStatus: 'idle' | 'launching' | 'launched' | 'attention_required';
}

export function createPlpBatch(id: string, projectId: string, prompt: string): PlpBatch {
    return {
        id,
        projectId,
        prompt,
        startedAt: Date.now(),
        launchStatus: 'idle',
        slots: Array.from({ length: 15 }, (_, index) => ({
            index,
            kind: index < 10 ? 'image' : 'video',
            status: 'queued',
            attempt: 1,
        })),
    };
}

export function setPlpLaunchStatus(batch: PlpBatch, launchStatus: PlpBatch['launchStatus']): PlpBatch {
    return { ...batch, launchStatus };
}

function updateSlot(batch: PlpBatch, slotIndex: number, update: (slot: PlpVariantSlot) => PlpVariantSlot): PlpBatch {
    if (!batch.slots[slotIndex]) return batch;
    return {
        ...batch,
        slots: batch.slots.map((slot, index) => index === slotIndex ? update(slot) : slot),
    };
}

export function queuePlpSlot(batch: PlpBatch, slotIndex: number, jobId?: string): PlpBatch {
    return updateSlot(batch, slotIndex, slot => {
        if (slot.status === 'completed') return slot;
        return {
            ...slot,
            status: 'queued',
            jobId: jobId ?? slot.jobId,
            error: undefined,
        };
    });
}

export function retryPlpSlot(batch: PlpBatch, slotIndex: number): PlpBatch {
    return updateSlot(batch, slotIndex, slot => {
        if (slot.status !== 'failed') return slot;
        return {
            ...slot,
            status: 'queued',
            attempt: slot.attempt + 1,
            jobId: undefined,
            error: undefined,
        };
    });
}

export function completePlpSlot(batch: PlpBatch, slotIndex: number, result: PlpVariantResult): PlpBatch {
    if (!result.id || !result.url) return batch;
    return updateSlot(batch, slotIndex, slot => {
        // A listener can emit the same terminal record more than once. The first
        // accepted completion owns this immutable PLP slot.
        if (slot.status === 'completed') return slot;
        return {
            ...slot,
            status: 'completed',
            result,
            error: undefined,
        };
    });
}

export function failPlpSlot(batch: PlpBatch, slotIndex: number, error: string): PlpBatch {
    return updateSlot(batch, slotIndex, slot => {
        if (slot.status === 'completed') return slot;
        return {
            ...slot,
            status: 'failed',
            error,
        };
    });
}

export function getEligiblePlpSlots(batch: PlpBatch): PlpVariantSlot[] {
    return batch.slots.filter(slot => slot.status === 'completed' && !!slot.result?.id && !!slot.result.url);
}

export function getPlpBatchCounts(batch: PlpBatch): Record<PlpVariantStatus, number> {
    return batch.slots.reduce<Record<PlpVariantStatus, number>>((counts, slot) => {
        counts[slot.status] += 1;
        return counts;
    }, { queued: 0, completed: 0, failed: 0 });
}
