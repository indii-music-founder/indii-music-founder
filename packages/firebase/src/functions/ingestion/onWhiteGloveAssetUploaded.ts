import * as admin from 'firebase-admin';
import { defineStorageTrigger } from '../../factory';

export const onWhiteGloveAssetUploaded = defineStorageTrigger(
    undefined,
    { memory: '1GiB', timeoutSeconds: 300 },
    async (event) => {
        const filePath = event.data.name;
        
        // Ensure this is a white-glove ingestion file
        if (!filePath.startsWith('ingest/white-glove/')) {
            return;
        }

        // Path format: ingest/white-glove/{artistId}/{assetType}/{fileName}
        const segments = filePath.split('/');
        if (segments.length < 5) {
            console.warn(`Invalid white-glove path structure: ${filePath}`);
            return;
        }

        const artistId = segments[2];
        const assetType = segments[3];
        const fileName = segments.slice(4).join('/'); // In case filename has slashes (rare)

        const db = admin.firestore();
        
        const docRef = db.collection('artists')
            .doc(artistId)
            .collection('assets')
            .doc(fileName.replace(/[^a-zA-Z0-9_-]/g, '_'));

        // Initial state update
        await docRef.set({
                fileName,
                assetType,
                size: event.data.size,
                contentType: event.data.contentType,
                bucket: event.data.bucket,
                fullPath: filePath,
                status: 'processing',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

        if (assetType === 'music' || assetType === 'audio') {
            try {
                const { getVertexAIClient } = await import('../../lib/vertexClient');
                const genai = getVertexAIClient();
                const SONIC_PROFILE_PROMPT = `Analyze this audio track and extract its sonic profile. 
Return ONLY a JSON object that adheres to the following schema:
{
  "bpm": number,
  "key": string,
  "mood": string,
  "texture": string,
  "instrumentation": string[],
  "vocalPresence": boolean,
  "intensity": number,
  "genre": string,
  "timestamp_markers": [{"time": string, "event": string}]
}`;
                const result = await genai.models.generateContent({
                    model: 'gemini-3-pro-preview',
                    contents: [{
                        role: "user",
                        parts: [
                            { text: SONIC_PROFILE_PROMPT },
                            {
                                fileData: {
                                    mimeType: event.data.contentType || 'audio/mpeg',
                                    fileUri: `gs://${event.data.bucket}/${filePath}`
                                }
                            }
                        ]
                    }],
                    temperature: 0.1,
                    responseMimeType: "application/json"
                } as unknown as Parameters<typeof genai.models.generateContent>[0]);

                const part = result?.candidates?.[0]?.content?.parts?.[0];
                const analysisText = part && 'text' in part ? (part as { text?: string }).text : null;
                
                if (analysisText) {
                    const metadata = JSON.parse(analysisText);
                    await docRef.set({
                        status: 'processed',
                        metadata,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } else {
                    throw new Error("Model returned no analysis data.");
                }
            } catch (error) {
                console.error('Failed to extract audio metadata', error);
                await docRef.set({
                    status: 'error',
                    error: String(error),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        } else if (assetType === 'archive') {
            try {
                const unzipper = await import('unzipper');
                const fileStream = admin.storage().bucket(event.data.bucket).file(filePath).createReadStream();
                const files: string[] = [];

                await new Promise((resolve, reject) => {
                    fileStream
                        .pipe(unzipper.Parse())
                        .on('entry', (entry: { type: string; path: string; autodrain: () => void }) => {
                            if (entry.type === 'File') {
                                files.push(entry.path);
                            }
                            entry.autodrain();
                        })
                        .on('close', resolve)
                        .on('error', reject);
                });

                await docRef.set({
                    status: 'processed',
                    metadata: {
                        files
                    },
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (error) {
                console.error('Failed to extract archive metadata', error);
                await docRef.set({
                    status: 'error',
                    error: String(error),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }
    }
);
