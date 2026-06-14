import { logger } from '@/utils/logger';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface MidiNote {
    pitch: number;    // MIDI note number (0-127)
    velocity: number; // 0-127
    startTime: number; // in seconds
    duration: number;  // in seconds
}

export class ClientPitchTracker {
    /**
     * Converts voice hum or audio buffers to basic MIDI note tracks.
     * Uses autocorrelation frequency tracking algorithms.
     */
    static convertAudioToMidi(audioBuffer: Float32Array, sampleRate: number): MidiNote[] {
        logger.info(`[ClientPitchTracker] Extracting pitch frequencies from audio stream...`);
        const notes: MidiNote[] = [];
        
        // Lightweight pitch tracking algorithm (Autocorrelation)
        const bufferSize = audioBuffer.length;
        const noteDuration = 0.5; // standard sample chunk size
        const stepSize = Math.floor(sampleRate * noteDuration);

        for (let i = 0; i < bufferSize; i += stepSize) {
            const chunk = audioBuffer.subarray(i, Math.min(i + stepSize, bufferSize));
            if (chunk.length < 512) break;

            const freq = this.detectPitch(chunk, sampleRate);
            if (freq > 50 && freq < 1000) { // filter human hum voice range
                const midiNum = Math.round(69 + 12 * Math.log2(freq / 440));
                notes.push({
                    pitch: midiNum,
                    velocity: 80,
                    startTime: i / sampleRate,
                    duration: noteDuration
                });
            }
        }

        return notes;
    }

    /**
     * Auto-correlate frequency detection.
     */
    private static detectPitch(buffer: Float32Array, sampleRate: number): number {
        const size = buffer.length;
        let bestOffset = -1;
        let bestCorrelation = 0;

        for (let offset = 20; offset < 1000; offset++) {
            let correlation = 0;
            for (let i = 0; i < size - offset; i++) {
                correlation += buffer[i]! * buffer[i + offset]!;
            }
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        }

        if (bestOffset !== -1) {
            return sampleRate / bestOffset;
        }
        return 0;
    }

    /**
     * Save the generated MIDI note sequence to Firestore.
     */
    static async saveMidiComposition(userId: string, projectId: string, notes: MidiNote[]): Promise<string> {
        const docRef = await addDoc(collection(db, 'composition_drafts'), {
            userId,
            projectId,
            notes,
            createdAt: serverTimestamp()
        });
        logger.info(`[ClientPitchTracker] Saved MIDI composition: ${docRef.id}`);
        return docRef.id;
    }
}
