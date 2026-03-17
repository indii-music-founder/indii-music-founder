import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

export const PublishingTools: Record<string, AnyToolFunction> = {
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
        } catch (e) {
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
    })
};

export const { query_pro_database } = PublishingTools;