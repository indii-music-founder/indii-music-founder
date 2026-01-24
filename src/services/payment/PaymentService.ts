import { PaymentProvider, PaymentTransaction, PaymentConfig } from './types';

/**
 * PaymentService
 * Centralized handler for all payment processing operations.
 * Currently serves as a placeholder/skeleton for future integration (Stripe/LemonSqueezy).
 */
export class PaymentService implements PaymentProvider {
    name = 'IndiiOS Payment Service';
    private config: PaymentConfig;

    constructor(config: PaymentConfig) {
        this.config = config;
    }

    /**
     * Initialize the payment service with configuration.
     * Can be updated dynamically if needed.
     */
    configure(config: PaymentConfig) {
        this.config = config;
    }

    /**
     * Process a payment transaction.
     * @throws Error if payment processing is not enabled or implemented.
     */
    async processPayment(data: Omit<PaymentTransaction, 'id' | 'status' | 'createdAt'>): Promise<PaymentTransaction> {
        if (!this.config.enabled) {
            console.warn('[PaymentService] Payment processing is currently disabled.');
            throw new Error('Payment processing is not yet enabled in this environment.');
        }

        // Future: Switch based on provider
        // if (this.config.provider === 'stripe') { ... }

        console.info('[PaymentService] Processing payment request:', data);

        throw new Error(`Payment provider '${this.config.provider}' is not fully implemented.`);
    }

    /**
     * Refund a transaction.
     */
    async refundPayment(transactionId: string): Promise<boolean> {
        if (!this.config.enabled) return false;

        console.info(`[PaymentService] Requesting refund for ${transactionId}`);
        throw new Error('Refunds are not yet implemented.');
    }
}

// Singleton instance with default "Disabled" configuration
export const paymentService = new PaymentService({
    provider: 'stripe', // Default target
    enabled: false      // Explicitly disabled for safety
});
