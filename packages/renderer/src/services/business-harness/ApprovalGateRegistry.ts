import type { HarnessApprovalGate } from './types';

export type IrreversibleAction =
  | 'deliver to DSP'
  | 'send legal notice'
  | 'file registration'
  | 'spend money'
  | 'publish publicly'
  | 'place POD order'
  | 'run paid ads'
  | 'enable biometric monitoring'
  | 'destructive data changes';

export interface IrreversibleActionDefinition {
  action: IrreversibleAction;
  riskTier: HarnessApprovalGate['riskTier'];
  defaultReason: string;
}

export const APPROVAL_GATE_REGISTRY: Record<IrreversibleAction, IrreversibleActionDefinition> = {
  'deliver to DSP': {
    action: 'deliver to DSP',
    riskTier: 'approval',
    defaultReason: 'Delivery to digital storefronts is a public irreversible action.',
  },
  'send legal notice': {
    action: 'send legal notice',
    riskTier: 'attorney_review',
    defaultReason: 'Legal notices expose the artist to liability and require attorney review.',
  },
  'file registration': {
    action: 'file registration',
    riskTier: 'approval',
    defaultReason: 'Filing copyright or rights registrations are binding legal actions.',
  },
  'spend money': {
    action: 'spend money',
    riskTier: 'approval',
    defaultReason: 'Financial expenditure requires explicit sign-off.',
  },
  'publish publicly': {
    action: 'publish publicly',
    riskTier: 'approval',
    defaultReason: 'Publishing materials publicly affects artist brand and rights.',
  },
  'place POD order': {
    action: 'place POD order',
    riskTier: 'approval',
    defaultReason: 'Manufacturing physical goods incurs real-world costs.',
  },
  'run paid ads': {
    action: 'run paid ads',
    riskTier: 'approval',
    defaultReason: 'Ad campaigns draw from active budgets and require approval.',
  },
  'enable biometric monitoring': {
    action: 'enable biometric monitoring',
    riskTier: 'approval',
    defaultReason: 'Biometric tracking is highly sensitive and requires explicit consent.',
  },
  'destructive data changes': {
    action: 'destructive data changes',
    riskTier: 'destructive',
    defaultReason: 'Deleting data cannot be undone.',
  },
};

export function getApprovalGateDefinition(action: IrreversibleAction): IrreversibleActionDefinition {
  return APPROVAL_GATE_REGISTRY[action];
}
