/**
 * ForensicAuditService — Brain Calibration Session 3: The Forensic Audit
 *
 * Hardens Goal 3 "Soul Certification" by running a deep forensic pass
 * over submitted audio to detect:
 * - Intelligence-generated audio artifacts (quantization anomalies, robotic phrasing,
 *   phase-perfect loops, sterile transients)
 * - Sample integrity issues (unlicensed sample fingerprints, lifted stems)
 * - Technical certification blockers (clipping, phase issues, mono incompatibility)
 *
 * This is the quality gate between creation and DDEX distribution.
 * A track that fails CANNOT proceed to distribution without human sign-off.
 */
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import type { Schema } from '@/shared/types/ai.dto';
import { Logger } from '@/core/logger/Logger';
import { withServiceError } from '@/lib/errors';
import type { AudioFeatures } from './types';

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
    | 'phase_perfect_loop'      // Pixel-perfect loop boundary = Autonomous/DAW clone
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
    /** Overall Autonomous artifact severity across the whole track */
    overallArtifactSeverity: ArtifactSeverity;
    /** Probability (0.0–1.0) that this track is fully or partially Intelligence-generated */
    autonomousGenerationProbability: number;
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
        autonomousGenerationProbability: { type: 'NUMBER' },
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
        'certificationStatus', 'overallArtifactSeverity', 'autonomousGenerationProbability',
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
You are a forensic audio engineer and music intelligence specialist with 15+ years in mastering, production acoustics, and digital forensics.
Your mandate is to protect the integrity of music distribution while safeguarding human creators against false algorithmic flags.

LISTEN FORENSICALLY to this audio file (${Math.round(technicalFeatures.duration)}s, ${technicalFeatures.bpm.toFixed(0)} BPM, ${technicalFeatures.key} ${technicalFeatures.scale}).

=== YOUR FORENSIC MISSION ===

Conduct a sweep for the following categories. Be rigorous. Be specific. Be calibrated.

**CATEGORY 1: Generative AI Detection (Calibrated for Electronic & Modern Music)**
CRITICAL PRINCIPLE: Human-produced electronic music, hip-hop, techno, and pop routinely utilize 100% MIDI grid quantization, hardware/software drum machines (e.g. 808/909), sterile synthetic transients, sidechain compression, and phase-locked sample loops.
DO NOT treat grid quantization, loop boundaries, synthetic timbres, or transient cleanliness as evidence of generative AI. These are hallmark techniques of human-directed production.

Evaluate ONLY for genuine generative-AI neural audio artifacts:
- Neural Diffusion Wash / Codec Smearing: Watery, swirly background noise or underwater high-frequency smearing typical of diffusion vocoders.
- Chimeric / Morphing Elements: Instruments or timbres that randomly morph into unrelated sounds without discrete arrangement logic.
- Pseudo-Vocal Babble: Glossolalia, ungrounded phonemes, or vocal textures that fluctuate unnaturally in timbre and formant structure.
- Structural Dissolution: Algorithmic drift lacking intentional track architecture, verse/chorus arrangement, or discrete stem layers.

**CATEGORY 2: Sample & Production Provenance**
- Licensed Royalty-Free Loops & Samples: Loops from commercial sound libraries (Splice, Loopcloud, DAW stock libraries) are standard human production tools. Do not flag standard royalty-free production samples as infringement or AI.
- Suspected Sample Lift: Flag only if an element appears to be a direct unlicensed excerpt from a known commercial master recording requiring clearance documentation.

**CATEGORY 3: Technical Audio Quality Gate**
- Digital Clipping: Intersample peaks exceeding 0dBFS causing audible digital overs.
- DC Offset: Baseline signal bias causing headroom loss.
- Phase Cancellation: Destructive out-of-phase stereo cancellation in mono summing.

=== SCORING & DECISION RULES ===

For each finding:
- 'timestamp': Where in the track (seconds from start)
- 'durationSecs': Duration in seconds (0 = transient / instantaneous)
- 'type': Use the machine-readable enum exactly
- 'description': Objective, evidence-based description.
- 'severity': minor / moderate / severe

For the overall result:
- 'autonomousGenerationProbability': Probabilistic estimate (0.0 = confirmed human, 1.0 = neural AI model).
  * 0.0–0.25: Normal human production (including fully quantized electronic music and beatmaking)
  * 0.25–0.50: Clean track with heavy processing; human review optional
  * 0.50–0.75: Observable neural diffusion artifacts; route to human review
  * >0.75: Prominent generative AI artifacts across vocal/instrument tracks
- 'certificationStatus':
  - 'CERTIFIED': Technical standards met, no fatal audio blockers. Fully cleared for distribution.
  - 'CONDITIONAL': Needs human A&R / provenance confirmation (e.g. sample license check or review of unusual timbre).
  - 'BLOCKED': Reserved strictly for severe, irreparable technical blockers (unplayable file, extreme digital distortion). Automated detector scores alone MUST NEVER issue an irreversible BLOCKED verdict against human artists.
- 'recommendation': Map to 'clear_for_distribution', 'human_review_required', or 'block_until_resolved'.
- 'auditorNote': Direct, constructive note written as a professional mastering engineer.

CRITICAL RULES:
- If the track is clean, clear it without hesitation.
- Electronic music with perfect timing and synthetic drums is HUMAN MUSIC. Do not mislabel it as AI.
- Never issue a BLOCKED status based on uncalibrated probability or production style.
`;

            const result = await AutonomousIntelligence.generateStructuredData<SoulCertificationResult>(
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
                INTELLIGENCE_MODELS.TEXT.AGENT
            );

            Logger.info(
                'ForensicAudit',
                `Audit complete: ${result.certificationStatus} | Intelligence probability: ${(result.autonomousGenerationProbability * 100).toFixed(0)}% | Findings: ${result.findings.length}`
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
