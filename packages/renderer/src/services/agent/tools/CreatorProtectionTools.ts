import { auth } from '@/services/firebase';
import { saveHarnessRun } from '@/services/business-harness';
import {
  creatorProtectionHarnessService,
  saveEvidencePacket,
  saveIdentityProtectionProfile,
  saveReplicaIncident,
  saveTakedownCase,
} from '@/services/creator-protection';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import type { HarnessEvidenceRef } from '@/services/business-harness';

export const CreatorProtectionTools: Record<string, AnyToolFunction> = {
  create_identity_protection_profile: wrapTool('create_identity_protection_profile', async (args: {
    legalName?: string;
    artistName?: string;
    state?: string;
    country?: string;
    entityName?: string;
    labelName?: string;
    publisherName?: string;
    pro?: 'ASCAP' | 'BMI' | 'SESAC' | 'GMR' | 'Other' | 'None';
    ipiCae?: string;
    trademarkStatus?: 'none' | 'search_needed' | 'pending' | 'registered' | 'unknown';
    copyrightStatus?: 'none' | 'draft' | 'pending' | 'registered' | 'unknown';
    aiVoiceLikenessPermission?: 'not_authorized' | 'case_by_case' | 'authorized_license_only';
    monitoringOptIn?: boolean;
    biometricFingerprintOptIn?: boolean;
    save?: boolean;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const profile = creatorProtectionHarnessService.createIdentityProtectionProfile({ ...args, userId });
    const savedProfileId = args.save ? await saveIdentityProtectionProfile(profile) : undefined;
    const run = creatorProtectionHarnessService.compileReadiness({ profile });
    const savedRunId = args.save ? await saveHarnessRun(run) : undefined;
    return toolSuccess({ profile, run, savedProfileId, savedRunId }, 'Identity protection profile prepared. AI voice/likeness use defaults to not authorized unless explicitly changed.');
  }),

  assess_digital_replica_risk: wrapTool('assess_digital_replica_risk', async (args: {
    legalName?: string;
    artistName?: string;
    state?: string;
    country?: string;
    pro?: 'ASCAP' | 'BMI' | 'SESAC' | 'GMR' | 'Other' | 'None';
    ipiCae?: string;
    trademarkStatus?: 'none' | 'search_needed' | 'pending' | 'registered' | 'unknown';
    copyrightStatus?: 'none' | 'draft' | 'pending' | 'registered' | 'unknown';
    workTitle?: string;
    isrc?: string;
    upc?: string;
    iswc?: string;
    catalogNumber?: string;
    save?: boolean;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');

    const profile = creatorProtectionHarnessService.createIdentityProtectionProfile({
      userId,
      legalName: args.legalName,
      artistName: args.artistName,
      state: args.state,
      country: args.country,
      pro: args.pro,
      ipiCae: args.ipiCae,
      trademarkStatus: args.trademarkStatus,
      copyrightStatus: args.copyrightStatus,
    });
    const run = creatorProtectionHarnessService.compileReadiness({
      profile,
      works: [{
        workTitle: args.workTitle,
        isrc: args.isrc,
        upc: args.upc,
        iswc: args.iswc,
        catalogNumber: args.catalogNumber,
      }],
    });
    const savedRunId = args.save ? await saveHarnessRun(run) : undefined;
    return toolSuccess({ run, savedRunId }, 'Creator protection readiness assessed. This is operational triage, not legal advice.');
  }),

  classify_replica_incident: wrapTool('classify_replica_incident', async (args: {
    profileId?: string;
    suspectedUrl?: string;
    platform?: string;
    description: string;
    nonconsensualIntimateImagery?: boolean;
    evidenceRefs?: HarnessEvidenceRef[];
    save?: boolean;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    const incident = creatorProtectionHarnessService.classifyIncident({ ...args, userId });
    const savedIncidentId = args.save ? await saveReplicaIncident(incident) : undefined;
    return toolSuccess({ incident, savedIncidentId }, 'Replica incident classified and routed. No notice was sent.');
  }),

  generate_evidence_packet: wrapTool('generate_evidence_packet', async (args: {
    title?: string;
    profileId?: string;
    incidentId?: string;
    workTitle?: string;
    isrc?: string;
    upc?: string;
    iswc?: string;
    catalogNumber?: string;
    copyrightRegistration?: string;
    proWorkId?: string;
    evidenceRefs?: HarnessEvidenceRef[];
    userDeclaration?: string;
    save?: boolean;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    const packet = creatorProtectionHarnessService.generateEvidencePacket({
      userId,
      title: args.title,
      profileId: args.profileId,
      incidentId: args.incidentId,
      work: {
        workTitle: args.workTitle,
        isrc: args.isrc,
        upc: args.upc,
        iswc: args.iswc,
        catalogNumber: args.catalogNumber,
        copyrightRegistration: args.copyrightRegistration,
        proWorkId: args.proWorkId,
      },
      evidenceRefs: args.evidenceRefs,
      userDeclaration: args.userDeclaration,
    });
    const savedPacketId = args.save ? await saveEvidencePacket(packet) : undefined;
    return toolSuccess({ packet, savedPacketId }, 'Evidence packet drafted. It does not guarantee enforcement and should be reviewed before use.');
  }),

  prepare_digital_replica_takedown: wrapTool('prepare_digital_replica_takedown', async (args: {
    suspectedUrl?: string;
    platform?: string;
    description: string;
    rightsholderName?: string;
    originalWorkTitle?: string;
    nonconsensualIntimateImagery?: boolean;
    save?: boolean;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    const incident = creatorProtectionHarnessService.classifyIncident({
      userId,
      suspectedUrl: args.suspectedUrl,
      platform: args.platform,
      description: args.description,
      nonconsensualIntimateImagery: args.nonconsensualIntimateImagery,
    });
    const packet = creatorProtectionHarnessService.generateEvidencePacket({
      userId,
      incidentId: incident.id,
      work: { workTitle: args.originalWorkTitle },
      evidenceRefs: args.suspectedUrl ? [{ id: 'reported-url', type: 'url', label: 'Reported URL', url: args.suspectedUrl }] : [],
    });
    const takedownCase = creatorProtectionHarnessService.prepareTakedownDraft({
      userId,
      incident,
      packet,
      rightsholderName: args.rightsholderName,
      originalWorkTitle: args.originalWorkTitle,
    });
    const savedIncidentId = args.save ? await saveReplicaIncident(incident) : undefined;
    const savedPacketId = args.save ? await saveEvidencePacket(packet) : undefined;
    const savedTakedownCaseId = args.save ? await saveTakedownCase(takedownCase) : undefined;
    return toolSuccess({
      incident,
      packet,
      takedownCase,
      savedIncidentId,
      savedPacketId,
      savedTakedownCaseId,
    }, 'Digital replica takedown packet drafted. User approval is required before sending.');
  }),

  review_ai_voice_likeness_clause: wrapTool('review_ai_voice_likeness_clause', async (args: {
    contractText: string;
  }) => {
    if (!args.contractText?.trim()) return toolError('contractText is required', 'VALIDATION_ERROR');
    const review = creatorProtectionHarnessService.reviewAIVoiceLikenessClause(args.contractText);
    return toolSuccess(review, 'AI voice/likeness clause reviewed. Attorney review remains required for final legal advice.');
  }),

  create_ai_voice_license_terms: wrapTool('create_ai_voice_license_terms', async (args: {
    profileId: string;
    licensee: string;
    permittedUses?: string[];
    compensation?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    const license = creatorProtectionHarnessService.createAIVoiceLicenseTerms({ ...args, userId });
    return toolSuccess(license, 'Draft AI voice/likeness license terms created. This is not a signed authorization.');
  }),

  monitor_identity_misuse: wrapTool('monitor_identity_misuse', async (args: {
    profileId?: string;
    query?: string;
    biometricFingerprintOptIn?: boolean;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    return toolSuccess({
      userId,
      profileId: args.profileId,
      query: args.query,
      monitoringMode: args.biometricFingerprintOptIn ? 'requires_security_review' : 'manual_url_intake',
      alerts: [],
      approvalRequired: !!args.biometricFingerprintOptIn,
    }, 'Identity monitoring is staged for manual URL intake. Biometric/fingerprint monitoring requires explicit opt-in and Security review.');
  }),

  escalate_to_attorney: wrapTool('escalate_to_attorney', async (args: {
    incidentSummary: string;
    preferredJurisdiction?: string;
    evidencePacketId?: string;
  }) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return toolError('Authentication required', 'AUTH_REQUIRED');
    return toolSuccess({
      userId,
      status: 'ready_for_counsel',
      incidentSummary: args.incidentSummary,
      preferredJurisdiction: args.preferredJurisdiction,
      evidencePacketId: args.evidencePacketId,
      nextAction: 'Open Legal counsel workflow and attach evidence packet.',
    }, 'Attorney escalation packet prepared. No attorney was contacted automatically.');
  }),
};

