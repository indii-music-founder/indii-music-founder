import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import sharp from "sharp";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

/**
 * Cloud Function: Resize Images
 * 
 * Automatically resizes images uploaded to Cloud Storage.
 * Triggers on: google.cloud.storage.object.v1.finalized
 * Runtime: Node.js 22 (2nd Gen)
 */
export const generateThumbnail = onObjectFinalized(
    {
        cpu: 2,
        memory: "1GiB",
        region: "us-west1",
        bucket: "indiios-alpha-electron",
        timeoutSeconds: 300,
    },
    async (event) => {
        const fileBucket = event.data.bucket;
        const filePath = event.data.name; // File path in the bucket
        const contentType = event.data.contentType; // File content type

        // 1. Validation
        if (!filePath || !contentType) {
            console.log("File has no path or content-type.");
            return;
        }

        // Exit if this is triggered on a file that is not an image.
        if (!contentType.startsWith("image/")) {
            console.log("This is not an image.");
            return;
        }

        // Exit if the image is already a thumbnail.
        const fileName = path.basename(filePath);
        if (fileName.startsWith("thumb_")) {
            console.log("Already a thumbnail.");
            return;
        }

        // 2. Setup Paths
        const bucket = admin.storage().bucket(fileBucket);
        const tempFilePath = path.join(os.tmpdir(), fileName);
        const metadata = {
            contentType: contentType,
            metadata: {
                resized: "true" // Flag to easily identify
            }
        };

        // We'll create a thumbnail with the same name but prefixed
        // e.g. users/123/profile.jpg -> users/123/thumb_profile.jpg
        const thumbFileName = `thumb_${fileName}`;
        const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
        const tempThumbPath = path.join(os.tmpdir(), thumbFileName);

        try {
            // 3. Download file
            await bucket.file(filePath).download({ destination: tempFilePath });
            console.log("Image downloaded locally to", tempFilePath);

            // 4. Resize using Sharp
            // Generate a 200x200 thumbnail, maintaining aspect ratio, cover
            await sharp(tempFilePath)
                .resize(200, 200, {
                    fit: 'inside', // 'inside' ensures it fits within 200x200 without cropping
                    withoutEnlargement: true
                })
                .toFile(tempThumbPath);

            console.log("Thumbnail created at", tempThumbPath);

            // 5. Upload Thumbnail
            await bucket.upload(tempThumbPath, {
                destination: thumbFilePath,
                metadata: metadata,
            });
            console.log("Thumbnail uploaded to Storage at", thumbFilePath);

            // 6. Cleanup
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(tempThumbPath);

        } catch (error) {
            console.error("Error resizing image:", error);
            // Cleanup on error
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
        }
    }
);
