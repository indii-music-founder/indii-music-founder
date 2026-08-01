import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { db, functions, auth } from '@/services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import {
  KnowledgeDocument,
  KnowledgeOperationError,
  KnowledgeQueryReceipt
} from '@indii/shared/schemas/knowledge';

export interface FrontendKnowledgeDoc {
    id: string; // The Firestore document ID
    title: string;
    type: string;
    size: string;
    date: string;
    status: 'indexed' | 'processing' | 'error' | 'needs_reupload';
    rawName: string; // To keep compatibility with UI
    mimeType: string;
    content?: string; 
}

class KnowledgeRetrievalService {
    async getDocuments(projectId?: string): Promise<FrontendKnowledgeDoc[]> {
        if (!auth.currentUser) return [];

        const uid = auth.currentUser.uid;
        const ragDocsRef = collection(db, `users/${uid}/ragDocuments`);
        const q = query(ragDocsRef);
        const snapshot = await getDocs(q);

        const docs: FrontendKnowledgeDoc[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data() as KnowledgeDocument;
            let status: FrontendKnowledgeDoc['status'] = 'processing';
            if (data.state === 'active') status = 'indexed';
            else if (data.state === 'failed') status = 'error';

            docs.push({
                id: doc.id,
                title: data.title,
                type: data.mimeType.includes('pdf') ? 'PDF' :
                      data.mimeType.includes('markdown') ? 'MD' :
                      data.mimeType.includes('text') ? 'TXT' : 'FILE',
                size: `${(data.byteSize / 1024).toFixed(1)} KB`,
                date: new Date(data.createdAt).toLocaleDateString('en-US'),
                status,
                rawName: doc.id,
                mimeType: data.mimeType
            });
        });

        return docs;
    }

    private async computeSha256(file: File): Promise<string> {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async uploadFiles(files: FileList, projectId?: string, onProgress?: (fileName: string) => void): Promise<number> {
        let successCount = 0;
        const uploadPromises: Promise<void>[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;

            uploadPromises.push((async () => {
                try {
                    if (onProgress) onProgress(file.name);

                    const contentSha256 = await this.computeSha256(file);
                    
                    const createKnowledgeUpload = httpsCallable(functions, 'createKnowledgeUpload');
                    const createRes = await createKnowledgeUpload({
                        title: file.name,
                        mimeType: file.type || 'text/plain',
                        byteSize: file.size,
                        contentSha256
                    });

                    const { documentId, storagePath } = createRes.data as { documentId: string, storagePath: string };

                    // Upload directly to Cloud Storage via SDK
                    const storage = getStorage();
                    const storageRef = ref(storage, storagePath);
                    await uploadBytes(storageRef, file, {
                        contentType: file.type || 'text/plain',
                        customMetadata: {
                            contentHash: contentSha256,
                            ownerId: auth.currentUser!.uid,
                            immutable: 'true',
                            originalFileName: file.name
                        }
                    });

                    const finalizeKnowledgeUpload = httpsCallable(functions, 'finalizeKnowledgeUpload');
                    await finalizeKnowledgeUpload({ documentId });

                    successCount++;
                } catch (err: unknown) {
                    logger.error(`KnowledgeRetrievalService Upload Fail for ${file.name}:`, err);
                }
            })());
        }

        await Promise.all(uploadPromises);
        return successCount;
    }

    async deleteDocument(documentId: string): Promise<void> {
        const deleteKnowledgeDocument = httpsCallable(functions, 'deleteKnowledgeDocument');
        await deleteKnowledgeDocument({ documentId });
    }

    async chat(queryText: string, fileUri: string | null = null, projectId?: string): Promise<string> {
        const queryKnowledgeBase = httpsCallable(functions, 'queryKnowledgeBase');
        
        try {
            const result = await queryKnowledgeBase({
                query: queryText,
            });

            // If the backend doesn't return an answer yet (only citations), we format the citations.
            const data = result.data as any;
            if (data.answer) {
                return data.answer;
            } else if (data.citations && data.citations.length > 0) {
                return `Here are the top relevant snippets from your documents:\n\n` + 
                    data.citations.map((c: any) => `* From **${c.documentTitle || c.documentId}**: "${c.snippet || c.text}"`).join('\n\n');
            }

            return "I couldn't generate a response based on the knowledge base. Please try again.";
        } catch (err) {
            logger.error("KnowledgeRetrievalService chat error:", err);
            return "An error occurred while querying the knowledge base.";
        }
    }

    async *chatStream(queryText: string, fileUri: string | null = null, projectId?: string): AsyncGenerator<string> {
        // Fallback to standard chat for now if streaming is not fully implemented in v2
        const response = await this.chat(queryText, fileUri, projectId);
        yield response;
    }
}

export const knowledgeRetrievalService = new KnowledgeRetrievalService();
