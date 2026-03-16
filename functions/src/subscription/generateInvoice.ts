/**
 * Firebase Cloud Function: Generate Invoice
 *
 * Assembles structured invoice data from Stripe + Firestore for a given
 * subscription period. Returns JSON; the client renders it with the browser
 * print API or jsPDF.
 *
 * Item 205: PDF Invoice Generation for enterprise/label plan subscribers.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { stripe } from '../stripe/config';
import { stripeSecretKey } from '../config/secrets';

export interface InvoiceData {
    invoiceId: string;
    invoiceNumber: string;
    status: string;
    created: number;
    dueDate: number | null;
    periodStart: number;
    periodEnd: number;
    customerName: string;
    customerEmail: string;
    lines: Array<{
        description: string;
        quantity: number;
        unitAmount: number;
        amount: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    pdfUrl: string | null;
}

export const generateInvoice = onCall({
    secrets: [stripeSecretKey],
    timeoutSeconds: 30,
    memory: '256MiB',
}, async (request) => {
    const { invoiceId } = request.data as { invoiceId?: string };

    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User must be signed in.');
    }

    const db = getFirestore();
    const userId = request.auth.uid;

    // Get the subscription to verify ownership and get stripeCustomerId
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    if (!subscriptionDoc.exists) {
        throw new HttpsError('not-found', 'No subscription found.');
    }

    const { stripeCustomerId } = subscriptionDoc.data() as { stripeCustomerId?: string };
    if (!stripeCustomerId) {
        throw new HttpsError('failed-precondition', 'No Stripe customer associated with this account.');
    }

    try {
        let invoice;

        if (invoiceId) {
            // Fetch specific invoice and verify it belongs to this customer
            invoice = await stripe.invoices.retrieve(invoiceId);
            if (invoice.customer !== stripeCustomerId) {
                throw new HttpsError('permission-denied', 'Invoice does not belong to this account.');
            }
        } else {
            // Fetch the most recent paid invoice for this customer
            const invoices = await stripe.invoices.list({
                customer: stripeCustomerId,
                status: 'paid',
                limit: 1,
            });
            if (invoices.data.length === 0) {
                throw new HttpsError('not-found', 'No paid invoices found.');
            }
            invoice = invoices.data[0];
        }

        // Retrieve customer details
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        const customerName = 'deleted' in customer ? 'Unknown' : (customer.name || '');
        const customerEmail = 'deleted' in customer ? '' : (customer.email || '');

        const invoiceData: InvoiceData = {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number || invoice.id,
            status: invoice.status || 'unknown',
            created: invoice.created * 1000,
            dueDate: invoice.due_date ? invoice.due_date * 1000 : null,
            periodStart: (invoice as any).period_start * 1000,
            periodEnd: (invoice as any).period_end * 1000,
            customerName,
            customerEmail,
            lines: invoice.lines.data.map((line) => ({
                description: line.description || '',
                quantity: line.quantity || 1,
                unitAmount: (line as any).unit_amount_excluding_tax
                    ? parseInt((line as any).unit_amount_excluding_tax)
                    : (line.amount || 0),
                amount: line.amount || 0,
            })),
            subtotal: invoice.subtotal || 0,
            tax: (invoice as any).tax || 0,
            total: invoice.total || 0,
            currency: invoice.currency || 'usd',
            pdfUrl: invoice.invoice_pdf || null,
        };

        return invoiceData;
    } catch (error: any) {
        if (error instanceof HttpsError) throw error;
        console.error('[generateInvoice] Error:', error);
        throw new HttpsError('internal', error.message || 'Failed to generate invoice');
    }
});
