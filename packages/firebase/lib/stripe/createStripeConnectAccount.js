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
exports.createStripeConnectAccount = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const config_1 = require("./config"); // Re-using the stripe config
exports.createStripeConnectAccount = functions
    .region("us-west1")
    .runWith({
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to create a Stripe Connect account.");
    }
    const { email, businessType } = data;
    if (!email) {
        throw new functions.https.HttpsError("invalid-argument", "Missing 'email'.");
    }
    console.log(`[createStripeConnectAccount] Initiating onboarding for ${email} (${businessType})`);
    try {
        // Create the Express account
        const account = await config_1.stripe.accounts.create({
            type: "express",
            email: email,
            business_type: businessType === "company" ? "company" : "individual",
            metadata: { userId: context.auth.uid },
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
        });
        // Generate the onboarding link (return in response)
        const accountLink = await config_1.stripe.accountLinks.create({
            account: account.id,
            refresh_url: "https://app.indiios.com/finance/stripe/refresh",
            return_url: "https://app.indiios.com/finance/stripe/success",
            type: "account_onboarding",
        });
        return {
            accountId: account.id,
            onboardingUrl: accountLink.url
        };
    }
    catch (error) {
        console.error("[StripeConnect] Error creating account:", error);
        throw new functions.https.HttpsError("internal", `Stripe account creation failed: ${error.message}`);
    }
});
//# sourceMappingURL=createStripeConnectAccount.js.map