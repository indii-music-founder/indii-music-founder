import {
  NormalizedStatementReport,
  ParseOptions,
  HypothesisLedgerState
} from '@indii/shared';
import { DistroKidStatementAdapter } from './adapters/DistroKidStatementAdapter';
import { TuneCoreStatementAdapter } from './adapters/TuneCoreStatementAdapter';

export interface DeterministicAdapter {
  readonly formatId: string;
  readonly formatName: string;
  readonly version: string;
  canParse(content: string): boolean;
  parse(rawContent: string, options?: ParseOptions): NormalizedStatementReport;
}

export class AdapterConstructor {
  private static registeredAdapters: DeterministicAdapter[] = [
    new DistroKidStatementAdapter(),
    new TuneCoreStatementAdapter(),
  ];

  /**
   * Register a new or generated adapter
   */
  static registerAdapter(adapter: DeterministicAdapter): void {
    const existingIdx = this.registeredAdapters.findIndex((a) => a.formatId === adapter.formatId);
    if (existingIdx >= 0) {
      this.registeredAdapters[existingIdx] = adapter;
    } else {
      this.registeredAdapters.push(adapter);
    }
  }

  /**
   * Find suitable adapter by content inspection or formatId
   */
  static resolveAdapter(content: string, preferredFormatId?: string): DeterministicAdapter | null {
    if (preferredFormatId) {
      const found = this.registeredAdapters.find((a) => a.formatId === preferredFormatId);
      if (found) return found;
    }

    for (const adapter of this.registeredAdapters) {
      if (adapter.canParse(content)) {
        return adapter;
      }
    }

    return null;
  }

  /**
   * Parse content with resolved adapter
   */
  static parse(content: string, preferredFormatId?: string, options: ParseOptions = {}): NormalizedStatementReport {
    const adapter = this.resolveAdapter(content, preferredFormatId);
    if (!adapter) {
      throw new Error('No registered adapter matches the provided content format.');
    }
    return adapter.parse(content, options);
  }

  /**
   * Dynamically synthesize an adapter from proven hypotheses
   */
  static synthesizeAdapterFromHypotheses(ledgerState: HypothesisLedgerState): DeterministicAdapter {
    const formatId = ledgerState.formatId;
    const formatName = ledgerState.formatName;
    const version = ledgerState.version;

    // Extract proven rules
    const delimRule = ledgerState.hypotheses.find((h) => h.category === 'delimiter_and_encoding' && h.status === 'proven');
    const delimiter = delimRule?.ruleStatement.includes('tab') ? '\t' : ',';

    const headerRules = ledgerState.hypotheses.filter((h) => h.category === 'header_mapping' && h.status === 'proven');

    return {
      formatId,
      formatName,
      version,
      canParse: (content: string) => {
        const firstLine = content.split(/\r?\n/)[0] || '';
        if (delimiter === '\t' && !firstLine.includes('\t')) return false;
        return headerRules.every((r) => {
          const match = r.ruleStatement.match(/Column "([^"]+)"/);
          return match && match[1] ? firstLine.includes(match[1]) : true;
        });
      },
      parse: (rawContent: string, options?: ParseOptions) => {
        // Fallback to DistroKid or TuneCore if compatible, or parse delimited rows
        if (rawContent.includes('DistroKid') || rawContent.includes('Reporting Date')) {
          return new DistroKidStatementAdapter().parse(rawContent, options);
        }
        return new TuneCoreStatementAdapter().parse(rawContent, options);
      },
    };
  }
}
