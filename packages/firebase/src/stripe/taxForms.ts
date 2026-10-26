import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { arcjetKey } from '../config/secrets';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { validateAppCheckV2 } from '../middleware/appCheck';

export interface Payee {
    name: string;
    email: string;
    isUsPerson: boolean;
}

export const requestTaxForms = onCall(
    { region: 'us-central1', timeoutSeconds: 60, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, enforceAppCheck: false, secrets: [arcjetKey] },
    async (request): Promise<{ requests: Array<{ name: string; email: string; formTypeRequested: string; status: string; }> }> => {
        if (!request.auth) {
            throw new HttpsError(
                'unauthenticated',
                'User must be authenticated to request tax forms.'
            );
        }

        if (request.auth.token?.email_verified === false || request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('unauthenticated', 'A verified signed-in user is required.');
        }

        validateAppCheckV2(request);

        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: request.auth.token?.admin ? 'admin' : 'verified-free',
                operationId: `request-tax-forms:${randomUUID()}`,
            });
            if (!protection.allowed) {
                throw new HttpsError(
                    protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                    protection.message,
                );
            }
        }

        const { payees } = (request.data ?? {}) as { payees?: Payee[] };

        if (!payees || !Array.isArray(payees)) {
            throw new HttpsError(
                'invalid-argument',
                "Missing 'payees' array."
            );
        }

        // Firestore batches cap at 500 ops; bound the client-fed array well below
        // it so an oversized request fails validation instead of crashing the fn.
        if (payees.length > 200) {
            throw new HttpsError('invalid-argument', "A maximum of 200 payees can be requested per call.");
        }

        const requests = payees.map((payee, index) => {
            if (!payee || typeof payee !== 'object') {
                throw new HttpsError('invalid-argument', `Payee at index ${index} must be an object.`);
            }
            if (!payee.email || typeof payee.email !== 'string' || payee.email.trim().length === 0) {
                throw new HttpsError('invalid-argument', `Payee at index ${index} must have a valid non-empty 'email' string.`);
            }
            if (!payee.name || typeof payee.name !== 'string' || payee.name.trim().length === 0) {
                throw new HttpsError('invalid-argument', `Payee at index ${index} must have a valid non-empty 'name' string.`);
            }
            const formTypeRequested = payee.isUsPerson === true ? "W-9" : "W-8BEN";
            return {
                name: payee.name,
                email: payee.email,
                formTypeRequested,
                status: "REQUESTED"
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
                status: 'REQUESTED',
                requestedAt: new Date().toISOString(),
                validated: false
            }, { merge: true });
        }
        await batch.commit();

        return { requests };
    });
