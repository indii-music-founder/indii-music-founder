import { TrashTargetSchema, TrashProvenanceSchema } from '@indii/shared';
import { trashService } from '@/services/trash/TrashService';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';

export const TrashTools = {
    list_trash: wrapTool('list_trash', async (args: { type?: string; query?: string }) => {
        const type = args.type === undefined
            ? undefined
            : TrashTargetSchema.shape.type.parse(args.type);
        const items = await trashService.listTrash({ type, searchQuery: args.query });
        const summaries = items.map(item => ({
            id: item.id,
            type: item.type,
            name: item.name,
            originalLocation: item.originalLocation,
            projectId: item.projectId,
            trashedAt: item.trashedAt,
            provenance: item.provenance,
            deviceAvailable: item.deviceInfo?.isAvailable,
            retentionLocked: item.legalHold.isLocked,
        }));
        return toolSuccess({ items: summaries, count: summaries.length }, `Found ${summaries.length} item(s) in Trash.`);
    }),

    move_to_trash: wrapTool('move_to_trash', async (args: {
        type: string;
        targetId: string;
        folderId?: string;
        reason?: string;
    }, context) => {
        const target = TrashTargetSchema.parse({
            type: args.type,
            targetId: args.targetId,
            folderId: args.folderId,
        });
        const provenance = TrashProvenanceSchema.parse({
            actor: 'agent',
            agentId: context?.agentId || 'unknown-agent',
            reason: args.reason || 'Agent moved item to Trash at the user’s direction',
        });
        const item = await trashService.moveToTrash(target, provenance, context?.projectId);
        return toolSuccess({ item }, `Moved “${item.name}” to Trash. It can be restored.`);
    }),

    restore_from_trash: wrapTool('restore_from_trash', async (args: {
        trashId: string;
        targetRelativePath?: string;
    }) => {
        if (typeof args.trashId !== 'string' || !/^trash_[A-Za-z0-9_-]{1,120}$/.test(args.trashId)) {
            throw new Error('Invalid trashId.');
        }
        await trashService.restoreFromTrash(args.trashId, { targetRelativePath: args.targetRelativePath });
        return toolSuccess({ trashId: args.trashId }, 'Item restored from Trash.');
    }),
};
