import {
  HarnessCompiler,
  HarnessContext,
  HarnessRun,
  createHarnessRun,
  BusinessActivityEvent,
  HarnessCostLine,
  HarnessDomain,
  HarnessScore,
  HarnessInputRef
} from '@indii/shared';

export interface ActivityTimeValueInput {
  events: BusinessActivityEvent[];
  globalHourlyRateOverride?: number;
}

export interface ActivityTimeValueOutput {
  totalDurationMinutes: number;
  totalActiveMinutes: number;
  totalIdleMinutes: number;
  totalValue: number;
  valueByProject: Record<string, number>;
}

export class ActivityTimeValueCompiler implements HarnessCompiler<ActivityTimeValueInput, ActivityTimeValueOutput> {
  readonly domain: HarnessDomain = 'activity_time_value';

  compile(input: ActivityTimeValueInput, ctx: HarnessContext): HarnessRun<ActivityTimeValueOutput> {
    let totalDurationMinutes = 0;
    let totalActiveMinutes = 0;
    let totalIdleMinutes = 0;
    let totalValue = 0;
    const valueByProject: Record<string, number> = {};

    const costLines: HarnessCostLine[] = [];
    const inputRefs: HarnessInputRef[] = [];

    for (const event of input.events) {
       const rate = input.globalHourlyRateOverride ?? event.hourlyRate;
       const value = (event.activeMinutes / 60) * rate;
       const amount = Math.round(value * 100) / 100;
       
       totalDurationMinutes += event.durationMinutes;
       totalActiveMinutes += event.activeMinutes;
       totalIdleMinutes += event.idleMinutes;
       totalValue += amount;

       if (event.projectId) {
         valueByProject[event.projectId] = (valueByProject[event.projectId] || 0) + amount;
       }

       costLines.push({
         id: `cost_${event.id}`,
         userId: ctx.userId,
         amount,
         currency: 'USD',
         category: event.category,
         costType: 'time_value',
         sourceDomain: this.domain,
         projectId: event.projectId,
         releaseId: event.releaseId,
         tourId: event.tourId,
         activityEventId: event.id,
         taxTreatment: 'artist_labor_value_tracking',
         reimbursable: false,
         confidence: event.source === 'manual' ? 'high' : 'medium',
         notes: event.notes ?? `${event.activeMinutes} active minutes valued at $${rate}/hr. This is business investment value, not revenue.`,
         createdAt: new Date().toISOString()
       });

       inputRefs.push({
         type: 'manual',
         id: event.id,
         label: `Activity Event: ${event.eventType} (${event.activeMinutes}m in ${event.module || 'unknown module'})`
       });
    }

    const activeRatio = totalDurationMinutes > 0 ? (totalActiveMinutes / totalDurationMinutes) * 100 : 0;
    const scores: HarnessScore[] = [
      {
        label: 'Active Time Ratio',
        value: Math.round(activeRatio * 10) / 10,
        max: 100,
        status: totalDurationMinutes === 0 ? 'watch' : (activeRatio > 50 ? 'good' : 'watch'),
        rationale: 'Measures the proportion of tracked time that was active vs idle.'
      }
    ];

    totalValue = Math.round(totalValue * 100) / 100;

    return createHarnessRun<ActivityTimeValueOutput>({
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      domain: this.domain,
      inputRefs,
      scores,
      findings: [],
      recommendations: [],
      costLines,
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs: [
        {
          agentId: 'finance',
          departmentId: 'finance',
          brief: `Compiled time-value for ${input.events.length} activities. Total active time: ${totalActiveMinutes} minutes. Total value: $${totalValue}. Remember: Time value is internal investment tracking, NEVER treated as cash revenue.`,
          inputs: input.events.map(e => e.id)
        }
      ],
      approvalGates: [],
      assumptions: [
        'Time value represents labor investment and opportunity cost, not realized revenue or cash flow.',
        'Idle time is excluded from value calculations.'
      ],
      confidence: input.events.some(e => e.source === 'manual') ? 0.9 : 0.8,
      output: {
        totalDurationMinutes,
        totalActiveMinutes,
        totalIdleMinutes,
        totalValue,
        valueByProject
      }
    });
  }
}
