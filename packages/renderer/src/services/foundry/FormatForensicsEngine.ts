import {
  FormatForensicsReport,
  ColumnForensics,
  ContainerType,
  DelimiterType,
  InferredFieldSemantic
} from '@indii/shared';

export class FormatForensicsEngine {
  /**
   * Run full deterministic forensics inspection across raw file content
   */
  static analyze(evidenceItemId: string, rawContent: string): FormatForensicsReport {
    const hasBom = rawContent.charCodeAt(0) === 0xfeff;
    const cleanContent = hasBom ? rawContent.slice(1) : rawContent;

    // 1. Line ending detection
    let lineEnding: 'lf' | 'crlf' | 'cr' = 'lf';
    if (cleanContent.includes('\r\n')) lineEnding = 'crlf';
    else if (cleanContent.includes('\r')) lineEnding = 'cr';

    const rawLines = cleanContent.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
    const totalRowsObserved = rawLines.length;

    // 2. Container and encoding detection
    let container: ContainerType = 'flat_delimited';
    const trimmedStart = cleanContent.trimStart();
    if (trimmedStart.startsWith('<?xml') || trimmedStart.startsWith('<')) {
      container = 'structured_xml';
    } else if (trimmedStart.startsWith('{') || trimmedStart.startsWith('[')) {
      container = 'structured_json';
    }

    const identifiedSignatures: string[] = [];
    if (hasBom) identifiedSignatures.push('UTF-8-BOM');
    if (container === 'structured_xml') identifiedSignatures.push('XML-DECLARATION');

    // If XML or JSON, handle container-level reporting
    if (container !== 'flat_delimited') {
      return {
        evidenceItemId,
        container,
        encoding: 'utf-8',
        hasBom,
        lineEnding,
        totalRowsObserved,
        columnCount: 0,
        columns: [],
        identifiedSignatures,
        detectedFormatFamily: container,
        forensicsConfidence: 0.95,
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Delimiter detection via variance & uniformity
    const delimiter = this.detectDelimiter(rawLines.slice(0, 20));
    const delimChar = this.getDelimiterChar(delimiter);

    // 4. Header and data rows
    const headerRowIndex = 0;
    const dataStartRowIndex = 1;

    const rawHeaders = (rawLines[0] || '').split(delimChar).map((h) => h.trim());
    const dataSampleLines = rawLines.slice(1, 20).map((line) => line.split(delimChar).map((v) => v.trim()));

    // 5. Analyze each column
    const columns: ColumnForensics[] = rawHeaders.map((rawHeader, idx) => {
      const normalizedHeader = rawHeader.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const sampleValues = dataSampleLines.map((row) => row[idx] || '').filter((v) => v.length > 0);
      const emptyCount = dataSampleLines.length - sampleValues.length;
      const uniqueCount = new Set(sampleValues).size;
      const isNullable = emptyCount > 0;

      const { semantic, confidence } = this.inferSemantic(normalizedHeader, sampleValues);

      return {
        index: idx,
        rawHeader,
        normalizedHeader,
        inferredSemantic: semantic,
        confidence,
        sampleValues: sampleValues.slice(0, 5),
        emptyCount,
        uniqueCount,
        isNullable,
      };
    });

    // 6. Detect format family (e.g. DistroKid, TuneCore, CDBaby, Generic)
    const { family, version } = this.detectFormatFamily(columns, delimiter);

    const averageColConfidence = columns.length > 0
      ? columns.reduce((acc, c) => acc + c.confidence, 0) / columns.length
      : 0.5;

    return {
      evidenceItemId,
      container: 'flat_delimited',
      encoding: 'utf-8',
      hasBom,
      lineEnding,
      delimiter,
      headerRowIndex,
      dataStartRowIndex,
      totalRowsObserved,
      columnCount: columns.length,
      columns,
      identifiedSignatures,
      detectedFormatFamily: family,
      detectedVersion: version,
      forensicsConfidence: Math.round(averageColConfidence * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Pick delimiter with highest column consistency across sampled rows
   */
  private static detectDelimiter(sampleLines: string[]): DelimiterType {
    const candidates: Array<{ type: DelimiterType; char: string }> = [
      { type: 'tab', char: '\t' },
      { type: 'comma', char: ',' },
      { type: 'semicolon', char: ';' },
      { type: 'pipe', char: '|' },
    ];

    let bestDelimiter: DelimiterType = 'tab';
    let bestScore = -1;

    for (const cand of candidates) {
      if (sampleLines.length === 0) continue;
      const counts = sampleLines.map((l) => l.split(cand.char).length);
      const firstCount = counts[0] || 0;

      if (firstCount <= 1) continue; // No split

      // Uniformity check: do all sample rows have the same number of columns?
      const isUniform = counts.every((c) => c === firstCount);
      const score = (firstCount * 10) + (isUniform ? 50 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = cand.type;
      }
    }

    return bestDelimiter;
  }

  private static getDelimiterChar(type?: DelimiterType): string {
    switch (type) {
      case 'tab': return '\t';
      case 'comma': return ',';
      case 'semicolon': return ';';
      case 'pipe': return '|';
      default: return '\t';
    }
  }

  /**
   * Infer semantic field type using column header tokens and sample data patterns
   */
  private static inferSemantic(header: string, sampleValues: string[]): { semantic: InferredFieldSemantic; confidence: number } {
    const isrcRegex = /^[A-Z]{2}-?[A-Z0-9]{3}-?[0-9]{2}-?[0-9]{5}$/i;
    const upcRegex = /^\d{12,14}$/;
    const isoDateRegex = /^\d{4}-\d{2}(-\d{2})?$/;
    const numericRegex = /^-?\$?\d+(\.\d+)?$/;

    // Check ISRC
    if (header.includes('isrc') || sampleValues.some((v) => isrcRegex.test(v))) {
      const matchCount = sampleValues.filter((v) => isrcRegex.test(v)).length;
      return { semantic: 'isrc', confidence: sampleValues.length > 0 ? matchCount / sampleValues.length : 0.9 };
    }

    // Check UPC / EAN
    if (header.includes('upc') || header.includes('ean') || header.includes('icpn') || sampleValues.some((v) => upcRegex.test(v))) {
      return { semantic: 'upc', confidence: 0.95 };
    }

    // Check Currency & Earnings
    if (header.includes('earning') || header.includes('revenue') || header.includes('total_earned') || header.includes('subtotal') || header.includes('usd') || header.includes('amount')) {
      return { semantic: 'currency_amount', confidence: 0.92 };
    }

    // Check Fees
    if (header.includes('fee') || header.includes('withholding') || header.includes('tax')) {
      return { semantic: 'fee_amount', confidence: 0.88 };
    }

    // Check Streams & Downloads
    if (header.includes('quantity') || header.includes('units') || header.includes('stream') || header.includes('plays')) {
      return { semantic: 'quantity_count', confidence: 0.9 };
    }

    // Check Dates
    if (header.includes('date') || header.includes('period') || header.includes('month') || sampleValues.some((v) => isoDateRegex.test(v))) {
      return { semantic: 'iso_date', confidence: 0.85 };
    }

    // Check Country / Territory
    if (header.includes('country') || header.includes('territory') || sampleValues.every((v) => /^[A-Z]{2}$/i.test(v))) {
      return { semantic: 'territory_code', confidence: 0.9 };
    }

    // Check DSP / Store
    if (header.includes('store') || header.includes('dsp') || header.includes('service') || header.includes('partner') || header.includes('platform')) {
      return { semantic: 'dsp_name', confidence: 0.9 };
    }

    // Check Song / Track Title
    if (header === 'title' || header === 'song_title' || header === 'track_title' || header === 'song') {
      return { semantic: 'track_title', confidence: 0.95 };
    }

    // Check Artist Name
    if (header.includes('artist') || header.includes('performer')) {
      return { semantic: 'artist_name', confidence: 0.95 };
    }

    // Fallback: numeric vs text
    if (sampleValues.length > 0 && sampleValues.every((v) => numericRegex.test(v))) {
      return { semantic: 'generic_number', confidence: 0.7 };
    }

    return { semantic: 'generic_text', confidence: 0.5 };
  }

  /**
   * Identify known distributor format family based on column signature
   */
  private static detectFormatFamily(columns: ColumnForensics[], delimiter: DelimiterType): { family: string; version: string } {
    const normHeaders = columns.map((c) => c.normalizedHeader);

    // DistroKid Signature: Reporting Date, Sale Month, Store, Artist, Title, ISRC, UPC, Quantity, Earnings (USD)
    if (delimiter === 'tab' && normHeaders.includes('reporting_date') && normHeaders.includes('sale_month') && normHeaders.includes('store') && normHeaders.includes('earnings_usd')) {
      return { family: 'distrokid_statement', version: '2026.1' };
    }

    // TuneCore Signature: Sales Period, Posted Date, Store Name, Country Of Sale, Artist, Release Title, Song Title, ISRC, UPC, Quantity, Total Earned
    if (normHeaders.includes('sales_period') && normHeaders.includes('posted_date') && normHeaders.includes('store_name') && normHeaders.includes('total_earned')) {
      return { family: 'tunecore_statement', version: '2026.1' };
    }

    // Generic Delimited Sales Statement
    if (normHeaders.some((h) => h.includes('isrc')) && normHeaders.some((h) => h.includes('earning') || h.includes('revenue') || h.includes('total'))) {
      return { family: 'generic_sales_statement', version: '1.0' };
    }

    return { family: 'unrecognized_tabular', version: 'unknown' };
  }
}
