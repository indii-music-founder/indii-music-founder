import { storage } from '@/services/firebase';
import { ref, uploadBytes, uploadString } from 'firebase/storage';

export class CreativeStorageService {
    /**
     * Uploads a raw File object or Data URL to Firebase Storage under the 'creative/' path
     * and returns the strict 'gs://' URI required by the Thin Client protocol API Gateway.
     */
    static async uploadReferenceMedia(
        userId: string,
        media: File | Blob | string,
        mediaType: 'image' | 'video' | 'audio'
    ): Promise<string> {
        if (!storage) {
            throw new Error('Firebase Storage is not initialized.');
        }

        if (typeof media === 'string' && media.startsWith('gs://')) {
            return media;
        }

        const bucket = storage.app.options.storageBucket;
        if (!bucket) {
            throw new Error('Storage bucket not found in Firebase config.');
        }

        const extension = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'wav' : 'jpg';
        const filename = `creative/${userId}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
        const storageRef = ref(storage, filename);

        if (typeof media === 'string') {
            // Data URL string
            if (media.startsWith('data:')) {
                await uploadString(storageRef, media, 'data_url');
            } else if (/^https?:\/\//i.test(media)) {
                const response = await fetch(media);
                if (!response.ok) {
                    throw new Error(`Failed to fetch reference media: ${response.status} ${response.statusText}`);
                }
                await uploadBytes(storageRef, await response.blob());
            } else {
                // Raw Base64
                await uploadString(storageRef, media, 'base64');
            }
        } else {
            // File or Blob
            await uploadBytes(storageRef, media);
        }

        return `gs://${bucket}/${filename}`;
    }
}
