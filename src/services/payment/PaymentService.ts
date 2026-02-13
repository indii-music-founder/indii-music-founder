import { PaymentProvider, PaymentTransaction, PaymentConfig } from './types';

/**
 * PaymentService
 * Centralized handler for all payment processing operations.
 */
export class PaymentService implements PaymentProvider {
    name = 'IndiiOS Payment Service';
    private config: PaymentConfig;

    constructor(config: PaymentConfig) {
        this.config = config;
    }

    /**
     * Initialize the payment service with configuration.
     */
    configure(config: PaymentConfig) {
        this.config = config;
    }

    /**
     * Process a payment transaction.
     */
    async processPayment(data: Omit<PaymentTransaction, 'id' | 'status' | 'createdAt'>): Promise<PaymentTransaction> {
        if (!this.config.enabled) {
            // In DEV mode, we allow mock processing even if disabled for testing UI flows
            if (import.meta.env.DEV) {
                console.info('[PaymentService] 🚧 MOCK MODE: Processing simulated payment', data);
                await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate latency

                return {
                    id: `mock_tx_${Date.now()}`,
                    status: 'completed',
                    amount: data.amount,
                    currency: data.currency,
                    buyerId: data.buyerId,
                    sellerId: data.sellerId,
                    createdAt: new Date().toISOString()
                };
            }

            console.warn('[PaymentService] Payment processing is currently disabled.');
            throw new Error('Payment processing is not yet enabled in this environment.');
        }

        // Implementation for real providers would go here
        if (this.config.provider === 'stripe') {
            throw new Error('Stripe integration is pending configuration. Please set VITE_STRIPE_PUBLIC_KEY.');
        }

        throw new Error(`Payment provider '${this.config.provider}' is not fully implemented.`);
    }

    /**
     * Refund a transaction.
     */
    async refundPayment(transactionId: string): Promise<boolean> {
        console.info(`[PaymentService] Requesting refund for ${transactionId}`);
        // Mock success in dev
        if (import.meta.env.DEV) return true;

        throw new Error('Refunds are not yet implemented.');
    }
}

// Singleton instance
export const paymentService = new PaymentService({
    provider: 'stripe',
    enabled: false // Keep disabled by default for safety
});
