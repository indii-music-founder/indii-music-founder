import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dawIntegrationService } from './DAWIntegrationService';
import { ExtendedGoldenMetadata } from '../metadata/types';

// Mock JSZip
vi.mock('jszip', () => {
    return {
        default: class MockJSZip {
            file = vi.fn().mockReturnThis();
            generateAsync = vi.fn().mockResolvedValue(new Blob(['mock-zip-content']));
            loadAsync = vi.fn().mockResolvedValue({
                files: {
                    'ProjectData': {
                        async: vi.fn().mockResolvedValue(new TextEncoder().encode(
                            `<?xml version="1.0" encoding="UTF-8"?>
                            <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
                            <plist version="1.0">
                            <dict>
                                <key>tempo</key>
                                <real>128.5</real>
                                <key>keySignature</key>
                                <string>A Minor</string>
                            </dict>
                            </plist>`
                        ).buffer)
                    }
                }
            });
        }
    };
});

class MockDecompressionStream {
    readable: ReadableStream;
    writable: WritableStream;
    constructor() {
        this.writable = new WritableStream();
        this.readable = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(
                    `<?xml version="1.0" encoding="UTF-8"?>
                    <Ableton MajorVersion="5" MinorVersion="11.0_432" SchemaChangeCount="3" Creator="Ableton Live 11.0">
                      <LiveSet>
                        <MasterTrack>
                          <Tempo>
                            <Manual Value="126.0" />
                          </Tempo>
                        </MasterTrack>
                        <Locators>
                          <Locator>
                            <Name Value="Intro" />
                            <Time Value="0" />
                          </Locator>
                          <Locator>
                            <Name Value="Verse" />
                            <Time Value="32" />
                          </Locator>
                        </Locators>
                      </LiveSet>
                    </Ableton>`
                ));
                controller.close();
            }
        });
    }
}

vi.stubGlobal('DecompressionStream', MockDecompressionStream);

describe('DAWIntegrationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('exportToAbleton', () => {
        it('should generate an Ableton Live ZIP package successfully', async () => {
            const blob = await dawIntegrationService.exportToAbleton({
                bpm: 124,
                key: 'F# Minor',
                artistName: 'Test Artist',
                trackTitle: 'Alpha Track'
            });

            expect(blob).toBeInstanceOf(Blob);
        });
    });

    describe('parseFile - Ableton Live (.als)', () => {
        it('should decompress and extract BPM, Key, and Markers from .als project XML', async () => {
            const file = new File(['mock-gzipped-xml'], 'project.als', { type: 'application/octet-stream' });
            const result = await dawIntegrationService.parseFile(file, 'project.als');

            expect(result.format).toBe('als');
            expect(result.bpm).toBe(126.0);
            expect(result.markers).toHaveLength(2);
            expect(result.markers?.[0].name).toBe('Intro');
            expect(result.markers?.[1].name).toBe('Verse');
            expect(result.markers?.[1].timeBeats).toBe(32);
        });
    });

    describe('parseFile - Logic Pro (.logicx)', () => {
        it('should extract BPM and Key from XML plist project file inside package', async () => {
            const file = new File(['mock-zip-package'], 'my_song.logicx', { type: 'application/octet-stream' });
            const result = await dawIntegrationService.parseFile(file, 'my_song.logicx');

            expect(result.format).toBe('logicx');
            expect(result.bpm).toBe(128.5);
            expect(result.key).toBe('A Minor');
        });
    });

    describe('parseFile - FL Studio (.flp)', () => {
        it('should parse binary chunks and read standard BPM events', async () => {
            // Construct a basic fake FL Studio binary buffer containing 'FLhd' signature
            const buffer = new ArrayBuffer(50);
            const view = new DataView(buffer);
            // Write 'FLhd'
            view.setUint8(0, 0x46); // F
            view.setUint8(1, 0x4C); // L
            view.setUint8(2, 0x68); // h
            view.setUint8(3, 0x64); // d

            const file = new File([buffer], 'session.flp', { type: 'application/octet-stream' });
            const result = await dawIntegrationService.parseFile(file, 'session.flp');

            expect(result.format).toBe('flp');
            expect(result.bpm).toBe(120.0); // Fallback standard BPM
        });
    });

    describe('parseFile - Lossless WAV (.wav)', () => {
        it('should parse WAV container to extract sample rate and bit depth', async () => {
            // RIFF WAVE header + fmt chunk
            const buffer = new ArrayBuffer(44);
            const view = new DataView(buffer);
            // Write 'RIFF'
            view.setUint8(0, 0x52); // R
            view.setUint8(1, 0x49); // I
            view.setUint8(2, 0x46); // F
            view.setUint8(3, 0x46); // F
            
            // Write 'WAVE'
            view.setUint8(8, 0x57); // W
            view.setUint8(9, 0x41); // A
            view.setUint8(10, 0x56); // V
            view.setUint8(11, 0x45); // E

            // Write 'fmt ' chunk
            view.setUint8(12, 0x66); // f
            view.setUint8(13, 0x6D); // m
            view.setUint8(14, 0x74); // t
            view.setUint8(15, 0x20); // ' '
            view.setUint32(16, 16, true); // chunk size
            view.setUint32(24, 48000, true); // Sample rate = 48kHz
            view.setUint16(34, 24, true); // 24-bit

            const file = new File([buffer], 'master.wav', { type: 'audio/wav' });
            const result = await dawIntegrationService.parseFile(file, 'master.wav');

            expect(result.format).toBe('wav');
            expect(result.sampleRate).toBe(48000);
            expect(result.bitDepth).toBe(24);
        });
    });

    describe('populateDistributionFields', () => {
        it('should merge parsed values into industry-standard Golden Metadata fields', () => {
            const parsed = {
                bpm: 130,
                key: 'D# Major',
                durationSeconds: 195,
                format: 'wav' as const
            };

            const current: Partial<ExtendedGoldenMetadata> = {
                artistName: 'Golden Producer',
                trackTitle: 'Original Track'
            };

            const result = dawIntegrationService.populateDistributionFields(parsed, current);

            expect(result.bpm).toBe(130);
            expect(result.key).toBe('D# Major');
            expect(result.durationFormatted).toBe('3:15');
            expect(result.durationDDEXFormatted).toBe('PT3M15S');
            expect(result.isGolden).toBe(true);
        });
    });

    describe('verifyDSPCompliance', () => {
        it('should validate sample rate and bit depth against DSP standards', () => {
            const parsed = {
                sampleRate: 48000,
                bitDepth: 24,
                format: 'wav' as const
            };

            const report = dawIntegrationService.verifyDSPCompliance(parsed);

            expect(report.isCompliant).toBe(true);
            expect(report.flags).toHaveLength(0);
        });

        it('should raise rejection risks and warning flags for sub-standard sample rates', () => {
            const parsed = {
                sampleRate: 22050,
                bitDepth: 8,
                format: 'mp3' as const
            };

            const report = dawIntegrationService.verifyDSPCompliance(parsed);

            expect(report.isCompliant).toBe(false);
            expect(report.flags).toContain('REJECTION RISK: Format below required 44.1kHz threshold.');
        });
    });
});
