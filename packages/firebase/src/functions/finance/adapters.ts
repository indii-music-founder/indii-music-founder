import { DistroKidStatementAdapter as DKAdapter } from '@indii/shared/dist/foundry/adapters/DistroKidStatementAdapter.js';
import { TuneCoreStatementAdapter as TCAdapter } from '@indii/shared/dist/foundry/adapters/TuneCoreStatementAdapter.js';
import type { NormalizedStatementReport } from '../../../../shared/src/foundry/types';

/** Wrapper exposing static canParse/parse methods expected by the Firebase function. */
export class DistroKidStatementAdapter {
  static canParse(line: string): boolean {
    return DKAdapter.canParse(line);
  }

  static parse(content: string): NormalizedStatementReport {
    const raw = new DKAdapter().parse(content);
    return mapToPublic(raw);
  }
}

export class TuneCoreStatementAdapter {
  static canParse(line: string): boolean {
    return TCAdapter.canParse(line);
  }

  static parse(content: string): NormalizedStatementReport {
    const raw = new TCAdapter().parse(content);
    return mapToPublic(raw);
  }
}

function mapToPublic(raw: NormalizedStatementReport): NormalizedStatementReport {
  return { ...raw };
}
