"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransfer = exports.createStripeAccount = void 0;
const functions = __importStar(require("firebase-functions"));
const config_1 = require("./config");
/**
 * Triggered by the client to create a Stripe Connect Express account for an artist.
 */
exports.createStripeAccount = functions.https.onCall(async (data, context) => {
    // 1. Basic auth check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }
    const { artistId } = data;
    // Stripe instance is pre-configured and exported from ./config.ts
    try {
        // 2. Create the Express account
        const account = await config_1.stripe.accounts.create({
            type: 'express',
            metadata: { artistId },
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
        });
        // 3. Generate the onboarding link (return in response)
        const accountLink = await config_1.stripe.accountLinks.create({
            account: account.id,
            refresh_url: 'https://app.indiios.com/finance/stripe/refresh',
            return_url: 'https://app.indiios.com/finance/stripe/success',
            type: 'account_onboarding',
        });
        return {
            accountId: account.id,
            onboardingUrl: accountLink.url
        };
    }
    catch (error) {
        console.error('[StripeConnect] Error creating account:', error);
        throw new functions.https.HttpsError('internal', 'Stripe account creation failed.');
    }
});
/**
 * Triggers a payout/transfer from the platform to the destination artist.
 */
exports.createTransfer = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }
    const { amount, destinationId, currency = 'usd' } = data;
    // Stripe instance is pre-configured and exported from ./config.ts
    try {
        const transfer = await config_1.stripe.transfers.create({
            amount, // in cents
            currency,
            destination: destinationId,
            description: `indiiOS Royalty Payout - Artist ID: ${context.auth.uid}`
        });
        return { transferId: transfer.id };
    }
    catch (error) {
        console.error('[StripeConnect] Transfer failed:', error);
        throw new functions.https.HttpsError('internal', 'Stripe transfer failed.');
    }
});
//# sourceMappingURL=connect.js.map