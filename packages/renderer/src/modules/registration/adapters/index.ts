import type { OrgAdapter, OrgId } from '@/modules/registration/types';
import { LocAdapter } from '@/modules/registration/adapters/LocAdapter';
import { AscapAdapter } from '@/modules/registration/adapters/AscapAdapter';
import { BmiAdapter } from '@/modules/registration/adapters/BmiAdapter';
import { SesacAdapter } from '@/modules/registration/adapters/SesacAdapter';
import { SoundExchangeAdapter } from '@/modules/registration/adapters/SoundExchangeAdapter';
import { MlcAdapter } from '@/modules/registration/adapters/MlcAdapter';

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
