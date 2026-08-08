import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import { importWithRetry } from '@/utils/dynamicImport';
import {
    getReleaseIsrc,
    getReleaseTitle,
    getReleaseWriters,
    releaseCatalogService,
} from '@/services/distribution/ReleaseCatalogService';

const queryProDatabase = wrapTool('query_pro_database', async (args: {
    trackTitle: string;
    writers?: string[];
    pro?: 'ASCAP' | 'BMI' | 'SESAC';
}) => {
    const pro = args.pro || 'ASCAP/BMI';
    const titleLower = args.trackTitle.toLowerCase().trim();

    // Search the user's canonical local release catalog. This is not a live PRO
    // repertory query and must never be described as verified registration.
    const existingRecords: Array<{ workId: string; registeredWriters: string[]; status: string; isrc?: string }> = [];
    try {
        const releases = await releaseCatalogService.listCurrentUserReleases();
        releases.forEach(release => {
            const releaseTitle = getReleaseTitle(release.data)?.toLowerCase().trim();
            if (releaseTitle && (releaseTitle.includes(titleLower) || titleLower.includes(releaseTitle))) {
                const isrc = getReleaseIsrc(release.data);
                const proWorkId = typeof release.data.proWorkId === 'string' ? release.data.proWorkId : undefined;
                const proStatus = typeof release.data.proStatus === 'string' ? release.data.proStatus : undefined;
                const releaseWriters = getReleaseWriters(release.data);
                existingRecords.push({
                    workId: proWorkId || isrc || release.id,
                    registeredWriters: releaseWriters.length > 0 ? releaseWriters : args.writers || [],
                    status: proStatus || 'PRO registration unverified',
                    ...(isrc ? { isrc } : {}),
                });
            }
        });
    } catch (e: unknown) {
        logger.error('[PublishingTools] Local release catalog lookup failed:', e);
        const message = e instanceof Error ? e.message : String(e);
        const code = /sign in/i.test(message) ? 'AUTH_REQUIRED' : 'RELEASE_CATALOG_LOOKUP_FAILED';
        return toolError(`Local release catalog lookup failed: ${message}`, code);
    }

    if (existingRecords.length > 0) {
        return toolSuccess({
            matchFound: true,
            proQueried: pro,
            trackTitle: args.trackTitle,
            existingRecords,
            note: 'Match found in indii catalog. Verify with official PRO portal before re-registering.'
        }, `Found ${existingRecords.length} existing catalog match(es) for "${args.trackTitle}". Verify at ${pro} before filing a new registration.`);
    }

    // No local match after a successful query. Real ASCAP/BMI API keys are
    // required for any claim about the official repertory.
    return toolSuccess({
        matchFound: false,
        proQueried: pro,
        trackTitle: args.trackTitle,
        writers: args.writers || [],
        message: `"${args.trackTitle}" not found in local catalog. No PRO API key configured - verify manually at ${pro === 'ASCAP' ? 'https://www.ascap.com/repertory' : pro === 'BMI' ? 'https://repertoire.bmi.com' : 'https://www.sesac.com'} before registering.`
    }, `"${args.trackTitle}" not found in the local catalog. Manual verification at ${pro} is required before new registration.`);
});

export const PublishingTools = {
    query_pro_database: queryProDatabase,

    check_pro_catalog: wrapTool('check_pro_catalog', async (args: {
        trackTitle: string;
        writerName: string;
        ipiNumber?: string;
    }) => {
        const result = await queryProDatabase({
            trackTitle: args.trackTitle,
            writers: [args.writerName],
        });

        return {
            ...result,
            data: {
                ...(result.data || {}),
                writerName: args.writerName,
                ipiNumber: args.ipiNumber || null,
            },
        };
    }),

    register_catalog_work: wrapTool('register_catalog_work', async (args: {
        trackTitle: string;
        writers: string[];
        isrc?: string;
        ownershipPercentage: number;
        publisher?: string;
    }) => {
        try {
            const { db, auth } = await importWithRetry(() => import('@/services/firebase'));
            const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));

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
            const { db, auth } = await importWithRetry(() => import('@/services/firebase'));
            const { doc, updateDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));

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
    }),

    search_pro_database: wrapTool('search_pro_database', async (args: {
        query: string;
        society?: 'ASCAP' | 'BMI' | 'SESAC' | string;
    }) => {
        const result = await queryProDatabase({
            trackTitle: args.query,
            pro: args.society as 'ASCAP' | 'BMI' | 'SESAC' | undefined
        });
        return {
            ...result,
            data: {
                ...(result.data || {}),
                query: args.query,
                society: args.society
            }
        };
    }),

    // ISSUE-812: this tool used to fabricate `status: 'Submitted'` and a
    // random `proReferenceId` — there is no real ASCAP/BMI/SESAC API
    // integration (those require B2B credentials this app doesn't have).
    // It now stores a real draft packet and honestly reports that manual
    // submission at the PRO's own portal is required — never a fake
    // confirmation or reference ID.
    register_work_with_pro: wrapTool('register_work_with_pro', async (args: {
        workTitle: string;
        writers: Array<{ name: string; ipi?: string; role: string; split: number }>;
        publisher?: { name: string; ipi?: string; split: number };
        society: 'ASCAP' | 'BMI' | 'SESAC' | string;
    }) => {
        try {
            const { db, auth } = await importWithRetry(() => import('@/services/firebase'));
            const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));

            const uid = auth.currentUser?.uid;
            if (!uid) {
                return toolError("User must be authenticated to prepare a PRO registration draft.");
            }

            const portalUrl = args.society === 'ASCAP' ? 'https://www.ascap.com/repertory'
                : args.society === 'BMI' ? 'https://repertoire.bmi.com'
                : args.society === 'SESAC' ? 'https://www.sesac.com'
                : `the ${args.society} member portal`;

            const docRef = await addDoc(collection(db, 'users', uid, 'proSubmissionDrafts'), {
                workTitle: args.workTitle,
                writers: args.writers,
                publisher: args.publisher || null,
                society: args.society,
                status: 'requires_manual_submission',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            return toolSuccess({
                status: 'requires_manual_submission',
                draftId: docRef.id,
                workTitle: args.workTitle,
                society: args.society,
                writers: args.writers,
                publisher: args.publisher
            }, `Prepared a draft registration packet for "${args.workTitle}" (ID: ${docRef.id}). indii has no direct ${args.society} filing integration — submit this work manually at ${portalUrl}.`);
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[PublishingTools] PRO draft creation failed:', error);
            return toolError(`Failed to prepare PRO registration draft: ${error.message}`);
        }
    })
} satisfies Record<string, AnyToolFunction>;

export const {
    query_pro_database,
    check_pro_catalog,
    register_catalog_work,
    update_catalog_work,
    search_pro_database,
    register_work_with_pro
} = PublishingTools;
