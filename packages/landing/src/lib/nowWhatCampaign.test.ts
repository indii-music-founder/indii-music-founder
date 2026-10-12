import { describe, expect, it } from 'vitest';
import { NOW_WHAT_CAMPAIGNS, readCampaignAttribution, campaignQuery } from './nowWhatCampaign';
import { evaluatePassport, GOAL_OPTIONS, INITIAL_ANSWERS } from './passportEvaluator';

describe('Now what campaign contracts (pure logic)', () => {
  it.each(NOW_WHAT_CAMPAIGNS)('accepts $id without altering answers', campaign => {
    expect(readCampaignAttribution(`?entry=${campaign.id}`).entry).toBe(campaign.id);
    expect(INITIAL_ANSWERS.careerStage).toBe('');
  });
  it('rejects unknown entries and bounds attribution without forwarding unrelated fields', () => {
    expect(readCampaignAttribution('?entry=unknown&email=private')).toEqual({});
    expect(readCampaignAttribution(`?utm_content=${'x'.repeat(200)}`).utm_content).toHaveLength(128);
  });
  it('preserves attribution, source and assessment across navigation', () => {
    const params = new URLSearchParams(campaignQuery('?entry=local-band&source=meta&assessmentId=abc&utm_campaign=now_what&email=private'));
    expect(params.get('entry')).toBe('local-band');
    expect(params.get('assessmentId')).toBe('abc');
    expect(params.get('source')).toBe('meta');
    expect(params.get('utm_campaign')).toBe('now_what');
    expect(params.has('email')).toBe(false);
  });
  it.each(GOAL_OPTIONS)('prioritizes $id even for established careers', goal => {
    const report = evaluatePassport({ ...INITIAL_ANSWERS, careerStage: 'Industry veteran / Catalog owner', proAffiliation: 'None', goals: [goal.id] });
    expect(report.steps[0].title).toBeTruthy();
    expect(report.steps).toHaveLength(3);
    expect(report.steps[1].title).toBe('Review your rights registration status');
  });
  it('maps every available priority to a distinct first recommendation', () => {
    const titles = GOAL_OPTIONS.map(goal => evaluatePassport({ ...INITIAL_ANSWERS, goals: [goal.id] }).steps[0].title);
    expect(new Set(titles).size).toBe(GOAL_OPTIONS.length);
  });
  it('honors goal order and avoids duplicate priorities', () => {
    const report = evaluatePassport({ ...INITIAL_ANSWERS, goals: ['Better understand music-business finances', 'Grow audience and fan engagement'] });
    expect(report.steps[0].title).toBe('Organize music income and expenses');
    expect(report.steps[1].title).toBe('Build direct fan relationships');
    expect(new Set(report.steps.map(s => s.title)).size).toBe(3);
  });
  it('keeps previously released catalog guidance and legacy empty-goal assessments usable', () => {
    const report = evaluatePassport({ ...INITIAL_ANSWERS, proAffiliation: 'BMI', mlcRegistered: 'Yes', releaseStatus: 'Already released / managing catalog' });
    expect(report.steps.some(s => s.title === 'Review your active catalog')).toBe(true);
  });
});
