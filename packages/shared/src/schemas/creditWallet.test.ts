import { describe, it, expect } from 'vitest';
import {
  CreditWalletSchema,
  CreditTransactionSchema,
  CreditPackSchema,
  STANDARD_CREDIT_PACKS,
} from './creditWallet';

describe('creditWallet schema', () => {
  it('validates a correct credit wallet', () => {
    const valid = {
      userId: 'user_123',
      balanceCredits: 750,
      autoTopUp: true,
      autoTopUpThreshold: 100,
      autoTopUpPackId: 'pack_starter_500',
      currency: 'USD',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(() => CreditWalletSchema.parse(valid)).not.toThrow();
  });

  it('rejects negative credit balances in wallet', () => {
    const invalid = {
      userId: 'user_123',
      balanceCredits: -50,
      autoTopUp: false,
      autoTopUpThreshold: 100,
      currency: 'USD',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(() => CreditWalletSchema.parse(invalid)).toThrow();
  });

  it('validates credit transaction deductions and additions', () => {
    const deduction = {
      id: 'tx_1',
      userId: 'user_123',
      type: 'CONSUMPTION' as const,
      amountCredits: -50,
      balanceAfter: 700,
      reason: 'AI Video Generation (OmniWorkflow)',
      referenceId: 'gen_video_001',
      createdAt: Date.now(),
    };
    expect(() => CreditTransactionSchema.parse(deduction)).not.toThrow();

    const purchase = {
      id: 'tx_2',
      userId: 'user_123',
      type: 'PURCHASE' as const,
      amountCredits: 500,
      balanceAfter: 1200,
      reason: 'Stripe Purchase: Starter Pack',
      referenceId: 'pi_stripe_123',
      createdAt: Date.now(),
    };
    expect(() => CreditTransactionSchema.parse(purchase)).not.toThrow();
  });

  it('verifies standard credit packs are valid and configured properly', () => {
    expect(STANDARD_CREDIT_PACKS.length).toBeGreaterThan(0);
    for (const pack of STANDARD_CREDIT_PACKS) {
      expect(() => CreditPackSchema.parse(pack)).not.toThrow();
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.priceUsdCents).toBeGreaterThan(0);
    }
  });
});
