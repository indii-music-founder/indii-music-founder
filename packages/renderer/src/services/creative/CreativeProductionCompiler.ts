import type { HarnessCompiler, HarnessContext } from '../business-harness/HarnessCompiler';
import { createHarnessRun, type HarnessRun, type HarnessFinding, type HarnessRecommendation, type HarnessAgentBrief, type HarnessApprovalGate } from '../business-harness/types';

export interface CreativeProductionTrack {
  id: string;
  title: string;
  hasDemo: boolean;
  hasMix: boolean;
  hasMaster: boolean;
  hasStems: boolean;
  credits: Array<{ role: string; name: string }>;
}

export interface CreativeProductionArtwork {
  hasArtwork: boolean;
  hasLegalIssue: boolean;
  hasBrandIssue: boolean;
}

export interface CreativeProductionVideo {
  id: string;
  title: string;
  type: 'music_video' | 'lyric_video' | 'visualizer' | 'short';
}

export interface CreativeProductionInput {
  tracks: CreativeProductionTrack[];
  artwork?: CreativeProductionArtwork;
  videos?: CreativeProductionVideo[];
  derivatives?: number;
  revisions?: number;
}

export interface CreativeProductionOutput {
  deliveryReady: boolean;
  syncReadyScore: number;
  missingItems: string[];
  creditsComplete: boolean;
}

export class CreativeProductionCompiler implements HarnessCompiler<CreativeProductionInput, CreativeProductionOutput> {
  readonly domain = 'creative_production';

  compile(input: CreativeProductionInput, ctx: HarnessContext): HarnessRun<CreativeProductionOutput> {
    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    const approvalGates: HarnessApprovalGate[] = [];
    const missingItems: string[] = [];

    let deliveryReady = true;
    let syncReadyScore = 100;
    let creditsComplete = true;

    if (!input.tracks || input.tracks.length === 0) {
      deliveryReady = false;
      missingItems.push('No tracks provided');
      findings.push({
        id: 'no_tracks',
        domain: this.domain,
        severity: 'critical',
        title: 'No Tracks Available',
        detail: 'Cannot proceed with creative production without tracks.',
        confidence: 'high'
      });
      syncReadyScore = 0;
    } else {
      input.tracks.forEach(track => {
        if (!track.hasMaster) {
          deliveryReady = false;
          missingItems.push(`Master missing for track: ${track.title}`);
          findings.push({
            id: `missing_master_${track.id}`,
            domain: this.domain,
            severity: 'critical',
            title: `Missing Master: ${track.title}`,
            detail: 'Missing master blocks delivery. Please upload final master.',
            confidence: 'high'
          });
        }
        
        if (!track.hasStems) {
          syncReadyScore -= Math.floor(100 / input.tracks.length);
          findings.push({
            id: `missing_stems_${track.id}`,
            domain: this.domain,
            severity: 'medium',
            title: `Missing Stems: ${track.title}`,
            detail: 'Missing stems reduces sync licensing readiness.',
            confidence: 'high'
          });
          recommendations.push({
            id: `upload_stems_${track.id}`,
            domain: this.domain,
            priority: 'medium',
            title: `Upload Stems for ${track.title}`,
            detail: 'Stems are highly recommended for sync opportunities.',
            ownerAgentId: 'creative',
            approvalRequired: false,
            nextAction: 'Upload stems.'
          });
        }

        if (!track.credits || track.credits.length === 0) {
          creditsComplete = false;
          findings.push({
            id: `missing_credits_${track.id}`,
            domain: this.domain,
            severity: 'high',
            title: `Missing Credits: ${track.title}`,
            detail: 'Missing credits. Credits feed DDEX and publishing pipelines.',
            confidence: 'high'
          });
        }
      });
    }

    if (!creditsComplete) {
      recommendations.push({
        id: 'complete_credits',
        domain: this.domain,
        priority: 'high',
        title: 'Complete Track Credits',
        detail: 'Credits must be finalized before DDEX distribution.',
        ownerAgentId: 'creative',
        approvalRequired: false,
        nextAction: 'Fill in track credits.'
      });
    }

    if (!input.artwork || !input.artwork.hasArtwork) {
      deliveryReady = false;
      missingItems.push('Artwork missing');
      findings.push({
        id: 'missing_artwork',
        domain: this.domain,
        severity: 'high',
        title: 'Missing Artwork',
        detail: 'Artwork is required for distribution delivery.',
        confidence: 'high'
      });
    } else if (input.artwork) {
      if (input.artwork.hasLegalIssue || input.artwork.hasBrandIssue) {
        deliveryReady = false;
        findings.push({
          id: 'artwork_issue',
          domain: this.domain,
          severity: 'critical',
          title: 'Artwork Legal/Brand Issue',
          detail: 'Artwork has potential legal or brand safety issues. Routes to Legal and Merch.',
          confidence: 'high'
        });
        approvalGates.push({
          id: 'artwork_legal_approval',
          label: 'Artwork Legal Approval',
          reason: 'Potential legal or brand issue detected in artwork.',
          requiredFor: 'distribution',
          riskTier: 'attorney_review'
        });
        agentBriefs.push({
          agentId: 'legal',
          brief: 'Review artwork for legal and brand compliance due to flagged issues.',
          inputs: ['artwork']
        });
        agentBriefs.push({
          agentId: 'merch',
          brief: 'Review artwork for brand safety.',
          inputs: ['artwork']
        });
      }
    }

    const output: CreativeProductionOutput = {
      deliveryReady,
      syncReadyScore: Math.max(0, syncReadyScore),
      missingItems,
      creditsComplete
    };

    return createHarnessRun<CreativeProductionOutput>({
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      schemaVersion: 1,
      inputRefs: input.tracks ? input.tracks.map(t => ({ type: 'track', id: t.id, label: t.title })) : [],
      scores: [
        {
          label: 'Delivery Readiness',
          value: deliveryReady ? 100 : 0,
          max: 100,
          status: deliveryReady ? 'good' : 'blocked',
          rationale: deliveryReady ? 'All required assets present.' : 'Missing critical assets for delivery.'
        },
        {
          label: 'Sync Readiness',
          value: output.syncReadyScore,
          max: 100,
          status: output.syncReadyScore >= 100 ? 'good' : output.syncReadyScore >= 50 ? 'watch' : 'blocked',
          rationale: 'Based on availability of stems and mix versions.'
        }
      ],
      findings,
      recommendations,
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: [],
      confidence: 0.9,
      output
    });
  }
}

export const creativeProductionCompiler = new CreativeProductionCompiler();
