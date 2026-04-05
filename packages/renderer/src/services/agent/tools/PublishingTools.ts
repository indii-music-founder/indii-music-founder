import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

export const PublishingTools = {
    query_pro_database: wrapTool('query_pro_database', async (args: {
        trackTitle: string;
        writers?: string[];
        pro?: 'ASCAP' | 'BMI' | 'SESAC';
    }) => {
        const pro = args.pro || 'ASCAP/BMI';
        const titleLower = args.trackTitle.toLowerCase().trim();

        // 1. Search the user's own DDEX release catalog in Firestore for an existing registration
        const existingRecords: Array<{ workId: string; registeredWriters: string[]; status: string; isrc?: string }> = [];
        try {
            const { db, auth } = await import('@/services/firebase');
            const { collection, query, where, getDocs } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (uid) {
                const releasesRef = collection(db, 'users', uid, 'ddexReleases');
                const q = query(releasesRef, where('trackTitle_lower', '>=', titleLower), where('trackTitle_lower', '<=', titleLower + '\uf8ff'));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    snap.forEach(doc => {
                        const data = doc.data();
                        if (data.trackTitle?.toLowerCase().includes(titleLower) || titleLower.includes(data.trackTitle?.toLowerCase())) {
                            existingRecords.push({
                                workId: data.proWorkId || data.isrc || doc.id,
                                registeredWriters: data.writers || args.writers || [],
                                status: data.proStatus || 'Registered in indiiOS catalog',
                                isrc: data.isrc,
                            });
                        }
                    });
                }
            }
        } catch (e: unknown) {
            logger.warn('[PublishingTools] Firestore PRO lookup failed:', e);
        }

        if (existingRecords.length > 0) {
            return toolSuccess({
                matchFound: true,
                proQueried: pro,
                trackTitle: args.trackTitle,
                existingRecords,
                note: 'Match found in indiiOS catalog. Verify with official PRO portal before re-registering.'
            }, `Found ${existingRecords.length} existing catalog match(es) for "${args.trackTitle}". Verify at ${pro} before filing a new registration.`);
        }

        // 2. No Firestore match — deterministically return "not found" (no coin flip)
        //    Real ASCAP/BMI API keys required for live PRO catalog queries.
        return toolSuccess({
            matchFound: false,
            proQueried: pro,
            trackTitle: args.trackTitle,
            writers: args.writers || [],
            message: `"${args.trackTitle}" not found in local catalog. No PRO API key configured — verify manually at ${pro === 'ASCAP' ? 'https://www.ascap.com/repertory' : pro === 'BMI' ? 'https://repertoire.bmi.com' : 'https://www.sesac.com'} before registering.`
        }, `"${args.trackTitle}" not found in the local catalog. Manual verification at ${pro} is required before new registration.`);
    }),

    register_catalog_work: wrapTool('register_catalog_work', async (args: {
        trackTitle: string;
        writers: string[];
        isrc?: string;
        ownershipPercentage: number;
        publisher?: string;
    }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to register catalog works.");
            }

            const docRef = await addDoc(collection(db, 'users', uid, 'publishingCatalog'), {
                ...args,
                trackTitle_lower: args.trackTitle.toLowerCase().trim(),
                status: 'Draft',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            return toolSuccess({
                catalogId: docRef.id,
                ...args
            }, `Successfully registered "${args.trackTitle}" into the Firestore publishing catalog (ID: ${docRef.id}).`);
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[PublishingTools] Registration failed:', error);
            return toolError(`Failed to register catalog work: ${error.message}`);
        }
    }),

    update_catalog_work: wrapTool('update_catalog_work', async (args: {
        catalogId: string;
        status?: string;
        isrc?: string;
    }) => {
        try {
            const { db, auth } = await import('@/services/firebase');
            const { doc, updateDoc, serverTimestamp, FieldValue } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to update catalog works.");
            }

            const docRef = doc(db, 'users', uid, 'publishingCatalog', args.catalogId);

            const updates: Record<string, string | ReturnType<typeof serverTimestamp>> = {
                updatedAt: serverTimestamp()
            };

            if (args.status) updates.status = args.status;
            if (args.isrc) updates.isrc = args.isrc;

            await updateDoc(docRef, updates);

            return toolSuccess({
                catalogId: args.catalogId,
                updates
            }, `Successfully updated catalog work ${args.catalogId}.`);
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[PublishingTools] Update failed:', error);
            return toolError(`Failed to update catalog work: ${error.message}`);
        }
    })
} satisfies Record<string, AnyToolFunction>;

export const { query_pro_database, register_catalog_work, update_catalog_work } = PublishingTools;