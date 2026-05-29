import { describe, it, expect, vi } from 'vitest';
import {
  EducationCurriculumCompiler,
  EducationCurriculumInput,
  EducationCurriculumOutput
} from './EducationCurriculumCompiler';
import { HarnessContext } from '@indii/shared';

describe('EducationCurriculumCompiler', () => {
  const compiler = new EducationCurriculumCompiler();
  const ctx: HarnessContext = { userId: 'user123' };

  it('triggers metadata tutorial on repeated DDEX failure', () => {
    const input: EducationCurriculumInput = {
      signals: [{ type: 'ddex_failure', count: 2 }],
      daysSinceSignup: 10
    };

    const run = compiler.compile(input, ctx);
    
    expect(run.domain).toBe('education_curriculum');
    expect(run.output.learningGaps).toContain('metadata_standards');
    expect(run.output.suggestedTutorials).toContain('tutorial_metadata_ddex');
    
    const finding = run.findings.find(f => f.severity === 'high');
    expect(finding).toBeDefined();
    expect(finding?.title).toBe('Repeated DDEX Failures Detected');

    const recommendation = run.recommendations.find(r => r.nextAction === 'show_tutorial_metadata_ddex');
    expect(recommendation).toBeDefined();
    
    const agentBrief = run.agentBriefs.find(a => a.agentId === 'keeper');
    expect(agentBrief).toBeDefined();

    const approvalGate = run.approvalGates.find(g => g.requiredFor === 'distribution_ddex');
    expect(approvalGate).toBeDefined();
  });

  it('triggers capability introduction when marketing agent is unused', () => {
    const input: EducationCurriculumInput = {
      signals: [{ type: 'agent_interaction', agentId: 'marketing', count: 0 }],
      daysSinceSignup: 8
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.learningGaps).toContain('marketing_agent_awareness');
    expect(run.output.suggestedTutorials).toContain('intro_marketing_agent');

    const recommendation = run.recommendations.find(r => r.nextAction === 'show_marketing_intro');
    expect(recommendation).toBeDefined();

    const agentBrief = run.agentBriefs.find(a => a.inputs.includes('marketing_agent_interactions'));
    expect(agentBrief).toBeDefined();
  });

  it('does NOT trigger marketing introduction if daysSinceSignup <= 7', () => {
    const input: EducationCurriculumInput = {
      signals: [{ type: 'agent_interaction', agentId: 'marketing', count: 0 }],
      daysSinceSignup: 5
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.learningGaps).not.toContain('marketing_agent_awareness');
    expect(run.output.suggestedTutorials).not.toContain('intro_marketing_agent');
  });

  it('skips basic onboarding for fast learners', () => {
    const input: EducationCurriculumInput = {
      signals: [
        { type: 'onboarding_step_skipped', count: 1 },
        { type: 'onboarding_step_completed', count: 4 }
      ],
      daysSinceSignup: 1
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.skipOnboarding).toBe(true);

    const finding = run.findings.find(f => f.title === 'Fast Learner Detected');
    expect(finding).toBeDefined();

    const recommendation = run.recommendations.find(r => r.nextAction === 'disable_basic_onboarding');
    expect(recommendation).toBeDefined();
    expect(recommendation?.approvalRequired).toBe(true);
    
    const approvalGate = run.approvalGates.find(g => g.requiredFor === 'education_curriculum');
    expect(approvalGate).toBeDefined();
  });
});
