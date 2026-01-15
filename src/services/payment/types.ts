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
    processorId?: string; // Stripe PaymentIntent ID, etc.
    error?: string;
}

export interface PaymentProvider {
    name: string;
    processPayment(transaction: Omit<PaymentTransaction, 'id' | 'status' | 'createdAt'>): Promise<PaymentTransaction>;
    refundPayment(transactionId: string): Promise<boolean>;
}

export interface PaymentConfig {
    provider: 'stripe' | 'lemonsqueezy' | 'mock';
    enabled: boolean;
    apiKey?: string;
}
