import { logger } from '@/utils/logger';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface LocalPrintJob {
    projectId: string;
    userId: string;
    designUrl: string;
    printType: 'flyer' | 'poster' | 'stickers';
    copies: number;
    shippingAddress: {
        name: string;
        address1: string;
        city: string;
        postalCode: string;
        countryCode: string;
    };
}

export interface PromoterPitch {
    projectId: string;
    userId: string;
    promoterEmail: string;
    promoterName: string;
    pitchSubject: string;
    pitchBody: string;
}

export class PrintDispatchService {
    /**
     * Dispatch a PDF flyer or poster design to a local print shop API.
     */
    static async dispatchPrintJob(job: LocalPrintJob): Promise<{ success: boolean; jobId: string }> {
        try {
            logger.info(`[PrintDispatchService] Dispatching print job for ${job.printType} to local provider...`);
            
            // In production, this calls a global print api (e.g. Gelato) via Firebase functions
            const docRef = await addDoc(collection(db, 'print_jobs'), {
                ...job,
                status: 'pending_dispatch',
                createdAt: serverTimestamp()
            });

            return {
                success: true,
                jobId: docRef.id
            };
        } catch (error: unknown) {
            logger.error('[PrintDispatchService] Print dispatch failed:', error);
            throw error;
        }
    }

    /**
     * Pitch design assets or show schedules directly to local venue promoters.
     */
    static async pitchPromoter(pitch: PromoterPitch): Promise<{ success: boolean }> {
        try {
            logger.info(`[PrintDispatchService] Dispatching pitch email to promoter: ${pitch.promoterEmail}`);
            
            // Record email pitch event in user communications journal
            await addDoc(collection(db, 'promoter_pitches'), {
                ...pitch,
                sentAt: serverTimestamp()
            });

            return { success: true };
        } catch (error: unknown) {
            logger.error('[PrintDispatchService] Promoter pitch failed:', error);
            throw error;
        }
    }
}
