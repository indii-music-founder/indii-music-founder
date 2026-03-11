import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    Timestamp,
    deleteDoc,
    doc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { FieldContact, FieldContactInput, CaptureLocation } from '@/types/contacts';
import { logger } from '@/utils/logger';

// ============================================================================
// FieldContactService — Firestore persistence for on-the-road contacts
// ============================================================================

/**
 * Manages field contacts captured via QuickCapture.
 * Stores under: users/{userId}/fieldContacts
 */
export class FieldContactService {

    /**
     * Get the Firestore collection reference for a user's field contacts.
     */
    private static getCollection(userId: string) {
        return collection(db, 'users', userId, 'fieldContacts');
    }

    /**
     * Add a new field contact with auto-generated timestamp.
     */
    static async addFieldContact(
        userId: string,
        input: FieldContactInput
    ): Promise<string> {
        try {
            const contactData = {
                ...input,
                capturedAt: input.capturedAt ?? Timestamp.now(),
            };

            const docRef = await addDoc(
                FieldContactService.getCollection(userId),
                contactData
            );

            logger.info(`[FieldContactService] Added contact "${input.name}" (${docRef.id})`);
            return docRef.id;
        } catch (error) {
            logger.error('[FieldContactService] Failed to add contact:', error);
            throw error;
        }
    }

    /**
     * Get all field contacts, most recent first.
     */
    static async getFieldContacts(userId: string): Promise<FieldContact[]> {
        try {
            const q = query(
                FieldContactService.getCollection(userId),
                orderBy('capturedAt', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as FieldContact[];
        } catch (error) {
            logger.error('[FieldContactService] Failed to get contacts:', error);
            throw error;
        }
    }

    /**
     * Delete a field contact by ID.
     */
    static async deleteFieldContact(userId: string, contactId: string): Promise<void> {
        try {
            await deleteDoc(
                doc(db, 'users', userId, 'fieldContacts', contactId)
            );
            logger.info(`[FieldContactService] Deleted contact ${contactId}`);
        } catch (error) {
            logger.error('[FieldContactService] Failed to delete contact:', error);
            throw error;
        }
    }

    /**
     * Attempt to get the current GPS position.
     * Returns null if geolocation is unavailable or denied.
     */
    static getCurrentLocation(): Promise<CaptureLocation | null> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (error) => {
                    logger.warn('[FieldContactService] Geolocation failed:', error.message);
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 60000, // Cache for 1 minute
                }
            );
        });
    }

    /**
     * Build a human-readable context string from available metadata.
     * e.g. "Mar 11, 2026 • 9:46 PM"
     */
    static buildContextString(location?: CaptureLocation | null): string {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });

        let context = `${dateStr} • ${timeStr}`;

        if (location?.address) {
            context = `📍 ${location.address} • ${context}`;
        } else if (location) {
            context = `📍 ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} • ${context}`;
        }

        return context;
    }
}
