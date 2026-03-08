export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface PaymentTransaction {
    id: string;
    buyerId: string;
    sellerId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    productId?: string;
    createdAt: string;
    /** Stripe PaymentIntent ID or Checkout Session ID */
    processorId?: string;
    error?: string;
}

/** Ledger entry written to Firestore when an invoice is paid */
export interface LedgerEntry {
    type: 'subscription_payment' | 'one_time_payment' | 'payout' | 'refund';
    invoiceId?: string;
    invoiceNumber?: string;
    amount: number;
    currency: string;
    status: 'paid' | 'pending' | 'failed';
    periodStart?: number | null;
    periodEnd?: number | null;
    pdfUrl?: string | null;
    createdAt: unknown; // Firestore ServerTimestamp
}
