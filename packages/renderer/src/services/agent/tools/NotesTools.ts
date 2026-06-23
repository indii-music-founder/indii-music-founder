import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

export const NotesTools = {
    /**
     * Tool to save text notes or transcriptions to the Notes module.
     */
    save_note: wrapTool('save_note', async (args: { title?: string; content: string }) => {
        try {
            logger.info(`[NotesTools] Saving note...`);
            const title = args.title || `Note - ${new Date().toLocaleString()}`;
            const id = useStore.getState().addNote({
                title,
                content: args.content,
                attachments: [],
                tags: []
            });
            return toolSuccess({ id, title }, `Note "${title}" saved successfully to the Notes module.`);
        } catch (e: unknown) {
            logger.error('[NotesTools] save_note failed:', e);
            return toolError("Failed to save note.", "NOTES_ERROR");
        }
    }),

    /**
     * Tool to save media attachments to an existing note, or create a new note for media.
     */
    save_media_note: wrapTool('save_media_note', async (args: { url: string; noteId?: string; description?: string }) => {
        try {
            logger.info(`[NotesTools] Saving media note...`);
            let targetId = args.noteId;

            if (!targetId) {
                targetId = useStore.getState().addNote({
                    title: args.description ? `Media: ${args.description}` : `Media Note - ${new Date().toLocaleString()}`,
                    content: args.description || '',
                    attachments: [],
                    tags: []
                });
            }

            useStore.getState().addAttachmentToNote(targetId, args.url);

            return toolSuccess({ id: targetId, url: args.url }, `Media saved successfully as attachment in note ID: ${targetId}`);
        } catch (e: unknown) {
            logger.error('[NotesTools] save_media_note failed:', e);
            return toolError("Failed to save media note.", "NOTES_ERROR");
        }
    }),
};
