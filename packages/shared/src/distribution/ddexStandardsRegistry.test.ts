import { describe, expect, it } from 'vitest';
import {
  DDEX_ALLOWED_VALUE_SET_VERSION,
  DDEX_ECM_AVS_NAMES,
  DDEX_STANDARD_REGISTRY,
  getCurrentDDEXStandard,
} from './ddexStandardsRegistry';

describe('DDEX standards registry',()=>{
  it('pins AVS 012 for the Phase 2 registry',()=>{
    expect(DDEX_ALLOWED_VALUE_SET_VERSION).toBe('012');
  });

  it('registers ECM as JSON and ERN as XML',()=>{
    expect(getCurrentDDEXStandard('ECM_C')?.serialization).toBe('JSON');
    expect(getCurrentDDEXStandard('ECM_MW')?.serialization).toBe('JSON');
    expect(getCurrentDDEXStandard('ECM_ISRC')?.serialization).toBe('JSON');
    expect(getCurrentDDEXStandard('ERN')?.serialization).toBe('XML');
  });

  it('registers the ECM-specific AVS introduced in AVS 012',()=>{
    expect(DDEX_ECM_AVS_NAMES).toEqual([
      'ClusterMembershipType',
      'EcmFileStatus',
      'EcmMessageType',
      'EcmProposedActionType',
      'LinkVerification',
    ]);
  });

  it('keeps only one current entry per registered family in the seed',()=>{
    const current=DDEX_STANDARD_REGISTRY.filter(item=>item.current);
    const families=current.map(item=>item.family);
    expect(new Set(families).size).toBe(families.length);
  });
});
