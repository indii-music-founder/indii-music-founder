import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { CloudStorageService } from '@/services/CloudStorageService';
import { toast } from '@/core/context/ToastContext';
import { auth } from '@/services/firebase';

export interface VoiceSample {
    id: string;
    name: string;
    sampleUrl: string;
    status: 'pending' | 'ready' | 'error';
    createdAt: number;
}

export class VoiceCloningService {
    /**
     * Upload a voice sample for cloning.
     * In a real scenario, this would send the file to ElevenLabs or similar.
     */
    async uploadSample(file: File, name: string): Promise<VoiceSample | null> {
        try {
            toast.info(`Uploading voice sample: ${name}...`);

            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('User must be authenticated to upload voice samples.');

            // 1. Upload to Firebase Storage
            const id = `voice_${Date.now()}`;
            const url = await CloudStorageService.uploadAudio(file, id, userId, file.type);

            if (!url) throw new Error('Failed to upload voice sample to storage');

            // 2. Return a voice sample object
            const sample: VoiceSample = {
                id,
                name,
                sampleUrl: url,
                status: 'ready',
                createdAt: Date.now()
            };

            toast.success(`Voice sample "${name}" is ready for cloning!`);
            return sample;
        } catch (error) {
            console.error('[VoiceCloningService] Upload failed:', error);
            toast.error('Failed to upload voice sample.');
            return null;
        }
    }

    /**
     * Generate TTS using a cloned voice.
     */
    async generateWithVoice(text: string, voiceId: string): Promise<string | null> {
        try {
            // This would call ElevenLabs API with the voiceId
            // For now, we'll route it back to Gemini and append a "style" instruction.
            const prompt = `Generate speech for the following text. 
            CLONED VOICE STYLE: ${voiceId}
            TEXT: ${text}`;

            const result = await firebaseAI.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error('[VoiceCloningService] Voice generation failed:', error);
            return null;
        }
    }
}

export const voiceCloningService = new VoiceCloningService();
