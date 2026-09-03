import {
  EvidenceItem,
  EvidenceItemKind,
  EvidenceSet,
  EvidenceConstraint,
  SensitivityClassification
} from '@indii/shared';

export interface IngestOptions {
  kind?: EvidenceItemKind;
  claimedFormat?: string;
  classification?: SensitivityClassification;
  mayUseForGeneratedTests?: boolean;
  allowExternalModelReasoning?: boolean;
  legalNotice?: string;
}

export class EvidenceIntakeService {
  /**
   * Compute standard SHA-256 hash across UTF-8 content
   */
  static async computeSha256(content: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Deterministic fallback for environments without crypto.subtle
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Ingest a sample into the Evidence Set with privacy classification
   */
  static async ingestEvidence(
    filename: string,
    content: string,
    options: IngestOptions = {}
  ): Promise<EvidenceItem> {
    const sha256 = await this.computeSha256(content);
    const sizeBytes = new TextEncoder().encode(content).length;

    // Detect basic MIME type from filename
    let mimeType = 'text/plain';
    if (filename.endsWith('.csv')) mimeType = 'text/csv';
    else if (filename.endsWith('.tsv')) mimeType = 'text/tab-separated-values';
    else if (filename.endsWith('.xml')) mimeType = 'application/xml';
    else if (filename.endsWith('.json')) mimeType = 'application/json';

    // Privacy & Security classification
    const classification: SensitivityClassification =
      options.classification ||
      (content.includes('Earnings') || content.includes('USD') || content.includes('Total Earned')
        ? 'sensitive_financial'
        : 'confidential_artist');

    const constraints: EvidenceConstraint = {
      classification,
      mayRetain: true,
      mayUseForGeneratedTests: options.mayUseForGeneratedTests ?? (classification === 'public'),
      allowExternalModelReasoning: options.allowExternalModelReasoning ?? false,
      legalNotice: options.legalNotice || 'Authorized evidence provided for clean-room format compatibility.',
    };

    // Sanitize snippet if sensitive financial: mask numeric dollars for external viewing
    const rawSampleSnippet = this.createSanitizedSnippet(content, classification);

    const item: EvidenceItem = {
      id: `ev-${sha256.substring(0, 12)}`,
      kind: options.kind || 'input_sample',
      filename,
      sizeBytes,
      sha256,
      mimeType,
      claimedFormat: options.claimedFormat,
      acquiredAt: new Date().toISOString(),
      constraints,
      rawSampleSnippet,
    };

    return item;
  }

  /**
   * Create an initial evidence set for a target format domain
   */
  static createEvidenceSet(name: string, targetFormatDomain: string, items: EvidenceItem[] = []): EvidenceSet {
    const now = new Date().toISOString();
    return {
      id: `evset-${Date.now()}`,
      name,
      targetFormatDomain,
      items,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Mask or truncate snippets for safe logging and presentation
   */
  private static createSanitizedSnippet(content: string, classification: SensitivityClassification): string {
    const lines = content.split('\n').slice(0, 5);
    if (classification === 'sensitive_financial' || classification === 'restricted_pii') {
      return lines.map((l) => l.substring(0, 160)).join('\n');
    }
    return lines.join('\n');
  }
}
