import { defineCallable, HttpsError } from '../factory';
import { getFirestore } from 'firebase-admin/firestore';

export interface Payee {
    name: string;
    email: string;
    isUsPerson: boolean;
}

export const requestTaxForms = defineCallable<{ payees?: Payee[] }, any>(
    { region: 'us-central1', memory: '256MiB', timeoutSeconds: 60 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError(
                'unauthenticated',
                'User must be authenticated to request tax forms.'
            );
        }

        const { payees } = request.data;

        if (!payees || !Array.isArray(payees)) {
            throw new HttpsError(
                'invalid-argument',
                "Missing 'payees' array."
            );
        }

        const requests = payees.map((payee) => {
            const formTypeRequested = payee.isUsPerson ? "W-9" : "W-8BEN";
            return {
                name: payee.name,
                email: payee.email,
                formTypeRequested,
                status: "SENT"
            };
        });

        const db = getFirestore();
        const batch = db.batch();
        for (const req of requests) {
            const docRef = db.collection('taxForms').doc(req.email);
            batch.set(docRef, {
                name: req.name,
                email: req.email,
                formTypeRequested: req.formTypeRequested,
                status: 'SENT',
                requestedAt: new Date().toISOString(),
                validated: false
            }, { merge: true });
        }
        await batch.commit();

        return { requests };
    }
);
