import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '@/services/firebase';

export async function resolveStorageUrl(uri: string): Promise<string> {
    if (!uri.startsWith('gs://')) {
        return uri;
    }

    try {
        const bucketPath = uri.split('/').slice(3).join('/');
        return await getDownloadURL(ref(storage, bucketPath));
    } catch (error) {
        console.warn('[resolveStorageUrl] Failed to resolve Firebase Storage URI:', error);
        return uri;
    }
}
