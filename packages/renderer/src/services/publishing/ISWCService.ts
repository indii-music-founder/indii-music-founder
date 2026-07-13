/**
 * ISWC Service — International Standard Musical Work Code
 *
 * Manages composition identifiers for self-publishing artists.
 * Each ISWC identifies a unique musical work (composition), distinct
 * from the ISRC which identifies a specific recording of that work.
 *
 * Format: T-000.000.000-C (where T = prefix, C = check digit)
 *
 * Note: Official ISWC registration requires CISAC API access.
 * This service manages the local registry and prepares data
 * for batch registration submissions.
 */

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

export interface MusicalWork {
    /** Firestore document ID */
    id: string;

    /** ISWC if registered (null until CISAC confirms) */
    iswc: string | null;

    /** Registration status */
    status: 'draft' | 'pending_registration' | 'registered' | 'rejected';

    /** Work title (composition title, may differ from recording title) */
    title: string;

    /** Alternative/subtitle */
    alternativeTitle?: string;

    /** Composers with IPI numbers and shares */
    composers: WorkComposer[];

    /** Publisher information */
    publisher?: {
        name: string;
        ipiNumber?: string;
        share: number; // 0-100
    };

    /** Associated recordings (ISRCs) */
    associatedISRCs: string[];

    /** Associated release ID */
    releaseId?: string;

    /** Language of lyrics */
    language?: string;

    /** Whether the work is instrumental */
    isInstrumental: boolean;

    /** Ownership */
    userId: string;
    orgId?: string;

    /** Timestamps */
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    registeredAt?: Timestamp | null;
}

export interface WorkComposer {
    /** Legal name of the composer */
    name: string;

    /** IPI (Interested Parties Information) number */
    ipiNumber?: string;

    /** Ownership share (0-100) */
    share: number;

    /** Role: C = Composer, A = Author (lyricist), CA = both */
    role: 'C' | 'A' | 'CA';

    /** PRO affiliation */
    pro?: 'ASCAP' | 'BMI' | 'SESAC' | 'GMR' | 'None';
}

export interface ISWCRegistrationEvidence {
    /** CISAC member society/PRO that assigned or confirmed the work. */
    assigningSociety: string;
    /** Provider-issued confirmation/work-registration receipt. */
    confirmationReference: string;
    /** Exact title shown on the provider confirmation. */
    confirmedWorkTitle: string;
    /** ISO timestamp supplied by the authoritative confirmation. */
    confirmedAt: string;
    /** IPI values shown by the confirmation, used to prevent work mismatch. */
    confirmedComposerIpis: string[];
}

const WORKS_COLLECTION = 'iswc_works';

export class ISWCService {
    /**
     * Register a new musical work in the local registry.
     * Creates a draft record that can later be submitted to CISAC.
     */
    static async registerWork(params: {
        title: string;
        alternativeTitle?: string;
        composers: WorkComposer[];
        publisher?: MusicalWork['publisher'];
        associatedISRCs?: string[];
        releaseId?: string;
        language?: string;
        isInstrumental?: boolean;
    }): Promise<MusicalWork> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        // Validate composer shares sum to 100
        const totalShare = params.composers.reduce((sum, c) => sum + c.share, 0);
        const publisherShare = params.publisher?.share || 0;
        if (totalShare + publisherShare !== 100) {
            throw new Error(`Composer shares (${totalShare}%) + publisher share (${publisherShare}%) must total 100%`);
        }

        const workRef = doc(collection(db, WORKS_COLLECTION));
        const work: MusicalWork = {
            id: workRef.id,
            iswc: null,
            status: 'draft',
            title: params.title,
            alternativeTitle: params.alternativeTitle,
            composers: params.composers,
            publisher: params.publisher,
            associatedISRCs: params.associatedISRCs || [],
            releaseId: params.releaseId,
            language: params.language,
            isInstrumental: params.isInstrumental ?? false,
            userId: user.uid,
            createdAt: null, // Server will set
            updatedAt: null,
        };

        await setDoc(workRef, {
            ...work,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        return work;
    }

    /**
     * Get a musical work by its Firestore document ID.
     */
    static async getById(workId: string): Promise<MusicalWork | null> {
        const docRef = doc(db, WORKS_COLLECTION, workId);
        const snap = await getDoc(docRef);
        return snap.exists() ? (snap.data() as MusicalWork) : null;
    }

    /**
     * Get all works by title (fuzzy match).
     */
    static async getByTitle(title: string): Promise<MusicalWork[]> {
        const q = query(
            collection(db, WORKS_COLLECTION),
            where('title', '==', title),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MusicalWork);
    }

    /**
     * Get all works belonging to the current user.
     */
    static async getByArtist(): Promise<MusicalWork[]> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        const q = query(
            collection(db, WORKS_COLLECTION),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MusicalWork);
    }

    /**
     * Get all works associated with a specific release.
     */
    static async getWorksByCatalog(releaseId: string): Promise<MusicalWork[]> {
        const q = query(
            collection(db, WORKS_COLLECTION),
            where('releaseId', '==', releaseId),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as MusicalWork);
    }

    /**
     * Link an ISRC to an existing work (when a new recording is made of the composition).
     */
    static async linkISRC(workId: string, isrc: string): Promise<void> {
        const work = await ISWCService.getById(workId);
        if (!work) throw new Error(`Work ${workId} not found`);

        const updatedISRCs = [...new Set([...work.associatedISRCs, isrc])];

        const docRef = doc(db, WORKS_COLLECTION, workId);
        await setDoc(docRef, {
            associatedISRCs: updatedISRCs,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    }

    /**
     * Mark a work as submitted for CISAC registration.
     */
    static async submitForRegistration(workId: string): Promise<void> {
        const docRef = doc(db, WORKS_COLLECTION, workId);
        await setDoc(docRef, {
            status: 'pending_registration',
            updatedAt: serverTimestamp(),
        }, { merge: true });
    }

    /**
     * Record a confirmed ISWC from CISAC.
     */
    static async confirmRegistration(workId: string, iswc: string, evidence: ISWCRegistrationEvidence): Promise<void> {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');
        const normalizedIswc = iswc.trim().toUpperCase();
        if (!/^T-\d{3}\.\d{3}\.\d{3}-\d$/.test(normalizedIswc)) {
            throw new Error('ISWC must use the format T-123.456.789-0.');
        }
        if (!evidence.assigningSociety.trim() || !evidence.confirmationReference.trim()) {
            throw new Error('ISWC confirmation requires an assigning society and confirmation reference.');
        }
        if (!Number.isFinite(Date.parse(evidence.confirmedAt))) {
            throw new Error('ISWC confirmation requires a valid confirmation date.');
        }
        const work = await ISWCService.getById(workId);
        if (!work || work.userId !== user.uid) throw new Error('Work not found or not owned by the current user.');
        if (work.title.trim().toLocaleLowerCase() !== evidence.confirmedWorkTitle.trim().toLocaleLowerCase()) {
            throw new Error('ISWC confirmation title does not match this work.');
        }
        const expectedIpis = work.composers.map(composer => composer.ipiNumber).filter((ipi): ipi is string => !!ipi).sort();
        const confirmedIpis = [...new Set(evidence.confirmedComposerIpis.map(ipi => ipi.trim()).filter(Boolean))].sort();
        if (expectedIpis.length > 0 && (expectedIpis.length !== confirmedIpis.length || expectedIpis.some((ipi, index) => ipi !== confirmedIpis[index]))) {
            throw new Error('ISWC confirmation composers do not match this work.');
        }
        const duplicate = await getDocs(query(collection(db, WORKS_COLLECTION), where('iswc', '==', normalizedIswc)));
        if (duplicate.docs.some(snapshot => snapshot.id !== workId)) {
            throw new Error('This ISWC is already assigned to a different local work.');
        }
        const docRef = doc(db, WORKS_COLLECTION, workId);
        await setDoc(docRef, {
            iswc: normalizedIswc,
            status: 'registered',
            registeredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            registrationEvidence: {
                assigningSociety: evidence.assigningSociety.trim(),
                confirmationReference: evidence.confirmationReference.trim(),
                confirmedAt: evidence.confirmedAt,
                confirmedWorkTitle: evidence.confirmedWorkTitle.trim(),
                confirmedComposerIpis: confirmedIpis,
            },
        }, { merge: true });
    }
}
