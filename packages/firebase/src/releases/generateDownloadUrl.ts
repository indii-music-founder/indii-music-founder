import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { validateAppCheckV2 } from "../middleware/appCheck";

export const generateReleaseDownloadUrl = onCall(
    {
        region: "us-central1",
        enforceAppCheck: false,
        timeoutSeconds: 30,
        memory: "512MiB",
        cpu: "gcf_gen1",
        concurrency: 1,
    },
    async (request): Promise<{ success: boolean; url?: string; message?: string }> => {
        validateAppCheckV2(request);
        if (!request.auth) {
            throw new HttpsError(
                "unauthenticated",
                "User must be authenticated to download releases."
            );
        }

        const userId = request.auth.uid;
        const data = request.data;
        const safeData = (typeof data === 'object' && data !== null) ? data as Record<string, unknown> : {};
        const platform = safeData.platform as string;

        if (platform !== 'mac' && platform !== 'windows') {
            throw new HttpsError(
                "invalid-argument",
                "Invalid platform requested. Must be 'mac' or 'windows'."
            );
        }

        // Verify founder status in Firestore
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new HttpsError("not-found", "User profile not found.");
        }

        const userData = userDoc.data();
        if (userData?.subscriptionTier !== 'founder' && userData?.tier !== 'founder' && userData?.isFounder !== true) {
            throw new HttpsError(
                "permission-denied",
                "You must be a verified Founder to download the application releases."
            );
        }

        const fileName = platform === 'mac' ? 'indii-Installer.dmg' : 'indii-Setup.exe';
        const filePath = `founders/releases/${fileName}`;

        try {
            const bucket = admin.storage().bucket();
            const file = bucket.file(filePath);

            const [exists] = await file.exists();
            if (!exists) {
                console.error(`[ReleaseDownload] File not found in storage: ${filePath}`);
                throw new HttpsError("not-found", "The requested release file is currently unavailable.");
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
            // Passes the not-found raised above through unchanged instead of
            // relabelling it 'internal'. The reference was renamed from
            // functions.https.HttpsError to HttpsError as part of ISSUE-1243;
            // that is cosmetic, not a fix. firebase-functions re-exports one
            // HttpsError class from common/providers/https to both v1 and v2,
            // so this check behaved identically before the rename.
            if (error instanceof HttpsError) {
                throw error;
            }
            console.error("[ReleaseDownload] Error generating signed URL:", error);
            throw new HttpsError(
                "internal",
                "Failed to generate download link."
            );
        }
    },
);
