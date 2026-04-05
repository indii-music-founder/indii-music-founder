import type { OrgAdapter, OrgId } from '../types';
import { LocAdapter } from './LocAdapter';
import { AscapAdapter } from './AscapAdapter';
import { BmiAdapter } from './BmiAdapter';
import { SesacAdapter } from './SesacAdapter';
import { SoundExchangeAdapter } from './SoundExchangeAdapter';
import { MlcAdapter } from './MlcAdapter';

export const ORG_ADAPTERS: Record<OrgId, OrgAdapter> = {
  loc: LocAdapter,
  ascap: AscapAdapter,
  bmi: BmiAdapter,
  sesac: SesacAdapter,
  soundexchange: SoundExchangeAdapter,
  mlc: MlcAdapter,
};

export function getAdapter(orgId: OrgId): OrgAdapter {
  return ORG_ADAPTERS[orgId];
}

export { LocAdapter, AscapAdapter, BmiAdapter, SesacAdapter, SoundExchangeAdapter, MlcAdapter };
