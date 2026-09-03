import {
  FormatHypothesis,
  HypothesisLedgerState,
  FormatForensicsReport
} from './types.js';

export class HypothesisLedger {
  private formatId: string;
  private formatName: string;
  private version: string;
  private hypotheses: Map<string, FormatHypothesis> = new Map();

  constructor(formatId: string, formatName: string, version: string = '1.0') {
    this.formatId = formatId;
    this.formatName = formatName;
    this.version = version;
  }

  /**
   * Automatically generate initial hypotheses from a forensics report
   */
  static fromForensics(report: FormatForensicsReport, formatName: string): HypothesisLedger {
    const ledger = new HypothesisLedger(report.detectedFormatFamily, formatName, report.detectedVersion || '1.0');

    // Rule 1: Delimiter rule
    if (report.delimiter) {
      ledger.addHypothesis({
        category: 'delimiter_and_encoding',
        ruleStatement: `Format uses ${report.delimiter} delimiter with ${report.encoding} encoding.`,
        supportingEvidenceIds: [report.evidenceItemId],
        contradictoryEvidenceIds: [],
        confidence: report.hasBom ? 0.99 : 0.95,
        status: 'proven',
        applicableVersions: [report.detectedVersion || '1.0'],
        knownExceptions: [],
        dependentAdapterSymbols: ['detectDelimiter', 'splitColumns'],
      });
    }

    // Rule 2: Column mapping rules
    for (const col of report.columns) {
      if (col.inferredSemantic !== 'generic_text' && col.inferredSemantic !== 'generic_number') {
        ledger.addHypothesis({
          category: 'header_mapping',
          ruleStatement: `Column "${col.rawHeader}" maps to semantic field "${col.inferredSemantic}".`,
          supportingEvidenceIds: [report.evidenceItemId],
          contradictoryEvidenceIds: [],
          confidence: col.confidence,
          status: col.confidence >= 0.85 ? 'proven' : 'tentative',
          applicableVersions: [report.detectedVersion || '1.0'],
          knownExceptions: [],
          dependentAdapterSymbols: [`map_${col.normalizedHeader}`],
        });
      }
    }

    // Rule 3: Economic math rule
    const hasEarnings = report.columns.some((c) => c.inferredSemantic === 'currency_amount');
    const hasFees = report.columns.some((c) => c.inferredSemantic === 'fee_amount');

    if (hasEarnings && !hasFees) {
      ledger.addHypothesis({
        category: 'revenue_math',
        ruleStatement: 'Reported earnings represent net revenue received directly without external fee breakdown.',
        supportingEvidenceIds: [report.evidenceItemId],
        contradictoryEvidenceIds: [],
        confidence: 0.9,
        status: 'proven',
        applicableVersions: [report.detectedVersion || '1.0'],
        knownExceptions: [],
        dependentAdapterSymbols: ['calculateNetRevenue'],
      });
    } else if (hasEarnings && hasFees) {
      ledger.addHypothesis({
        category: 'revenue_math',
        ruleStatement: 'Reported gross revenue minus fees balances to net revenue within $0.01 tolerance.',
        supportingEvidenceIds: [report.evidenceItemId],
        contradictoryEvidenceIds: [],
        confidence: 0.85,
        status: 'tentative',
        applicableVersions: [report.detectedVersion || '1.0'],
        knownExceptions: [],
        dependentAdapterSymbols: ['calculateGrossNetBalance'],
      });
    } else {
      // Explicit UNKNOWN rule rather than guessing
      ledger.addHypothesis({
        category: 'revenue_math',
        ruleStatement: 'Revenue calculation formula is unknown; no currency column confirmed.',
        supportingEvidenceIds: [],
        contradictoryEvidenceIds: [],
        confidence: 0.0,
        status: 'unknown',
        applicableVersions: [report.detectedVersion || '1.0'],
        knownExceptions: [],
        dependentAdapterSymbols: [],
      });
    }

    return ledger;
  }

  addHypothesis(rule: Omit<FormatHypothesis, 'id'>): FormatHypothesis {
    const id = `hyp-${Date.now()}-${this.hypotheses.size + 1}`;
    const hypothesis: FormatHypothesis = {
      ...rule,
      id,
      verifiedAt: rule.status === 'proven' ? new Date().toISOString() : undefined,
    };
    this.hypotheses.set(id, hypothesis);
    return hypothesis;
  }

  recordEvidence(hypothesisId: string, evidenceId: string, supports: boolean): void {
    const hyp = this.hypotheses.get(hypothesisId);
    if (!hyp) return;

    if (supports) {
      if (!hyp.supportingEvidenceIds.includes(evidenceId)) {
        hyp.supportingEvidenceIds.push(evidenceId);
      }
      hyp.confidence = Math.min(1.0, hyp.confidence + 0.1);
      if (hyp.confidence >= 0.8) hyp.status = 'proven';
    } else {
      if (!hyp.contradictoryEvidenceIds.includes(evidenceId)) {
        hyp.contradictoryEvidenceIds.push(evidenceId);
      }
      hyp.confidence = Math.max(0.0, hyp.confidence - 0.25);
      if (hyp.confidence < 0.5) hyp.status = 'disproven';
    }
  }

  getState(): HypothesisLedgerState {
    const list = Array.from(this.hypotheses.values());
    const proven = list.filter((h) => h.status === 'proven').length;
    const unknown = list.filter((h) => h.status === 'unknown').length;
    const totalConfidence = list.reduce((sum, h) => sum + h.confidence, 0);
    const avgConfidence = list.length > 0 ? totalConfidence / list.length : 0.0;

    return {
      formatId: this.formatId,
      formatName: this.formatName,
      version: this.version,
      hypotheses: list,
      aggregateConfidence: Math.round(avgConfidence * 100) / 100,
      provenRulesCount: proven,
      unknownRulesCount: unknown,
      lastUpdated: new Date().toISOString(),
    };
  }
}
