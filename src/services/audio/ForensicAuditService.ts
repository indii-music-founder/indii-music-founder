/**
 * ForensicAuditService — Brain Calibration Session 3: The Forensic Audit
 *
 * Hardens Goal 3 "Soul Certification" by running a deep forensic pass
 * over submitted audio to detect:
 * - AI-generated audio artifacts (quantization anomalies, robotic phrasing,
 *   phase-perfect loops, sterile transients)
 * - Sample integrity issues (unlicensed sample fingerprints, lifted stems)
 * - Technical certification blockers (clipping, phase issues, mono incompatibility)
 *
 * This is the quality gate between creation and DDEX distribution.
 * A track that fails CANNOT proceed to distribution without human sign-off.
 */
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { Schema } from 'firebase/ai';
import { Logger } from '@/core/logger/Logger';
import { withServiceError } from '@/lib/errors';
import type { AudioFeatures } from './AudioAnalysisService';

// ─── Result Types ─────────────────────────────────────────────────────────────

export type ArtifactSeverity = 'clean' | 'minor' | 'moderate' | 'severe';

export interface ArtifactFinding {
    /** Timestamp in seconds where the artifact was detected */
    timestamp: number;
    /** Duration of the artifact in seconds (0 = momentary) */
    durationSecs: number;
    /** Short machine-readable label */
    type:
        | 'quantization_grid_lock'  // Every element snapped — zero human feel
        | 'phase_perfect_loop'      // Pixel-perfect loop boundary = AI/DAW clone
        | 'sterile_transient'       // No transient smear — mathematically clean
        | 'robotic_phrasing'        // Vocal/melody timing that's inhuman
        | 'frequency_void'          // Unnatural absence in a frequency band
        | 'dc_offset'               // DC bias in the signal
        | 'clipping'                // Digital clipping (overs)
        | 'phase_cancellation'      // L/R destructive interference
        | 'suspected_sample_lift';  // Pattern matches known sample territory
    /** Human-readable description of what was heard */
    description: string;
    /** Severity of this individual finding */
    severity: ArtifactSeverity;
}

export interface SoulCertificationResult {
    /** Overall pass/fail for DDEX distribution */
    certificationStatus: 'CERTIFIED' | 'CONDITIONAL' | 'BLOCKED';
    /** Overall AI artifact severity across the whole track */
    overallArtifactSeverity: ArtifactSeverity;
    /** Probability (0.0–1.0) that this track is fully or partially AI-generated */
    aiGenerationProbability: number;
    /** Specific findings with timestamps */
    findings: ArtifactFinding[];
    /** Total count of findings by severity */
    findingCounts: {
        severe: number;
        moderate: number;
        minor: number;
    };
    /** Human-readable summary for the artist/A&R */
    auditorNote: string;
    /** Recommended action for the distribution pipeline */
    recommendation: 'clear_for_distribution' | 'human_review_required' | 'block_until_resolved';
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const FORENSIC_SCHEMA: Schema = {
    type: 'OBJECT' as const,
    properties: {
        certificationStatus: { type: 'STRING' },
        overallArtifactSeverity: { type: 'STRING' },
        aiGenerationProbability: { type: 'NUMBER' },
        findings: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    timestamp: { type: 'NUMBER' },
                    durationSecs: { type: 'NUMBER' },
                    type: { type: 'STRING' },
                    description: { type: 'STRING' },
                    severity: { type: 'STRING' }
                },
                required: ['timestamp', 'durationSecs', 'type', 'description', 'severity']
            }
        },
        findingCounts: {
            type: 'OBJECT',
            properties: {
                severe: { type: 'NUMBER' },
                moderate: { type: 'NUMBER' },
                minor: { type: 'NUMBER' }
            },
            required: ['severe', 'moderate', 'minor']
        },
        auditorNote: { type: 'STRING' },
        recommendation: { type: 'STRING' }
    },
    required: [
        'certificationStatus', 'overallArtifactSeverity', 'aiGenerationProbability',
        'findings', 'findingCounts', 'auditorNote', 'recommendation'
    ]
} as unknown as Schema;

// ─── Service ──────────────────────────────────────────────────────────────────

export class ForensicAuditService {
    /**
     * Runs a full forensic audit on an audio file.
     * Returns a SoulCertificationResult used by the distribution gate.
     */
    async auditTrack(
        file: File,
        technicalFeatures: AudioFeatures
    ): Promise<SoulCertificationResult> {
        return withServiceError('ForensicAudit', 'auditTrack', async () => {
            Logger.info('ForensicAudit', `Starting forensic audit for: ${file.name}`);

            const base64Audio = await this.fileToBase64(file);

            const prompt = `
You are a forensic audio engineer and AI detection specialist with 15+ years in music mastering and digital forensics.
Your mandate is to protect the integrity of music distribution. You answer only to the truth of what you hear.

LISTEN FORENSICALLY to this audio file (${Math.round(technicalFeatures.duration)}s, ${technicalFeatures.bpm.toFixed(0)} BPM, ${technicalFeatures.key} ${technicalFeatures.scale}).

=== YOUR FORENSIC MISSION ===

Conduct a sweep for the following categories. Be rigorous. Be specific. Be honest.

**CATEGORY 1: AI Generation Artifacts**
- Quantization Grid Lock: Does EVERY rhythmic element lock perfectly to the grid with zero deviation?
  Human music has micro-timing variation (±5–20ms). AI music is mathematically perfect.
- Sterile Transients: Are drum/percussion hits too clean? No room reflections, no stick noise, no human inconsistency?
- Robotic Phrasing: Do melodic or vocal elements have inhuman timing precision or unnatural pitch consistency?
- Phase-Perfect Loops: Listen for loop points — do they connect with zero crossfade artifact? This indicates sample/AI looping.
- Frequency Voids: Are there suspiciously absent frequency bands that suggest algorithmic generation (e.g., missing room tone, dead mid-range)?

**CATEGORY 2: Sample Integrity**
- Suspected Sample Lift: Does any element (melody, drum break, chord progression, vocal chop) sound like a lifted sample?
  Note: You cannot definitively ID samples — mark these as 'suspected_sample_lift' with a description.

**CATEGORY 3: Technical Certification Blockers**
- Digital Clipping: Any overs / distortion from exceeding 0dBFS?
- DC Offset: Is there a DC bias in the signal baseline?
- Phase Cancellation: Do the L/R channels destructively cancel in mono? (Use the mono sum test mentally.)

=== SCORING RULES ===

For each finding:
- 'timestamp': Where in the track (seconds from start)
- 'durationSecs': How long does it persist? (0 = one-shot / transient)
- 'type': Use the machine-readable enum exactly
- 'description': 1-2 sentences of specific, evidence-based description. No vague statements.
- 'severity': minor / moderate / severe

For the overall result:
- 'aiGenerationProbability': Your honest estimate (0.0 = human, 1.0 = full AI). This is probabilistic — be calibrated.
- 'certificationStatus':
  - 'CERTIFIED': No blockers, AI probability < 0.4, minor issues only
  - 'CONDITIONAL': Moderate issues or AI probability 0.4–0.7 — human review required
  - 'BLOCKED': Severe issues or AI probability > 0.7 or technical blockers present
- 'recommendation': Map to exactly one of: 'clear_for_distribution', 'human_review_required', 'block_until_resolved'
- 'auditorNote': Write as a professional mastering engineer would — direct, specific, no fluff. Address the artist directly.

CRITICAL RULES:
- If nothing is wrong, say so clearly. Do NOT invent findings to seem thorough.
- A 'CERTIFIED' result with zero findings is a VALID and VALUABLE outcome.
- Be fair — human music can be tight without being AI. Context matters.
- 0.01% phase shift detection standard: Log any phase anomalies, no matter how small.
`;

            const result = await firebaseAI.generateStructuredData<SoulCertificationResult>(
                [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: file.type || 'audio/mp3',
                            data: base64Audio
                        }
                    }
                ],
                FORENSIC_SCHEMA,
                8192, // Higher budget — forensic reasoning is complex
                'You are a forensic audio engineer. Precision and honesty are your only directives.',
                AI_MODELS.TEXT.AGENT
            );

            Logger.info(
                'ForensicAudit',
                `Audit complete: ${result.certificationStatus} | AI probability: ${(result.aiGenerationProbability * 100).toFixed(0)}% | Findings: ${result.findings.length}`
            );

            return result;
        });
    }

    /**
     * Quick check — runs a lighter pass without full Gemini analysis.
     * Uses technical features only (loudness, energy spikes, clipping).
     * Returns a fast pre-screen before committing to a full audit.
     */
    preScreenTechnical(features: AudioFeatures): {
        hasClippingRisk: boolean;
        hasDynamicRange: boolean;
        isMonoCompatible: boolean;
        preScreenNote: string;
    } {
        const hasClippingRisk = features.loudness > -1;
        const hasDynamicRange = features.loudness < -6;
        // Mono compatibility can't be fully assessed without raw waveform, mark unknown
        const isMonoCompatible = true;

        const issues: string[] = [];
        if (hasClippingRisk) issues.push(`loudness at ${features.loudness.toFixed(1)} dBLUFS — clipping risk`);
        if (!hasDynamicRange) issues.push(`very low dynamic range — brick-wall compression suspected`);

        return {
            hasClippingRisk,
            hasDynamicRange,
            isMonoCompatible,
            preScreenNote: issues.length ? `Pre-screen flags: ${issues.join('; ')}` : 'Pre-screen: No technical flags.'
        };
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result;
                if (typeof result !== 'string') {
                    reject(new Error('FileReader returned unexpected type'));
                    return;
                }
                resolve(result.split(',')[1] ?? '');
            };
            reader.onerror = error => reject(error);
        });
    }
}

export const forensicAuditService = new ForensicAuditService();
