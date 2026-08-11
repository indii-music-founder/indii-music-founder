import { describe, it, expect } from 'vitest';
import {
    TrashTargetSchema,
    TrashItemSchema,
    LocalTrashMoveRequestSchema,
    TrashPurgeIntentSchema
} from './trash';

describe('Trash Shared Schemas', () => {
    it('validates TrashTarget correctly', () => {
        const validTarget = {
            type: 'file_nodes',
            targetId: 'node_12345'
        };
        const parsed = TrashTargetSchema.parse(validTarget);
        expect(parsed.type).toBe('file_nodes');
        expect(parsed.targetId).toBe('node_12345');

        expect(() => TrashTargetSchema.parse({ type: 'file_nodes', targetId: '' })).toThrow();
        expect(() => TrashTargetSchema.parse({ type: 'unknown_type', targetId: '123' })).toThrow();
    });

    it('validates TrashItem schema and lifecycle states', () => {
        const item = {
            id: 'trash_001',
            userId: 'usr_abc',
            projectId: 'proj_xyz',
            type: 'brand_assets',
            targetId: 'asset_99',
            name: 'Logo.png',
            originalLocation: 'brandAssets/asset_99/Logo.png',
            provenance: {
                actor: 'agent',
                agentId: 'brand_agent',
                agentName: 'Brand Agent',
                traceId: 'tr_111',
                reason: 'Replaced with updated vector logo'
            },
            state: 'trashed',
            idempotencyKey: 'idemp_asset_99_1700000000',
            quarantinePath: 'users/usr_abc/trash/trash_001/Logo.png',
            restoreData: {
                originalCollection: 'brandAssets',
                originalDoc: { title: 'Logo.png', url: 'https://storage...' }
            },
            legalHold: {
                isLocked: false
            },
            hasEntries: false,
            trashedAt: '2026-08-11T08:00:00Z',
            updatedAt: '2026-08-11T08:00:00Z'
        };

        const parsed = TrashItemSchema.parse(item);
        expect(parsed.state).toBe('trashed');
        expect(parsed.provenance.actor).toBe('agent');
    });

    it('validates LocalTrashMoveRequest schema', () => {
        const req = {
            approvedFolderId: 'folder_root_1',
            relativePath: 'audio/vocal_take1.wav',
            trashId: 'trash_loc_001'
        };
        const parsed = LocalTrashMoveRequestSchema.parse(req);
        expect(parsed.relativePath).toBe('audio/vocal_take1.wav');
    });

    it('validates TrashPurgeIntent schema', () => {
        const intent = {
            intentToken: 'jwt_intent_token_xyz',
            trashIds: ['trash_001', 'trash_002'],
            userId: 'usr_abc',
            expiresAt: Date.now() + 300000
        };
        const parsed = TrashPurgeIntentSchema.parse(intent);
        expect(parsed.trashIds).toHaveLength(2);
    });
});
