/**
 * PaymentService Tests
 *
 * Validates one-off Stripe checkout session creation and invoice retrieval
 * via Cloud Functions.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

import {
    createOneTimePayment,
    getLatestInvoice,
    type OneTimePaymentRequest,
} from './PaymentService';

describe('PaymentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createOneTimePayment', () => {
        const validRequest: OneTimePaymentRequest = {
            userId: 'user-123',
            items: [
                {
                    name: 'Beat License',
                    description: 'Non-exclusive beat license',
                    amount: 2999,
                    quantity: 1,
                    metadata: { beatId: 'beat-456' },
                },
            ],
            customerEmail: 'artist@example.com',
            metadata: { source: 'marketplace' },
        };

        it('should create a checkout session and return the URL', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: {
                    checkoutUrl: 'https://checkout.stripe.com/session/cs_test_abc',
                    sessionId: 'cs_test_abc',
                },
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const url = await createOneTimePayment(validRequest);

            expect(url).toBe('https://checkout.stripe.com/session/cs_test_abc');
            expect(mockHttpsCallable).toHaveBeenCalledWith(
                expect.anything(),
                'createOneTimeCheckout'
            );
            expect(mockCallable).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-123',
                    items: validRequest.items,
                    successUrl: expect.stringContaining('/finance?payment=success'),
                    cancelUrl: expect.stringContaining('/finance?payment=cancelled'),
                })
            );
        });

        it('should use custom success/cancel URLs when provided', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: {
                    checkoutUrl: 'https://checkout.stripe.com/session/cs_test_def',
                    sessionId: 'cs_test_def',
                },
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const customRequest: OneTimePaymentRequest = {
                ...validRequest,
                successUrl: 'https://myapp.com/success',
                cancelUrl: 'https://myapp.com/cancel',
            };

            await createOneTimePayment(customRequest);

            expect(mockCallable).toHaveBeenCalledWith(
                expect.objectContaining({
                    successUrl: 'https://myapp.com/success',
                    cancelUrl: 'https://myapp.com/cancel',
                })
            );
        });

        it('should throw when no checkout URL is returned', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: { checkoutUrl: '', sessionId: '' },
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            await expect(createOneTimePayment(validRequest)).rejects.toThrow(
                'No checkout URL returned from server.'
            );
        });

        it('should propagate Cloud Function errors', async () => {
            const mockCallable = vi.fn().mockRejectedValue(
                new Error('Stripe rate limit exceeded')
            );
            mockHttpsCallable.mockReturnValue(mockCallable);

            await expect(createOneTimePayment(validRequest)).rejects.toThrow(
                'Stripe rate limit exceeded'
            );
        });
    });

    describe('getLatestInvoice', () => {
        it('should fetch invoice data from Cloud Function', async () => {
            const invoiceData = {
                id: 'inv_abc',
                amount: 2999,
                status: 'paid',
                items: [{ name: 'Beat License', amount: 2999 }],
            };
            const mockCallable = vi.fn().mockResolvedValue({ data: invoiceData });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const result = await getLatestInvoice('inv_abc');

            expect(result).toEqual(invoiceData);
            expect(mockHttpsCallable).toHaveBeenCalledWith(
                expect.anything(),
                'generateInvoice'
            );
            expect(mockCallable).toHaveBeenCalledWith({ invoiceId: 'inv_abc' });
        });

        it('should call without invoiceId for latest invoice', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: { id: 'inv_latest', amount: 1500 },
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const result = await getLatestInvoice();

            expect(result).toEqual({ id: 'inv_latest', amount: 1500 });
            expect(mockCallable).toHaveBeenCalledWith({ invoiceId: undefined });
        });
    });
});
