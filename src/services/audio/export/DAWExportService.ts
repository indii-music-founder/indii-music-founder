import { logger } from '@/utils/logger';

/**
 * Requirement 109: External DAW Integration
 * Export `.als` (Ableton Live Set) or MIDI generic project files from AI generated concepts.
 */

export interface ExportTrack {
    name: string;
    type: 'audio' | 'midi';
    fileUrl?: string; // For audio tracks
    notes?: Array<{ pitch: number; start: number; duration: number; velocity: number }>; // For midi
}

export interface DAWProjectConfig {
    projectName: string;
    tempo: number;
    tracks: ExportTrack[];
}

export class DAWExportService {

    /**
     * Generates a generic standard MIDI file (.mid) from track notes.
     * Uses a raw binary format approach to avoid heavy dependencies for simple exports.
     */
    async exportMIDI(config: DAWProjectConfig): Promise<Blob> {
        try {
            logger.info(`[DAWExportService] Generating MIDI export for project: ${config.projectName}`);

            // Minimal binary MIDI file implementation (Format 1, Multi-track)
            // Header: MThd | length (6) | format (1) | num_tracks | ticks_per_q
            const headerChunk = this.createMidiHeader(1, config.tracks.filter(t => t.type === 'midi').length + 1, 128);

            // Track 0: Tempo and Meta events
            const tempoChunk = this.createTempoTrack(config.tempo, config.projectName);

            // Other tracks: Note data
            const noteChunks = config.tracks
                .filter(t => t.type === 'midi' && t.notes)
                .map((track, i) => this.createNoteTrack(track, i));

            // Combine all binary chunks
            const midiData = new Uint8Array([
                ...headerChunk,
                ...tempoChunk,
                ...noteChunks.reduce((acc, val) => new Uint8Array([...acc, ...val]), new Uint8Array())
            ]);

            return new Blob([midiData], { type: 'audio/midi' });
        } catch (error: any) {
            logger.error('[DAWExportService] MIDI export failed', error);
            throw new Error(`MIDI export failed: ${error.message}`);
        }
    }

    /**
     * Generates an Ableton Live Set (.als) XML file.
     * Note: A true .als file is a gzipped XML file. We generate the raw XML string here.
     */
    async exportAbletonProject(config: DAWProjectConfig): Promise<string> {
        try {
            logger.info(`[DAWExportService] Generating Ableton (.als) export for project: ${config.projectName}`);

            // A very minimal, generic XML structure of an Ableton project.
            // Ableton will typically attempt to repair and open simple valid XML schemas.
            let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="11.0_11300" SchemaChangeCount="3" Creator="indiiOS AI">
    <LiveSet>
        <MasterTrack>
            <DeviceChain>
                <Mixer>
                    <Tempo>
                        <Manual Value="${config.tempo}" />
                    </Tempo>
                </Mixer>
            </DeviceChain>
        </MasterTrack>
        <Tracks>
`;

            config.tracks.forEach((track, index) => {
                if (track.type === 'audio') {
                    xml += `            <AudioTrack Id="${index}">
                <Name Value="${track.name}" />
                <DeviceChain>
                    <MainSequencer>
                        <Sample>
                            <FileRef>
                                <Path Value="${track.fileUrl || ''}" />
                            </FileRef>
                        </Sample>
                    </MainSequencer>
                </DeviceChain>
            </AudioTrack>\n`;
                } else if (track.type === 'midi') {
                    xml += `            <MidiTrack Id="${index}">
                <Name Value="${track.name}" />
                <!-- MIDI Note Data would map into Clip Slots in a full implementation -->
            </MidiTrack>\n`;
                }
            });

            xml += `        </Tracks>
    </LiveSet>
</Ableton>`;

            return xml;
        } catch (error: any) {
            logger.error('[DAWExportService] Ableton export failed', error);
            throw new Error(`Ableton export failed: ${error.message}`);
        }
    }

    // --- MIDI Binary Helpers ---
    private createMidiHeader(format: number, numTracks: number, ticksPerBeat: number): Uint8Array {
        return new Uint8Array([
            0x4D, 0x54, 0x68, 0x64, // "MThd"
            0x00, 0x00, 0x00, 0x06, // Chunk length (always 6)
            0x00, format,           // Format (0, 1, or 2)
            (numTracks >> 8) & 0xFF, numTracks & 0xFF, // Number of tracks
            (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF // Ticks per quarter note
        ]);
    }

    private createTempoTrack(tempoBpm: number, name: string): Uint8Array {
        // Microseconds per quarter note
        const mpqn = Math.floor(60000000 / tempoBpm);
        const nameBytes = new TextEncoder().encode(name);

        const trackData = [
            // Track Name Meta Event
            0x00, 0xFF, 0x03, nameBytes.length, ...nameBytes,
            // Tempo Meta Event
            0x00, 0xFF, 0x51, 0x03,
            (mpqn >> 16) & 0xFF, (mpqn >> 8) & 0xFF, mpqn & 0xFF,
            // End of Track
            0x00, 0xFF, 0x2F, 0x00
        ];

        return this.wrapTrackChunk(trackData);
    }

    private createNoteTrack(track: ExportTrack, channel: number = 0): Uint8Array {
        const events: number[] = [];
        const nameBytes = new TextEncoder().encode(track.name);

        // Track Name
        events.push(0x00, 0xFF, 0x03, nameBytes.length, ...nameBytes);

        if (track.notes) {
            let lastTime = 0;
            // Simplified note sequence (assumes notes are pre-sorted by start time)
            for (const note of track.notes) {
                // Note On
                events.push(...this.toVarInt(note.start - lastTime));
                events.push(0x90 | channel, note.pitch, note.velocity);

                // Note Off
                events.push(...this.toVarInt(note.duration));
                events.push(0x80 | channel, note.pitch, 0);

                lastTime = note.start + note.duration;
            }
        }

        // End of Track
        events.push(0x00, 0xFF, 0x2F, 0x00);

        return this.wrapTrackChunk(events);
    }

    private wrapTrackChunk(data: number[]): Uint8Array {
        const length = data.length;
        return new Uint8Array([
            0x4D, 0x54, 0x72, 0x6B, // "MTrk"
            (length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF,
            ...data
        ]);
    }

    private toVarInt(val: number): number[] {
        let buffer = val & 0x7F;
        const result = [buffer];
        while ((val >>= 7)) {
            buffer = val & 0x7F | 0x80;
            result.unshift(buffer);
        }
        return result;
    }
}

export const dawExportService = new DAWExportService();
