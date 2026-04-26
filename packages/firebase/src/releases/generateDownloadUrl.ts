import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const ENFORCE_APP_CHECK = process.env.SKIP_APP_CHECK !== 'true';

export const generateReleaseDownloadUrl = functions
    .region("us-west1")
    .runWith({
        enforceAppCheck: ENFORCE_APP_CHECK,
        timeoutSeconds: 30,
        memory: "256MB"
    })
    .https.onCall(async (data: unknown, context: functions.https.CallableContext): Promise<{ success: boolean; url?: string; message?: string }> => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to download releases."
            );
        }

        const userId = context.auth.uid;
        const safeData = (typeof data === 'object' && data !== null) ? data as Record<string, unknown> : {};
        const platform = safeData.platform as string;

        if (platform !== 'mac' && platform !== 'windows') {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Invalid platform requested. Must be 'mac' or 'windows'."
            );
        }

        // Verify founder status in Firestore
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError("not-found", "User profile not found.");
        }

        const userData = userDoc.data();
        if (userData?.subscriptionTier !== 'founder' && userData?.tier !== 'founder' && userData?.isFounder !== true) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "You must be a verified Founder to download the application releases."
            );
        }

        const fileName = platform === 'mac' ? 'indiiOS-Installer.dmg' : 'indiiOS-Setup.exe';
        const filePath = `founders/releases/${fileName}`;

        try {
            const bucket = admin.storage().bucket();
            const file = bucket.file(filePath);

            const [exists] = await file.exists();
            if (!exists) {
                console.error(`[ReleaseDownload] File not found in storage: ${filePath}`);
                throw new functions.https.HttpsError("not-found", "The requested release file is currently unavailable.");
            }

            // Generate a signed URL valid for 15 minutes
            const expiresAt = Date.now() + 15 * 60 * 1000;
            const [url] = await file.getSignedUrl({
                action: 'read',
                expires: expiresAt,
            });

            console.log(`[ReleaseDownload] Generated signed URL for user ${userId} (${platform})`);

            return { success: true, url };
        } catch (error) {
            console.error("[ReleaseDownload] Error generating signed URL:", error);
            throw new functions.https.HttpsError(
                "internal",
                "Failed to generate download link."
            );
        }
    });
