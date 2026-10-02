import { z } from 'zod';

const VisibilityStateSchema = z.object({
    userId: z.string().min(1),
    masterHash: z.string().regex(/^[0-9a-f]{16,64}$/),
    lifecycle: z.enum(['ADMIN_LOCKED', 'DISTRIBUTION_READY']),
    ledgerReceiptId: z.string().min(1),
    catalogVisibility: z.enum(['private', 'public']).default('private'),
});

export type CatalogVisibilityState = z.infer<typeof VisibilityStateSchema>;

/** Only server-owned locked records bound to the current owner may be displayed. */
export function parseCatalogVisibilityState(userId: string, documentId: string, value: unknown): CatalogVisibilityState {
    const state = VisibilityStateSchema.parse(value);
    if (state.userId !== userId || state.masterHash !== documentId) {
        throw new Error('Catalog visibility record does not match its owner or master.');
    }
    return state;
}
