import * as functions from "firebase-functions/v1";
import { stripe } from "./config"; // Re-using the stripe config

export const createStripeConnectAccount = functions
    .region("us-west1")
    .runWith({
        timeoutSeconds: 60,
        memory: "256MB"
    })
    .https.onCall(async (data: any, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to create a Stripe Connect account."
            );
        }

        const { email, businessType } = data;

        if (!email) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing 'email'."
            );
        }

        console.log(`[createStripeConnectAccount] Initiating onboarding for ${email} (${businessType})`);

        try {
            // Create the Express account
            const account = await stripe.accounts.create({
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
            const accountLink = await stripe.accountLinks.create({
                account: account.id,
                refresh_url: "https://app.indiios.com/finance/stripe/refresh",
                return_url: "https://app.indiios.com/finance/stripe/success",
                type: "account_onboarding",
            });

            return {
                accountId: account.id,
                onboardingUrl: accountLink.url
            };
        } catch (error: any) {
            console.error("[StripeConnect] Error creating account:", error);
            throw new functions.https.HttpsError(
                "internal",
                `Stripe account creation failed: ${error.message}`
            );
        }
    });
