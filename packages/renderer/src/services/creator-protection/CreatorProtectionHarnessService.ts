import type {
  HarnessEvidenceRef,
  HarnessFinding,
  HarnessLegalBasis,
  HarnessRecommendation,
} from '@/services/business-harness/types';
import { createHarnessRun } from '@/services/business-harness/types';
import type {
  CreatorProtectionReadinessOutput,
  CreatorProtectionRun,
  EvidencePacket,
  IdentityProtectionProfile,
  LegalSourceSnapshot,
  ReplicaIncident,
  ReplicaIncidentType,
  TakedownCase,
  TakedownRoute,
  VoiceLikenessConsentRecord,
  AuthorizedReplicaLicense,
} from './types';

export const CREATOR_PROTECTION_SOURCES: LegalSourceSnapshot[] = [
  {
    id: 'take_it_down_act_2025',
    label: 'TAKE IT DOWN Act',
    jurisdiction: 'federal',
    status: 'enacted',
    effectiveDate: '2025-05-19',
    sourceUrl: 'https://www.whitehouse.gov/presidential-actions/2025/05/president-donald-j-trump-signed-s-146-into-law/?query-11-page=6',
    summary: 'Federal law addressing nonconsensual intimate visual depictions and covered platform removal obligations. It is not a broad music voice-clone registry.',
    attorneyReviewRequired: true,
    checkedAt: '2026-05-28',
  },
  {
    id: 'no_fakes_act_2025',
    label: 'NO FAKES Act of 2025',
    jurisdiction: 'federal',
    status: 'proposed',
    sourceUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1367/all-info',
    summary: 'Proposed federal digital-replica right for voice and visual likeness. Treat as pending until official status changes.',
    attorneyReviewRequired: true,
    checkedAt: '2026-05-28',
  },
  {
    id: 'copyright_office_digital_replicas_part_1',
    label: 'U.S. Copyright Office AI Report Part 1: Digital Replicas',
    jurisdiction: 'federal',
    status: 'guidance',
    sourceUrl: 'https://copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-1-Digital-Replicas-Report.pdf',
    summary: 'Copyright Office recommends federal digital-replica legislation and separates voice/persona rights from copyright in sound recordings.',
    attorneyReviewRequired: true,
    checkedAt: '2026-05-28',
  },
  {
    id: 'copyright_office_ai_copyrightability_part_2',
    label: 'U.S. Copyright Office AI Report Part 2: Copyrightability',
    jurisdiction: 'federal',
    status: 'guidance',
    sourceUrl: 'https://www.copyright.gov/newsnet/2025/1060.html?trk=public_post_comment-text',
    summary: 'AI-assisted work can be copyrightable when sufficient human authorship exists; mere prompts are not enough.',
    attorneyReviewRequired: true,
    checkedAt: '2026-05-28',
  },
  {
    id: 'tennessee_elvis_act_2024',
    label: 'Tennessee ELVIS Act',
    jurisdiction: 'state',
    status: 'enacted',
    effectiveDate: '2024-07-01',
    sourceUrl: 'https://www.tn.gov/governor/news/2024/3/21/photos--gov--lee-signs-elvis-act-into-law.html',
    summary: 'State-level music-industry protection for voice, likeness, and image against AI misuse. State applicability depends on facts and counsel review.',
    attorneyReviewRequired: true,
    checkedAt: '2026-05-28',
  },
];

export interface ProtectionProfileInput {
  userId: string;
  legalName?: string;
  artistName?: string;
  state?: string;
  country?: string;
  entityName?: string;
  labelName?: string;
  publisherName?: string;
  pro?: IdentityProtectionProfile['pro'];
  ipiCae?: string;
  trademarkStatus?: IdentityProtectionProfile['trademarkStatus'];
  copyrightStatus?: IdentityProtectionProfile['copyrightStatus'];
  aiVoiceLikenessPermission?: IdentityProtectionProfile['aiVoiceLikenessPermission'];
  monitoringOptIn?: boolean;
  biometricFingerprintOptIn?: boolean;
}

export interface WorkProtectionInput {
  workTitle?: string;
  isrc?: string;
  upc?: string;
  iswc?: string;
  catalogNumber?: string;
  copyrightRegistration?: string;
  proWorkId?: string;
  humanAuthorshipStatement?: string;
}

export class CreatorProtectionHarnessService {
  createIdentityProtectionProfile(input: ProtectionProfileInput): IdentityProtectionProfile {
    const now = new Date().toISOString();
    return {
      id: `identity_profile_${Date.now()}`,
      userId: input.userId,
      legalName: input.legalName,
      artistName: input.artistName,
      state: input.state,
      country: input.country ?? 'US',
      entityName: input.entityName,
      labelName: input.labelName,
      publisherName: input.publisherName,
      pro: input.pro ?? 'None',
      ipiCae: input.ipiCae,
      trademarkStatus: input.trademarkStatus ?? 'unknown',
      copyrightStatus: input.copyrightStatus ?? 'unknown',
      aiVoiceLikenessPermission: input.aiVoiceLikenessPermission ?? 'not_authorized',
      monitoringOptIn: input.monitoringOptIn ?? false,
      biometricFingerprintOptIn: input.biometricFingerprintOptIn ?? false,
      createdAt: now,
      updatedAt: now,
    };
  }

  compileReadiness(input: {
    profile: IdentityProtectionProfile;
    works?: WorkProtectionInput[];
    evidenceRefs?: HarnessEvidenceRef[];
  }): CreatorProtectionRun {
    const readiness = scoreReadiness(input.profile, input.works ?? []);
    const findings = buildFindings(input.profile, readiness);
    const recommendations = buildRecommendations(readiness);
    const legalBasis: HarnessLegalBasis[] = CREATOR_PROTECTION_SOURCES;

    return createHarnessRun<CreatorProtectionReadinessOutput>({
      userId: input.profile.userId,
      domain: 'creator_protection',
      inputRefs: [
        { type: 'user', id: input.profile.userId, label: input.profile.artistName ?? input.profile.legalName ?? 'Not provided' },
        ...(input.works ?? []).map(work => ({ type: 'track' as const, id: work.isrc, label: work.workTitle })),
      ],
      scores: [{
        label: 'Creator Protection Readiness',
        value: readiness.score,
        max: 100,
        status: readiness.status === 'protected' ? 'good' : readiness.status === 'at_risk' ? 'blocked' : 'watch',
        rationale: readiness.nextActions[0] ?? 'Protection profile evaluated.',
      }],
      findings,
      recommendations,
      costLines: [],
      legalBasis,
      evidenceRefs: input.evidenceRefs ?? [],
      agentBriefs: [{
        agentId: 'legal',
        departmentId: 'legal',
        brief: 'Review creator protection readiness, AI voice/likeness permissions, and state/federal protection options.',
        inputs: readiness.blockers,
        blockedBy: readiness.status === 'at_risk' ? readiness.blockers : undefined,
      }, {
        agentId: 'security',
        departmentId: 'security',
        brief: 'Ensure evidence, monitoring, and any future fingerprinting flow has explicit user consent and audit trails.',
        inputs: ['identity profile', 'evidence refs', 'monitoring opt-in'],
      }],
      approvalGates: input.profile.biometricFingerprintOptIn ? [{
        id: 'biometric_fingerprint_review',
        label: 'Biometric/fingerprint monitoring review',
        reason: 'Voice/acoustic fingerprint monitoring requires explicit consent, deletion controls, and Security review.',
        requiredFor: 'enable fingerprint monitoring',
        riskTier: 'attorney_review',
      }] : [],
      assumptions: [
        'This harness provides operational triage and does not provide legal advice.',
        'NO FAKES is treated as proposed unless official bill status changes.',
        'TAKE IT DOWN routing applies only to qualifying nonconsensual intimate visual depiction scenarios.',
      ],
      confidence: readiness.score / 100,
      output: {
        profile: input.profile,
        readiness,
        lawSnapshots: CREATOR_PROTECTION_SOURCES,
      },
    });
  }

  classifyIncident(input: {
    userId: string;
    profileId?: string;
    suspectedUrl?: string;
    platform?: string;
    description: string;
    nonconsensualIntimateImagery?: boolean;
    evidenceRefs?: HarnessEvidenceRef[];
  }): ReplicaIncident {
    const text = `${input.description} ${input.suspectedUrl ?? ''} ${input.platform ?? ''}`.toLowerCase();
    const incidentType = classifyIncidentType(text, input.nonconsensualIntimateImagery);
    const route = routeForIncident(incidentType, text);
    const severity = severityForIncident(incidentType);
    return {
      id: `replica_incident_${Date.now()}`,
      userId: input.userId,
      profileId: input.profileId,
      incidentType,
      severity,
      status: 'needs_review',
      suspectedUrl: input.suspectedUrl,
      platform: input.platform,
      description: input.description,
      confidence: confidenceForIncident(incidentType, text),
      route,
      evidenceRefs: input.evidenceRefs ?? [],
      legalBasisRefs: legalBasisRefsForIncident(incidentType),
      createdAt: new Date().toISOString(),
    };
  }

  generateEvidencePacket(input: {
    userId: string;
    title?: string;
    profileId?: string;
    incidentId?: string;
    work?: WorkProtectionInput;
    evidenceRefs?: HarnessEvidenceRef[];
    userDeclaration?: string;
  }): EvidencePacket {
    const work = input.work ?? {};
    return {
      id: `evidence_packet_${Date.now()}`,
      userId: input.userId,
      title: input.title ?? `Creator protection evidence packet${work.workTitle ? `: ${work.workTitle}` : ''}`,
      profileId: input.profileId,
      incidentId: input.incidentId,
      workTitle: work.workTitle,
      identifiers: {
        isrc: work.isrc,
        upc: work.upc,
        iswc: work.iswc,
        catalogNumber: work.catalogNumber,
        copyrightRegistration: work.copyrightRegistration,
        proWorkId: work.proWorkId,
      },
      evidenceRefs: input.evidenceRefs ?? [],
      declaration: input.userDeclaration ?? 'I am preparing this packet to document ownership, authorship, authorization status, and suspected misuse. This packet is for platform, attorney, or internal review and is not a guarantee of enforcement.',
      warnings: [
        'Attorney review is required before litigation, damages claims, or contested state-law publicity claims.',
        'Do not submit false or materially misleading takedown notices.',
      ],
      createdAt: new Date().toISOString(),
    };
  }

  prepareTakedownDraft(input: {
    userId: string;
    incident: ReplicaIncident;
    packet?: EvidencePacket;
    rightsholderName?: string;
    originalWorkTitle?: string;
  }): TakedownCase {
    const subject = subjectForRoute(input.incident.route, input.originalWorkTitle);
    return {
      id: `takedown_case_${Date.now()}`,
      userId: input.userId,
      incidentId: input.incident.id,
      route: input.incident.route,
      status: input.incident.route === 'attorney_escalation' ? 'ready_for_counsel' : 'needs_user_approval',
      recipient: recipientForRoute(input.incident.route, input.incident.platform),
      subject,
      draftText: buildTakedownText(input),
      approvalRequired: true,
      attorneyReviewRecommended: input.incident.route === 'attorney_escalation' || input.incident.legalBasisRefs.includes('no_fakes_act_2025'),
      warnings: [
        'Draft only. No notice has been sent.',
        'User approval is required before sending.',
        'Attorney review is recommended for unclear rights, state-law claims, damages, or court action.',
      ],
      createdAt: new Date().toISOString(),
    };
  }

  reviewAIVoiceLikenessClause(contractText: string): {
    flags: string[];
    severity: 'low' | 'medium' | 'high';
    recommendedClause: string;
  } {
    const text = contractText.toLowerCase();
    const clauseChecks: Array<[string, string]> = [
      ['voice', 'Contract references voice rights.'],
      ['likeness', 'Contract references likeness rights.'],
      ['digital replica', 'Contract references digital replica rights.'],
      ['synthetic', 'Contract references synthetic performance rights.'],
      ['training', 'Contract references AI/model training rights.'],
      ['perpetual', 'Contract may grant rights forever.'],
      ['sublicense', 'Contract may allow sublicensing.'],
      ['irrevocable', 'Contract may limit revocation.'],
    ];
    const flags = clauseChecks.filter(([needle]) => text.includes(needle)).map(([, flag]) => flag);
    const highRisk = flags.some(flag => /training|forever|sublicensing|revocation|digital replica|synthetic/i.test(flag));
    return {
      flags,
      severity: highRisk ? 'high' : flags.length ? 'medium' : 'low',
      recommendedClause: 'No AI voice, likeness, digital replica, synthetic performance, or model-training use is authorized unless separately approved in a signed writing that states scope, duration, compensation, sublicensing limits, revocation rights, and deletion obligations.',
    };
  }

  createAIVoiceLicenseTerms(input: {
    userId: string;
    profileId: string;
    licensee: string;
    permittedUses?: string[];
    compensation?: string;
  }): AuthorizedReplicaLicense {
    return {
      id: `replica_license_${Date.now()}`,
      userId: input.userId,
      profileId: input.profileId,
      licensee: input.licensee,
      permittedUses: input.permittedUses ?? ['Specific project use only after written approval'],
      prohibitedUses: ['model training', 'political endorsement', 'adult content', 'defamatory content', 'sublicensing without written approval', 'new songs without separate written approval'],
      compensation: input.compensation ?? 'TBD by written agreement',
      revocation: 'License may be revoked for unauthorized scope expansion, nonpayment, misleading endorsement, or platform/policy violations.',
      approvalRequiredForNewUse: true,
      createdAt: new Date().toISOString(),
    };
  }

  createConsentRecord(input: {
    userId: string;
    profileId: string;
    grantee: string;
    scope: string;
  }): VoiceLikenessConsentRecord {
    return {
      id: `consent_${Date.now()}`,
      userId: input.userId,
      profileId: input.profileId,
      grantee: input.grantee,
      scope: input.scope,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
  }
}

export const creatorProtectionHarnessService = new CreatorProtectionHarnessService();

function scoreReadiness(profile: IdentityProtectionProfile, works: WorkProtectionInput[]) {
  let score = 20;
  const blockers: string[] = [];
  const strengths: string[] = [];
  const nextActions: string[] = [];

  if (profile.artistName) { score += 10; strengths.push('Artist name captured.'); } else { blockers.push('Artist name missing.'); nextActions.push('Add artist/stage name.'); }
  if (profile.legalName || profile.entityName) { score += 10; strengths.push('Legal identity/entity captured.'); } else { nextActions.push('Add legal name or entity for notices and registration packets.'); }
  if (profile.aiVoiceLikenessPermission === 'not_authorized') { score += 10; strengths.push('Default AI voice/likeness permission is not authorized.'); }
  if (profile.monitoringOptIn) { score += 8; strengths.push('Monitoring opt-in captured.'); } else { nextActions.push('Enable monitoring when the user wants ongoing alerts.'); }
  if (profile.biometricFingerprintOptIn) { blockers.push('Biometric/fingerprint monitoring needs Security and legal review.'); }
  if (profile.trademarkStatus === 'registered' || profile.trademarkStatus === 'pending') { score += 12; strengths.push('Trademark status is tracked.'); } else { nextActions.push('Run artist-name/brand trademark clearance.'); }
  if (profile.copyrightStatus === 'registered' || profile.copyrightStatus === 'pending') { score += 12; strengths.push('Copyright status is tracked.'); } else { nextActions.push('Prepare copyright registration packet for key works.'); }
  if (profile.pro && profile.pro !== 'None') { score += 8; strengths.push('PRO affiliation captured.'); } else { nextActions.push('Capture PRO/MLC readiness for compositions.'); }
  if (profile.ipiCae) { score += 5; strengths.push('IPI/CAE captured.'); }
  if (works.some(work => work.isrc || work.upc || work.iswc || work.copyrightRegistration)) { score += 15; strengths.push('At least one protected work has identifiers or registrations attached.'); } else { nextActions.push('Attach ISRC/UPC/ISWC/copyright registration data to priority works.'); }

  const capped = Math.min(100, score);
  return {
    score: capped,
    status: capped >= 80 ? 'protected' as const : capped >= 50 ? 'partial' as const : 'at_risk' as const,
    blockers,
    strengths,
    nextActions: nextActions.length ? nextActions : ['Keep source-law snapshots current and review new incidents as they appear.'],
  };
}

function buildFindings(profile: IdentityProtectionProfile, readiness: ReturnType<typeof scoreReadiness>): HarnessFinding[] {
  return [
    ...readiness.blockers.map((blocker, index) => ({
      id: `creator_blocker_${index}`,
      domain: 'creator_protection' as const,
      severity: blocker.includes('Biometric') ? 'critical' as const : 'high' as const,
      title: blocker,
      detail: 'This item should be resolved before relying on automated monitoring or external legal workflows.',
      confidence: 'high' as const,
    })),
    {
      id: 'law_status_distinction',
      domain: 'creator_protection',
      severity: 'medium',
      title: 'Current law and proposed law must stay separated',
      detail: 'TAKE IT DOWN is enacted for qualifying NCII scenarios; NO FAKES is tracked as proposed in this baseline.',
      confidence: 'high',
      legalBasisRefs: ['take_it_down_act_2025', 'no_fakes_act_2025'],
    },
    {
      id: 'voice_not_copyright_itself',
      domain: 'creator_protection',
      severity: 'medium',
      title: 'Voice/persona protection is not the same as copyright registration',
      detail: 'Copyright can protect works and recordings, while voice/persona claims need publicity, unfair competition, contract, platform, state, or future federal replica-right analysis.',
      confidence: 'high',
      legalBasisRefs: ['copyright_office_digital_replicas_part_1'],
    },
    ...(profile.aiVoiceLikenessPermission === 'not_authorized' ? [{
      id: 'ai_voice_default_not_authorized',
      domain: 'creator_protection' as const,
      severity: 'info' as const,
      title: 'AI voice/likeness default is not authorized',
      detail: 'The user has not granted blanket AI voice or likeness usage rights.',
      confidence: 'high' as const,
    }] : []),
  ];
}

function buildRecommendations(readiness: ReturnType<typeof scoreReadiness>): HarnessRecommendation[] {
  return readiness.nextActions.map((action, index) => ({
    id: `creator_next_${index}`,
    domain: 'creator_protection',
    priority: readiness.status === 'at_risk' ? 'high' : 'medium',
    title: action,
    detail: 'Complete this step to improve creator protection readiness.',
    ownerAgentId: action.toLowerCase().includes('monitoring') ? 'security' : 'legal',
    approvalRequired: action.toLowerCase().includes('monitoring') || action.toLowerCase().includes('registration'),
    nextAction: action,
  }));
}

function classifyIncidentType(text: string, ncii?: boolean): ReplicaIncidentType {
  if (ncii || /(intimate|explicit|ncii|revenge porn|sexual deepfake)/.test(text)) return 'take_it_down_ncii';
  if (/(voice|vocal|clone|soundalike|sang as me|ai song)/.test(text)) return 'voice_clone';
  if (/(face|photo|image|likeness|deepfake video|video of me)/.test(text)) return 'likeness_image';
  if (/(artist name|stage name|trademark|logo|brand|endorsement)/.test(text)) return 'artist_name_brand_confusion';
  if (/(fake account|impersonat|scam|fraud|pretending to be me)/.test(text)) return 'impersonation_fraud';
  if (/(copyright|stole my song|uploaded my track|used my beat|sampled my recording)/.test(text)) return 'copyright_infringement';
  if (/(platform|policy|terms|community guidelines)/.test(text)) return 'platform_policy_violation';
  return 'uncertain';
}

function routeForIncident(type: ReplicaIncidentType, text: string): TakedownRoute {
  if (type === 'take_it_down_ncii') return 'take_it_down_ftc';
  if (type === 'copyright_infringement') return 'dmca';
  if (type === 'voice_clone' || type === 'likeness_image') return 'platform_digital_replica';
  if (type === 'artist_name_brand_confusion') return text.includes('dsp') || text.includes('spotify') || text.includes('apple') ? 'dsp_duplicate_fraud' : 'trademark_brand_confusion';
  if (type === 'impersonation_fraud') return 'platform_impersonation';
  return 'attorney_escalation';
}

function severityForIncident(type: ReplicaIncidentType) {
  if (type === 'take_it_down_ncii' || type === 'impersonation_fraud') return 'critical' as const;
  if (type === 'voice_clone' || type === 'likeness_image') return 'high' as const;
  if (type === 'copyright_infringement' || type === 'artist_name_brand_confusion') return 'medium' as const;
  return 'low' as const;
}

function confidenceForIncident(type: ReplicaIncidentType, text: string): number {
  if (type === 'uncertain') return 0.25;
  return text.length > 80 ? 0.82 : 0.65;
}

function legalBasisRefsForIncident(type: ReplicaIncidentType): string[] {
  if (type === 'take_it_down_ncii') return ['take_it_down_act_2025'];
  if (type === 'voice_clone' || type === 'likeness_image') return ['no_fakes_act_2025', 'copyright_office_digital_replicas_part_1', 'tennessee_elvis_act_2024'];
  if (type === 'copyright_infringement') return ['copyright_office_ai_copyrightability_part_2'];
  return ['copyright_office_digital_replicas_part_1'];
}

function subjectForRoute(route: TakedownRoute, workTitle?: string): string {
  const target = workTitle ? ` for "${workTitle}"` : '';
  switch (route) {
    case 'dmca': return `DMCA takedown notice${target}`;
    case 'take_it_down_ftc': return 'TAKE IT DOWN Act platform removal request';
    case 'platform_digital_replica': return `Unauthorized AI digital replica notice${target}`;
    case 'platform_impersonation': return 'Impersonation/fraud report';
    case 'trademark_brand_confusion': return 'Artist name, brand, or false endorsement notice';
    case 'dsp_duplicate_fraud': return 'DSP duplicate/fraud release report';
    default: return 'Attorney review request';
  }
}

function recipientForRoute(route: TakedownRoute, platform?: string): string {
  if (route === 'take_it_down_ftc') return 'Platform removal portal / FTC follow-up if platform fails to act';
  if (route === 'attorney_escalation') return 'Qualified entertainment/IP attorney';
  return platform ? `${platform} trust and safety / rights portal` : 'Platform rights/trust portal';
}

function buildTakedownText(input: {
  incident: ReplicaIncident;
  packet?: EvidencePacket;
  rightsholderName?: string;
  originalWorkTitle?: string;
}): string {
  const name = input.rightsholderName ?? '[RIGHTSHOLDER NAME]';
  const work = input.originalWorkTitle ?? input.packet?.workTitle ?? '[ORIGINAL WORK / IDENTITY]';
  const url = input.incident.suspectedUrl ?? '[INFRINGING URL]';
  return [
    `To: ${recipientForRoute(input.incident.route, input.incident.platform)}`,
    '',
    `I am ${name}, or an authorized representative of ${name}. I am reporting suspected misuse involving ${work}.`,
    '',
    `Reported URL or location: ${url}`,
    `Incident type: ${input.incident.incidentType}`,
    `Requested route: ${input.incident.route}`,
    '',
    `I have a good-faith belief that the reported material is an unauthorized ${input.incident.route === 'platform_digital_replica' ? 'AI digital replica or voice/likeness misuse' : 'use'} or otherwise violates the applicable rights/policies identified in the attached evidence packet.`,
    input.packet ? `Evidence packet: ${input.packet.id}` : 'Evidence packet: [ATTACH SUPPORTING EVIDENCE BEFORE SENDING]',
    '',
    'Please remove, disable access to, demonetize, or escalate the reported material under the platform process that applies to this incident.',
    '',
    'This is a draft generated for review. The sender must confirm accuracy before submission.',
  ].join('\n');
}
