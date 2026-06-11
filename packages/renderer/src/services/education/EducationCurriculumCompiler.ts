import {
  HarnessCompiler,
  HarnessContext,
  HarnessDomain,
  HarnessRun,
  createHarnessRun,
  HarnessFinding,
  HarnessRecommendation,
  HarnessAgentBrief,
  HarnessApprovalGate
} from '@indii/shared';

export interface EducationBehaviorSignal {
  type: 'ddex_failure' | 'agent_interaction' | 'onboarding_step_completed' | 'onboarding_step_skipped';
  agentId?: string;
  count: number;
}

export interface EducationCurriculumInput {
  signals: EducationBehaviorSignal[];
  daysSinceSignup: number;
}

export interface EducationCurriculumOutput {
  learningGaps: string[];
  suggestedTutorials: string[];
  skipOnboarding: boolean;
}

export class EducationCurriculumCompiler implements HarnessCompiler<EducationCurriculumInput, EducationCurriculumOutput> {
  readonly domain: HarnessDomain = 'education_curriculum';

  compile(input: EducationCurriculumInput, ctx: HarnessContext): HarnessRun<EducationCurriculumOutput> {
    const gaps: string[] = [];
    const tutorials: string[] = [];
    let skipOnboarding = false;
    const findings: HarnessFinding[] = [];
    const recommendations: HarnessRecommendation[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    const approvalGates: HarnessApprovalGate[] = [];

    // Rule 1: Repeated DDEX failure triggers metadata tutorial
    const ddexFailures = input.signals.find(s => s.type === 'ddex_failure')?.count || 0;
    if (ddexFailures >= 2) {
      gaps.push('metadata_standards');
      tutorials.push('tutorial_metadata_ddex');
      findings.push({
        id: `finding_ddex_${Date.now()}`,
        domain: this.domain,
        severity: 'high',
        title: 'Repeated DDEX Failures Detected',
        detail: `User has encountered DDEX validation errors ${ddexFailures} times.`,
        confidence: 'high'
      });
      recommendations.push({
        id: `rec_ddex_tutorial_${Date.now()}`,
        domain: this.domain,
        priority: 'high',
        title: 'Take DDEX Metadata Tutorial',
        detail: 'A short tutorial on DDEX standards can prevent future distribution rejections.',
        ownerAgentId: 'curriculum',
        approvalRequired: false,
        nextAction: 'show_tutorial_metadata_ddex'
      });
      agentBriefs.push({
        agentId: 'keeper',
        departmentId: 'education',
        brief: 'User is struggling with DDEX metadata. Nudge them towards the metadata tutorial.',
        inputs: ['ddex_failure_count'],
      });
      approvalGates.push({
        id: `gate_ddex_tutorial_${Date.now()}`,
        label: 'Require DDEX Tutorial',
        reason: 'Repeated DDEX failures indicate a need for basic metadata understanding before further submissions.',
        requiredFor: 'distribution_ddex',
        riskTier: 'blocked'
      });
    }

    // Rule 2: Unused marketing agent triggers capability introduction
    const marketingInteractions = input.signals.find(s => s.type === 'agent_interaction' && s.agentId === 'marketing')?.count || 0;
    if (marketingInteractions === 0 && input.daysSinceSignup > 7) {
      gaps.push('marketing_agent_awareness');
      tutorials.push('intro_marketing_agent');
      recommendations.push({
        id: `rec_marketing_intro_${Date.now()}`,
        domain: this.domain,
        priority: 'medium',
        title: 'Introduce Marketing Agent',
        detail: 'User has not interacted with the marketing agent yet. Introduce its capabilities.',
        ownerAgentId: 'curriculum',
        approvalRequired: false,
        nextAction: 'show_marketing_intro'
      });
      agentBriefs.push({
        agentId: 'keeper',
        departmentId: 'education',
        brief: 'User has not used the marketing agent. Suggest a capability introduction.',
        inputs: ['marketing_agent_interactions', 'days_since_signup'],
      });
    }

    // Rule 3: Fast learner skips basic onboarding
    const skippedSteps = input.signals.find(s => s.type === 'onboarding_step_skipped')?.count || 0;
    const completedSteps = input.signals.find(s => s.type === 'onboarding_step_completed')?.count || 0;
    if (skippedSteps > 0 && completedSteps > 3 && input.daysSinceSignup < 2) {
      skipOnboarding = true;
      findings.push({
        id: `finding_fast_learner_${Date.now()}`,
        domain: this.domain,
        severity: 'info',
        title: 'Fast Learner Detected',
        detail: 'User is rapidly completing or skipping onboarding steps.',
        confidence: 'high'
      });
      recommendations.push({
        id: `rec_skip_onboarding_${Date.now()}`,
        domain: this.domain,
        priority: 'low',
        title: 'Skip Remaining Basic Onboarding',
        detail: 'User has demonstrated proficiency. Remove basic tooltips.',
        ownerAgentId: 'curriculum',
        approvalRequired: true,
        nextAction: 'disable_basic_onboarding'
      });
      approvalGates.push({
        id: `gate_skip_onboarding_${Date.now()}`,
        label: 'Approve Onboarding Skip',
        reason: 'User appears to be a fast learner. Confirm skipping the rest of the onboarding process.',
        requiredFor: 'education_curriculum',
        riskTier: 'approval'
      });
    }

    return createHarnessRun<EducationCurriculumOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs: [
        {
          type: 'user',
          id: ctx.userId,
          label: 'User Behavior History'
        }
      ],
      scores: [],
      findings,
      recommendations,
      costLines: [],
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: [],
      confidence: 0.9,
      output: {
        learningGaps: gaps,
        suggestedTutorials: tutorials,
        skipOnboarding
      }
    });
  }
}
