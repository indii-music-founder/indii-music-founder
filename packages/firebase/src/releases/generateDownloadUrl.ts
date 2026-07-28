import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { validateAppCheckV2 } from "../middleware/appCheck";

export const generateReleaseDownloadUrl = onCall(
    {
        region: "us-central1",
        enforceAppCheck: false,
        timeoutSeconds: 30,
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
            // Trap 1 of 7 (see ISSUE-1243): this tested the v1 HttpsError class
            // while the not-found throw above is now v2, so a genuine
            // "release file unavailable" would have fallen through and been
            // relabelled 'internal' with its message discarded. Both sides are
            // v2 now, so the intended pass-through actually works.
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
