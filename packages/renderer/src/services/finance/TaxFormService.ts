/**
 * TaxFormService — Real W-9/W-8BEN collection for payment collaborators.
 *
 * Storage: tax_docs/{uid}/{collaboratorId}/{timestamp}-{fileName} (owner-only,
 * PDF/PNG/JPEG, ≤20MB, no update — a corrected file is a new upload).
 * Firestore: users/{uid}/tax_collaborators/{id} tracks status + metadata only.
 *
 * Retention is the artist's call: the IRS recordkeeping duty falls on the
 * taxpayer, not the software, so deletion is always available (Option A).
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, storage, functions } from '@/services/firebase';
import { FirestoreService } from '@/services/FirestoreService';
import { ResendEmailService } from '@/services/email/ResendEmailService';
import { logger } from '@/utils/logger';

interface RequestTaxFormUploadResponse {
    uploadUrl: string;
    expiresAt: number;
}

export type TaxFormType = 'W-9' | 'W-8BEN';
export type TaxFormStatus = 'needed' | 'requested' | 'on_file' | 'reviewed';

export interface TaxCollaborator {
    id: string;
    name: string;
    email: string;
    country: string;
    formType: TaxFormType;
    status: TaxFormStatus;
    storagePath?: string | null;
    fileName?: string | null;
    sizeBytes?: number | null;
    uploadedAt?: number | null;
    requestedAt?: number | null;
    reviewedAt?: number | null;
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // Must match storage.rules isUnderSizeLimit(20)

function deriveFormType(country: string): TaxFormType {
    return country.trim().toUpperCase() === 'US' ? 'W-9' : 'W-8BEN';
}

function requireUid(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) {
        throw new Error('Not authenticated.');
    }
    return uid;
}

class TaxFormServiceImpl {
    private collectionFor(uid: string): FirestoreService<TaxCollaborator> {
        return new FirestoreService<TaxCollaborator>(`users/${uid}/tax_collaborators`);
    }

    subscribeCollaborators(
        callback: (data: TaxCollaborator[]) => void,
        onError?: (error: Error) => void
    ): () => void {
        const uid = requireUid();
        return this.collectionFor(uid).subscribe([], callback, onError);
    }

    async addCollaborator(params: { name: string; email: string; country: string }): Promise<string> {
        const uid = requireUid();
        const formType = deriveFormType(params.country);
        return this.collectionFor(uid).add({
            name: params.name,
            email: params.email,
            country: params.country,
            formType,
            status: 'needed',
        });
    }

    async uploadForm(collaboratorId: string, file: File): Promise<void> {
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            throw new Error(`Unsupported file type "${file.type || 'unknown'}". Upload a PDF, PNG, or JPEG.`);
        }
        if (file.size > MAX_SIZE_BYTES) {
            throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 20MB.`);
        }

        const uid = requireUid();
        const fileName = `${Date.now()}-${file.name}`;
        const storagePath = `tax_docs/${uid}/${collaboratorId}/${fileName}`;
        await uploadBytes(ref(storage, storagePath), file, { contentType: file.type });

        await this.collectionFor(uid).update(collaboratorId, {
            status: 'on_file',
            storagePath,
            fileName: file.name,
            sizeBytes: file.size,
            uploadedAt: Date.now(),
        });
    }

    async getDownloadUrl(storagePath: string): Promise<string> {
        return getDownloadURL(ref(storage, storagePath));
    }

    async requestForm(collaboratorId: string): Promise<void> {
        const uid = requireUid();
        const svc = this.collectionFor(uid);
        const collaborator = await svc.get(collaboratorId);
        if (!collaborator) {
            throw new Error('Collaborator not found.');
        }

        const mintUploadLink = httpsCallable<{ collaboratorId: string }, RequestTaxFormUploadResponse>(
            functions,
            'requestTaxFormUpload'
        );
        const linkResult = await mintUploadLink({ collaboratorId });
        const { uploadUrl } = linkResult.data;

        const result = await ResendEmailService.sendNotification({
            to: collaborator.email,
            title: `${collaborator.formType} Tax Form Requested`,
            message: `Hi ${collaborator.name}, please submit your ${collaborator.formType} tax form using this secure one-time link: ${uploadUrl}\n\nThis link can only be used once and expires in 7 days.`,
        });
        if (!result.success) {
            throw new Error(result.error || 'Email failed to send.');
        }

        await svc.update(collaboratorId, {
            status: 'requested',
            requestedAt: Date.now(),
        });
    }

    async markReviewed(collaboratorId: string): Promise<void> {
        const uid = requireUid();
        await this.collectionFor(uid).update(collaboratorId, {
            status: 'reviewed',
            reviewedAt: Date.now(),
        });
    }

    /** Deletes the uploaded file only; collaborator reverts to 'needed'. */
    async deleteUploadedFile(collaboratorId: string): Promise<void> {
        const uid = requireUid();
        const svc = this.collectionFor(uid);
        const collaborator = await svc.get(collaboratorId);
        if (collaborator?.storagePath) {
            try {
                await deleteObject(ref(storage, collaborator.storagePath));
            } catch (error) {
                logger.warn('[TaxFormService] Storage delete failed (file may already be gone)', { error });
            }
        }
        await svc.update(collaboratorId, {
            status: 'needed',
            storagePath: null,
            fileName: null,
            sizeBytes: null,
            uploadedAt: null,
        });
    }

    /** Removes the collaborator entirely, including any uploaded file. */
    async removeCollaborator(collaboratorId: string): Promise<void> {
        const uid = requireUid();
        const svc = this.collectionFor(uid);
        const collaborator = await svc.get(collaboratorId);
        if (collaborator?.storagePath) {
            try {
                await deleteObject(ref(storage, collaborator.storagePath));
            } catch (error) {
                logger.warn('[TaxFormService] Storage delete failed during collaborator removal', { error });
            }
        }
        await svc.delete(collaboratorId);
    }
}

export const TaxFormService = new TaxFormServiceImpl();
