import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/services/firebase';
import { ResendEmailService } from '@/services/email/ResendEmailService';
import { TaxFormService } from './TaxFormService';

vi.mock('@/services/email/ResendEmailService', () => ({
    ResendEmailService: {
        sendNotification: vi.fn(),
    },
}));

function mockUploadLink(uploadUrl: string) {
    (httpsCallable as ReturnType<typeof vi.fn>).mockImplementation(() =>
        vi.fn().mockResolvedValue({ data: { uploadUrl, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 } })
    );
}

function makeFile(name: string, type: string, sizeBytes: number): File {
    const file = new File(['x'.repeat(Math.min(sizeBytes, 1024))], name, { type });
    Object.defineProperty(file, 'size', { value: sizeBytes });
    return file;
}

describe('TaxFormService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth as unknown as { currentUser: { uid: string } | null }).currentUser = { uid: 'test-uid' };
    });

    describe('addCollaborator', () => {
        it('derives W-9 for US collaborators', async () => {
            await TaxFormService.addCollaborator({ name: 'Alice', email: 'a@x.com', country: 'US' });
            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ formType: 'W-9', status: 'needed' })
            );
        });

        it('derives W-8BEN for non-US collaborators', async () => {
            await TaxFormService.addCollaborator({ name: 'Bob', email: 'b@x.com', country: 'CA' });
            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ formType: 'W-8BEN', status: 'needed' })
            );
        });
    });

    describe('uploadForm', () => {
        it('rejects unsupported file types without uploading', async () => {
            const file = makeFile('malware.exe', 'application/x-msdownload', 1024);
            await expect(TaxFormService.uploadForm('collab-1', file)).rejects.toThrow(/Unsupported file type/);
            expect(uploadBytes).not.toHaveBeenCalled();
        });

        it('rejects oversized files without uploading', async () => {
            const file = makeFile('big.pdf', 'application/pdf', 21 * 1024 * 1024);
            await expect(TaxFormService.uploadForm('collab-1', file)).rejects.toThrow(/too large/);
            expect(uploadBytes).not.toHaveBeenCalled();
        });

        it('uploads a valid PDF and marks the collaborator on_file', async () => {
            const file = makeFile('w9.pdf', 'application/pdf', 1024);
            await TaxFormService.uploadForm('collab-1', file);

            expect(uploadBytes).toHaveBeenCalledTimes(1);
            const [, , options] = (uploadBytes as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(options).toEqual({ contentType: 'application/pdf' });

            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    status: 'on_file',
                    fileName: 'w9.pdf',
                    sizeBytes: 1024,
                })
            );
        });
    });

    describe('requestForm', () => {
        it('throws when the collaborator does not exist, without sending email', async () => {
            (getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ exists: () => false, data: () => undefined, id: 'collab-1' });
            await expect(TaxFormService.requestForm('collab-1')).rejects.toThrow(/not found/);
            expect(ResendEmailService.sendNotification).not.toHaveBeenCalled();
        });

        it('throws honestly when email fails, without updating status', async () => {
            (getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ email: 'c@x.com', name: 'Carol', formType: 'W-9' }),
                id: 'collab-1',
            });
            mockUploadLink('https://app.indii.music/tax-form-upload?token=' + 'a'.repeat(64));
            (ResendEmailService.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                success: false,
                error: 'Resend API down',
            });

            await expect(TaxFormService.requestForm('collab-1')).rejects.toThrow(/Resend API down/);
            expect(updateDoc).not.toHaveBeenCalled();
        });

        it('marks requested and embeds the one-time upload link in the email on successful send', async () => {
            (getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ email: 'c@x.com', name: 'Carol', formType: 'W-9' }),
                id: 'collab-1',
            });
            const uploadUrl = 'https://app.indii.music/tax-form-upload?token=' + 'a'.repeat(64);
            mockUploadLink(uploadUrl);
            (ResendEmailService.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

            await TaxFormService.requestForm('collab-1');

            expect(ResendEmailService.sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining(uploadUrl) })
            );
            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ status: 'requested' })
            );
        });
    });

    describe('deleteUploadedFile', () => {
        it('deletes storage object and resets status to needed', async () => {
            (getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ storagePath: 'tax_docs/test-uid/collab-1/1-w9.pdf' }),
                id: 'collab-1',
            });

            await TaxFormService.deleteUploadedFile('collab-1');

            expect(deleteObject).toHaveBeenCalledTimes(1);
            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ status: 'needed', storagePath: null, fileName: null })
            );
        });

        it('does not throw if the storage object is already gone', async () => {
            (getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ storagePath: 'tax_docs/test-uid/collab-1/1-w9.pdf' }),
                id: 'collab-1',
            });
            (deleteObject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('object-not-found'));

            await expect(TaxFormService.deleteUploadedFile('collab-1')).resolves.toBeUndefined();
            expect(updateDoc).toHaveBeenCalled();
        });
    });

    describe('removeCollaborator', () => {
        it('deletes the storage object and the collaborator doc', async () => {
            (getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ storagePath: 'tax_docs/test-uid/collab-1/1-w9.pdf' }),
                id: 'collab-1',
            });

            await TaxFormService.removeCollaborator('collab-1');

            expect(deleteObject).toHaveBeenCalledTimes(1);
            expect(deleteDoc).toHaveBeenCalledTimes(1);
        });

        it('skips storage delete when no file was ever uploaded', async () => {
            (getDoc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({}),
                id: 'collab-1',
            });

            await TaxFormService.removeCollaborator('collab-1');

            expect(deleteObject).not.toHaveBeenCalled();
            expect(deleteDoc).toHaveBeenCalledTimes(1);
        });
    });

    describe('getDownloadUrl', () => {
        it('returns a signed URL for the given storage path', async () => {
            const url = await TaxFormService.getDownloadUrl('tax_docs/test-uid/collab-1/1-w9.pdf');
            expect(getDownloadURL).toHaveBeenCalled();
            expect(url).toBe('https://mock-url.com');
        });
    });

    describe('authentication guard', () => {
        it('throws when there is no authenticated user', async () => {
            (auth as unknown as { currentUser: { uid: string } | null }).currentUser = null;
            await expect(TaxFormService.addCollaborator({ name: 'X', email: 'x@x.com', country: 'US' }))
                .rejects.toThrow(/Not authenticated/);
        });
    });
});
