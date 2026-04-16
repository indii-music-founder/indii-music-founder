/**
 * LikenessService — Manages persistent "My Likeness" selfie images.
 *
 * Stores user likeness photos in Firestore + Firebase Storage under:
 * - Firestore: `users/{uid}/likeness/{imageId}`
 * - Storage: `users/{uid}/likeness/{imageId}.webp`
 *
 * These images persist across all projects and are auto-injected
 * into AI generation context for character consistency.
 */
import { auth, db, storage } from '@/services/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { logger } from '@/utils/logger';

/** Maximum number of likeness images per user */
export const MAX_LIKENESS_IMAGES = 5;

export interface LikenessImage {
    id: string;
    url: string;
    storageRef: string;
    qualityScore: 'good' | 'acceptable' | 'low';
    qualityNotes?: string;
    createdAt: number;
}

class LikenessServiceImpl {
    private getUid(): string | null {
        return auth.currentUser?.uid ?? null;
    }

    private getCollectionRef() {
        const uid = this.getUid();
        if (!uid) throw new Error('User not authenticated');
        return collection(db, 'users', uid, 'likeness');
    }

    /**
     * Fetch all likeness images for the current user.
     * Returns newest-first, capped at MAX_LIKENESS_IMAGES.
     */
    async getAll(): Promise<LikenessImage[]> {
        try {
            const q = query(
                this.getCollectionRef(),
                orderBy('createdAt', 'desc'),
                limit(MAX_LIKENESS_IMAGES)
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() } as LikenessImage));
        } catch (err) {
            logger.error('[LikenessService] Failed to fetch likeness images', err);
            return [];
        }
    }

    /**
     * Get the count of existing likeness images.
     */
    async getCount(): Promise<number> {
        const images = await this.getAll();
        return images.length;
    }

    /**
     * Upload a new likeness image.
     * The dataUrl is uploaded to Firebase Storage, and metadata is written to Firestore.
     */
    async add(dataUrl: string, qualityScore: LikenessImage['qualityScore'], qualityNotes?: string): Promise<LikenessImage | null> {
        const uid = this.getUid();
        if (!uid) {
            logger.error('[LikenessService] Cannot add image: user not authenticated');
            return null;
        }

        const count = await this.getCount();
        if (count >= MAX_LIKENESS_IMAGES) {
            logger.warn('[LikenessService] Max likeness images reached');
            return null;
        }

        try {
            const id = crypto.randomUUID();
            const storagePath = `users/${uid}/likeness/${id}.webp`;
            const storageRefObj = ref(storage, storagePath);

            // Upload image to Storage
            await uploadString(storageRefObj, dataUrl, 'data_url');
            const downloadUrl = await getDownloadURL(storageRefObj);

            // Write metadata to Firestore
            const docRef = doc(this.getCollectionRef(), id);
            await setDoc(docRef, {
                url: downloadUrl,
                storageRef: storagePath,
                qualityScore,
                qualityNotes: qualityNotes || null,
                createdAt: serverTimestamp(),
            });

            logger.info('[LikenessService] Added likeness image', { id, qualityScore });

            return {
                id,
                url: downloadUrl,
                storageRef: storagePath,
                qualityScore,
                qualityNotes,
                createdAt: Date.now(),
            };
        } catch (err) {
            logger.error('[LikenessService] Failed to upload likeness image', err);
            return null;
        }
    }

    /**
     * Delete a likeness image from Storage and Firestore.
     */
    async remove(id: string, storagePath: string): Promise<boolean> {
        try {
            // Delete from Storage
            const storageRefObj = ref(storage, storagePath);
            await deleteObject(storageRefObj).catch(() => {
                logger.warn('[LikenessService] Storage file not found during delete — continuing');
            });

            // Delete from Firestore
            const docRef = doc(this.getCollectionRef(), id);
            await deleteDoc(docRef);

            logger.info('[LikenessService] Removed likeness image', { id });
            return true;
        } catch (err) {
            logger.error('[LikenessService] Failed to remove likeness image', err);
            return false;
        }
    }

    /**
     * Run an AI quality check on the uploaded image.
     * Uses Gemini Vision to assess lighting, clarity, and face visibility.
     * Returns a soft verdict — never blocks the user.
     */
    async assessQuality(dataUrl: string): Promise<{ score: LikenessImage['qualityScore']; notes: string }> {
        try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

            const base64Data = dataUrl.split(',')[1] || '';
            const mimeType = dataUrl.split(':')[1]?.split(';')[0] || 'image/jpeg';

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-05-20',
                contents: [{
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: base64Data,
                            },
                        },
                        {
                            text: `You are an image quality assessor for AI character consistency.
Evaluate this selfie/portrait for use as an AI likeness reference.

Rate on these criteria:
1. Face clearly visible (not obstructed, not too far away)
2. Lighting quality (even lighting preferred, not harsh shadows)
3. Image sharpness (not blurry, not too compressed)
4. Suitable for AI character reference (clear features, neutral-ish angle)

Respond in EXACTLY this JSON format:
{"score": "good" | "acceptable" | "low", "notes": "Brief 1-sentence explanation"}

- "good" = excellent reference, clear face, good lighting
- "acceptable" = usable but could be better
- "low" = significant issues (blurry, face not visible, very dark)`,
                        },
                    ],
                }],
                config: {
                    temperature: 0.1,
                    maxOutputTokens: 200,
                },
            });

            const text = response.text?.trim() || '';
            // Try to parse JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const validScores: LikenessImage['qualityScore'][] = ['good', 'acceptable', 'low'];
                const score = validScores.includes(parsed.score) ? parsed.score : 'acceptable';
                return { score, notes: parsed.notes || 'Quality assessed.' };
            }

            return { score: 'acceptable', notes: 'Unable to fully assess — image accepted.' };
        } catch (err) {
            logger.warn('[LikenessService] Quality assessment failed — defaulting to acceptable', err);
            return { score: 'acceptable', notes: 'Quality check unavailable — image accepted.' };
        }
    }
}

export const LikenessService = new LikenessServiceImpl();
