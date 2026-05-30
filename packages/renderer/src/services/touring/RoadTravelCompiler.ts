import {
  HarnessCompiler,
  HarnessContext,
  HarnessRun,
  createHarnessRun,
  HarnessCostLine,
  HarnessFinding,
  HarnessAgentBrief,
  HarnessApprovalGate,
} from '@indii/shared';

export interface RoadTravelInput {
  eventName: string;
  tourId?: string;
  route: {
    origin: string;
    destination: string;
    mileage: number;
    driveTimeHours: number;
    crossesBorder: boolean;
  };
  expenses: {
    gas: number;
    lodging: number;
    perDiem: number;
    tolls: number;
    parking: number;
    insurance: number;
  };
  logistics: {
    crewSize: number;
    requiresBackline: boolean;
    rehearsalHours: number;
    loadInHours: number;
    loadOutHours: number;
  };
  visaRequired?: boolean;
  timeValueRate?: number; // Rate per hour for time value
}

export interface RoadTravelOutput {
  totalTravelCost: number;
  totalTimeValue: number;
  totalHours: number;
  borderWarnings: string[];
}

export class RoadTravelCompiler implements HarnessCompiler<RoadTravelInput, RoadTravelOutput> {
  readonly domain = 'road_travel';

  compile(input: RoadTravelInput, ctx: HarnessContext): HarnessRun<RoadTravelOutput> {
    const findings: HarnessFinding[] = [];
    const costLines: HarnessCostLine[] = [];
    const agentBriefs: HarnessAgentBrief[] = [];
    const approvalGates: HarnessApprovalGate[] = [];

    let totalTravelCost = 0;
    const { expenses, route, logistics } = input;

    // Helper to add cash expenses
    const addCashCost = (amount: number, category: string, detail: string) => {
      if (amount <= 0) return;
      totalTravelCost += amount;
      costLines.push({
        id: `cost_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
        userId: ctx.userId,
        amount,
        currency: 'USD',
        category,
        costType: 'cash_expense',
        sourceDomain: 'road_travel',
        tourId: input.tourId,
        reimbursable: false,
        confidence: 'high',
        notes: detail,
        createdAt: new Date().toISOString(),
      });
    };

    addCashCost(expenses.gas, 'Travel', `Gas for ${input.eventName}`);
    addCashCost(expenses.lodging, 'Lodging', `Lodging for ${input.eventName}`);
    addCashCost(expenses.perDiem, 'Meals & Entertainment', `Per Diem for crew of ${logistics.crewSize}`);
    addCashCost(expenses.tolls, 'Travel', `Tolls for ${route.origin} to ${route.destination}`);
    addCashCost(expenses.parking, 'Travel', `Parking for ${input.eventName}`);
    addCashCost(expenses.insurance, 'Insurance', `Travel/gig insurance for ${input.eventName}`);

    // Time value calculations
    const totalHours = route.driveTimeHours + logistics.rehearsalHours + logistics.loadInHours + logistics.loadOutHours;
    let totalTimeValue = 0;
    if (totalHours > 0 && input.timeValueRate) {
      totalTimeValue = totalHours * input.timeValueRate;
      costLines.push({
        id: `cost_time_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
        userId: ctx.userId,
        amount: totalTimeValue,
        currency: 'USD',
        category: 'Labor',
        costType: 'time_value',
        sourceDomain: 'road_travel',
        tourId: input.tourId,
        reimbursable: false,
        confidence: 'medium',
        notes: `Time value: ${totalHours} hrs @ $${input.timeValueRate}/hr`,
        createdAt: new Date().toISOString(),
      });
    }
    
    // Mileage calculation (IRS rate roughly ~$0.67/mile)
    if (route.mileage > 0) {
      const mileageAmount = route.mileage * 0.67;
      costLines.push({
        id: `cost_mileage_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
        userId: ctx.userId,
        amount: mileageAmount,
        currency: 'USD',
        category: 'Travel',
        costType: 'mileage',
        sourceDomain: 'road_travel',
        tourId: input.tourId,
        reimbursable: true,
        confidence: 'high',
        notes: `Mileage: ${route.mileage} miles`,
        createdAt: new Date().toISOString(),
      });
    }

    // Border and Visa constraints
    const borderWarnings: string[] = [];
    if (route.crossesBorder || input.visaRequired) {
      findings.push({
        id: `finding_border_${Date.now()}`,
        domain: 'road_travel',
        severity: 'high',
        title: 'International Border Crossing Detected',
        detail: `Travel from ${route.origin} to ${route.destination} requires border crossing. Visas or carnets may be required.`,
        confidence: 'high',
      });
      borderWarnings.push('Border crossing required. Check visa and customs rules.');
      
      agentBriefs.push({
        agentId: 'legal',
        departmentId: 'Legal',
        brief: `Review visa and work permit requirements for ${logistics.crewSize} crew members crossing border to ${route.destination}.`,
        inputs: ['route', 'crewSize', 'visaRequired'],
      });

      if (logistics.requiresBackline) {
        agentBriefs.push({
          agentId: 'finance',
          departmentId: 'Finance',
          brief: `Prepare customs carnet documentation for backline crossing border to ${route.destination}.`,
          inputs: ['route', 'requiresBackline'],
        });
      }

      approvalGates.push({
        id: `gate_visa_${Date.now()}`,
        label: 'Visa and Customs Clearance',
        reason: 'Required to ensure legal entry and prevent gig cancellation at the border.',
        requiredFor: 'tour_departure',
        riskTier: 'blocked',
      });
    }

    // Heavy load requirements
    if (logistics.crewSize > 5 || logistics.requiresBackline) {
      findings.push({
        id: `finding_logistics_${Date.now()}`,
        domain: 'road_travel',
        severity: 'medium',
        title: 'Heavy Logistics Footprint',
        detail: `Crew size of ${logistics.crewSize} and backline requirements suggest need for a dedicated transport vehicle or trailer.`,
        confidence: 'medium',
      });
    }

    // High Drive Time
    if (route.driveTimeHours > 8) {
      findings.push({
        id: `finding_drive_time_${Date.now()}`,
        domain: 'road_travel',
        severity: 'high',
        title: 'Excessive Drive Time',
        detail: `Drive time of ${route.driveTimeHours} hours exceeds safe driving limits for a single driver. Requires hotel layover or co-driver.`,
        confidence: 'high',
      });
      agentBriefs.push({
        agentId: 'touring',
        brief: `Evaluate split-drive or layover requirements for ${route.driveTimeHours} hour drive to ${route.destination}.`,
        inputs: ['route'],
      });
    }

    return createHarnessRun<RoadTravelOutput>({
      domain: this.domain,
      schemaVersion: 1,
      userId: ctx.userId,
      projectId: ctx.projectId,
      inputRefs: [{ type: 'manual', label: `Travel Run: ${input.eventName}` }],
      scores: [
        {
          label: 'Travel Readiness',
          value: approvalGates.length === 0 ? 100 : 50,
          max: 100,
          status: approvalGates.length > 0 ? 'blocked' : 'good',
          rationale: approvalGates.length > 0 ? 'Pending visa/customs approvals' : 'Clear to travel',
        }
      ],
      findings,
      recommendations: [],
      costLines,
      legalBasis: [],
      evidenceRefs: [],
      agentBriefs,
      approvalGates,
      assumptions: ['Standard IRS mileage rate of $0.67/mile assumed.'],
      confidence: 0.9,
      output: {
        totalTravelCost,
        totalTimeValue,
        totalHours,
        borderWarnings,
      },
    });
  }
}
