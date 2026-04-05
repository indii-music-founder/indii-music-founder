"use strict";
/**
 * Firebase Cloud Function: Generate Invoice
 *
 * Assembles structured invoice data from Stripe + Firestore for a given
 * subscription period. Returns JSON; the client renders it with the browser
 * print API or jsPDF.
 *
 * Item 205: PDF Invoice Generation for enterprise/label plan subscribers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoice = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const config_1 = require("../stripe/config");
const secrets_1 = require("../config/secrets");
exports.generateInvoice = (0, https_1.onCall)({
    secrets: [secrets_1.stripeSecretKey],
    timeoutSeconds: 30,
    memory: '256MiB',
    enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
}, async (request) => {
    var _a;
    const { invoiceId } = request.data;
    if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new https_1.HttpsError('unauthenticated', 'User must be signed in.');
    }
    const db = (0, firestore_1.getFirestore)();
    const userId = request.auth.uid;
    // Get the subscription to verify ownership and get stripeCustomerId
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    if (!subscriptionDoc.exists) {
        throw new https_1.HttpsError('not-found', 'No subscription found.');
    }
    const { stripeCustomerId } = subscriptionDoc.data();
    if (!stripeCustomerId) {
        throw new https_1.HttpsError('failed-precondition', 'No Stripe customer associated with this account.');
    }
    try {
        let invoice;
        if (invoiceId) {
            // Fetch specific invoice and verify it belongs to this customer
            invoice = await config_1.stripe.invoices.retrieve(invoiceId);
            if (invoice.customer !== stripeCustomerId) {
                throw new https_1.HttpsError('permission-denied', 'Invoice does not belong to this account.');
            }
        }
        else {
            // Fetch the most recent paid invoice for this customer
            const invoices = await config_1.stripe.invoices.list({
                customer: stripeCustomerId,
                status: 'paid',
                limit: 1,
            });
            if (invoices.data.length === 0) {
                throw new https_1.HttpsError('not-found', 'No paid invoices found.');
            }
            invoice = invoices.data[0];
        }
        // Retrieve customer details
        const customer = await config_1.stripe.customers.retrieve(stripeCustomerId);
        const customerName = 'deleted' in customer ? 'Unknown' : (customer.name || '');
        const customerEmail = 'deleted' in customer ? '' : (customer.email || '');
        const invoiceData = {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number || invoice.id,
            status: invoice.status || 'unknown',
            created: invoice.created * 1000,
            dueDate: invoice.due_date ? invoice.due_date * 1000 : null,
            periodStart: invoice.period_start ? invoice.period_start * 1000 : 0,
            periodEnd: invoice.period_end ? invoice.period_end * 1000 : 0,
            customerName,
            customerEmail,
            lines: invoice.lines.data.map((line) => ({
                description: line.description || '',
                quantity: line.quantity || 1,
                unitAmount: line.unit_amount_excluding_tax
                    ? parseInt(line.unit_amount_excluding_tax)
                    : (line.amount || 0),
                amount: line.amount || 0,
            })),
            subtotal: invoice.subtotal || 0,
            tax: invoice.tax || 0,
            total: invoice.total || 0,
            currency: invoice.currency || 'usd',
            pdfUrl: invoice.invoice_pdf || null,
        };
        return invoiceData;
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('[generateInvoice] Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to generate invoice');
    }
});
//# sourceMappingURL=generateInvoice.js.map