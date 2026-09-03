import {
  ExperimentDefinition,
  ExperimentResult,
  ExperimentMutation
} from './types.js';
import { FormatForensicsEngine } from './FormatForensicsEngine';

export class ControlledExperimentRunner {
  /**
   * Run a sandboxed mutation experiment against a baseline evidence sample
   */
  static runExperiment(
    definition: ExperimentDefinition,
    baselineContent: string
  ): ExperimentResult {
    const startTime = performance.now();
    const differences: string[] = [];
    const errors: string[] = [];

    // 1. Duplicate fixture before modification
    let mutatedContent = baselineContent;

    // 2. Apply controlled mutations sequentially
    for (const mutation of definition.mutations) {
      mutatedContent = this.applyMutation(mutatedContent, mutation, differences);
    }

    // 3. Inspect mutated content through deterministic forensics
    let invariantPreserved = true;
    let rowsProcessed = 0;
    let rowsMatched = 0;

    try {
      const baselineReport = FormatForensicsEngine.analyze('baseline', baselineContent);
      const mutatedReport = FormatForensicsEngine.analyze('mutated', mutatedContent);

      rowsProcessed = mutatedReport.totalRowsObserved;

      // Invariant check: e.g. column count preservation, or semantic continuity
      if (definition.expectedInvariant === 'column_count_preserved') {
        if (mutatedReport.columnCount !== baselineReport.columnCount) {
          invariantPreserved = false;
          differences.push(`Column count changed from ${baselineReport.columnCount} to ${mutatedReport.columnCount}`);
        }
      } else if (definition.expectedInvariant === 'detected_format_preserved') {
        if (mutatedReport.detectedFormatFamily !== baselineReport.detectedFormatFamily) {
          invariantPreserved = false;
          differences.push(`Detected family changed from ${baselineReport.detectedFormatFamily} to ${mutatedReport.detectedFormatFamily}`);
        }
      } else if (definition.expectedInvariant === 'isrc_semantic_preserved') {
        const hasIsrc = mutatedReport.columns.some((c) => c.inferredSemantic === 'isrc');
        if (!hasIsrc) {
          invariantPreserved = false;
          differences.push('ISRC semantic was lost under mutation');
        }
      }

      rowsMatched = invariantPreserved ? rowsProcessed : 0;
    } catch (err) {
      invariantPreserved = false;
      errors.push(err instanceof Error ? err.message : String(err));
    }

    const duration = performance.now() - startTime;

    return {
      id: `exp-res-${Date.now()}`,
      experimentId: definition.id,
      success: errors.length === 0,
      executionDurationMs: Math.round(duration * 100) / 100,
      exitCode: errors.length === 0 ? 0 : 1,
      rowsProcessed,
      rowsMatched,
      invariantPreserved,
      differenceSummary: differences,
      observedErrors: errors,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Apply a single mutation to source text
   */
  private static applyMutation(content: string, mutation: ExperimentMutation, diffs: string[]): string {
    switch (mutation.type) {
      case 'change_delimiter': {
        const fromChar = mutation.originalValue || '\t';
        const toChar = mutation.mutatedValue || ',';
        diffs.push(`Replaced delimiter '${fromChar}' with '${toChar}'`);
        return content.split('\n').map((line) => line.split(fromChar).join(toChar)).join('\n');
      }

      case 'alter_column_casing': {
        const lines = content.split('\n');
        if (lines.length > 0) {
          lines[0] = lines[0]!.toUpperCase();
          diffs.push('Uppercased header row');
        }
        return lines.join('\n');
      }

      case 'inject_empty_rows': {
        const lines = content.split('\n');
        const withBlanks = [lines[0]!, '', lines[1]!, '   ', ...lines.slice(2)];
        diffs.push('Injected blank whitespace lines');
        return withBlanks.join('\n');
      }

      case 'remove_optional_column': {
        // Drop last column
        const lines = content.split('\n');
        const delim = lines[0]?.includes('\t') ? '\t' : ',';
        const modified = lines.map((l) => {
          const parts = l.split(delim);
          return parts.slice(0, -1).join(delim);
        });
        diffs.push('Dropped trailing optional column');
        return modified.join('\n');
      }

      default:
        return content;
    }
  }
}
