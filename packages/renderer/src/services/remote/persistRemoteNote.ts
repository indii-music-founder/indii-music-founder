import { useStore } from '@/core/store';
import { auth } from '@/services/firebase';
import { notesService } from '@/services/notes/NotesService';

/** A local note ID is not a durable dispatch receipt: await the cloud write. */
export async function persistRemoteNote(noteId: string, expectedUid: string, attachmentUrl?: string): Promise<void> {
    const note = useStore.getState().notes.find(item => item.id === noteId);
    if (!note) throw new Error('The captured note is missing. Your remote capture has been retained.');
    if (attachmentUrl && !note.attachments.includes(attachmentUrl)) throw new Error('The captured attachment is not linked to this note.');
    await notesService.pushNote(note, expectedUid);
    if (auth.currentUser?.uid !== expectedUid) throw new Error('The signed-in account changed. Check your saved note after signing in again.');
}
