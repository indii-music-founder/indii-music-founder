import { FormatForensicsEngine } from '@/services/foundry/FormatForensicsEngine';
import { HypothesisLedger } from '@/services/foundry/HypothesisLedger';
import { AdapterConstructor } from '@/services/foundry/AdapterConstructor';
import { LayeredValidator } from '@/services/foundry/LayeredValidator';
import { ArtistBusinessGraphNormalizer } from '@/services/foundry/ArtistBusinessGraphNormalizer';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

export const FormatFoundryTools = {
  /**
   * Run format forensics inspection on arbitrary file content
   */
  foundry_inspect_format: async ({
    evidenceId,
    content,
  }: {
    evidenceId: string;
    content: string;
  }) => {
    try {
      const report = FormatForensicsEngine.analyze(evidenceId, content);
      return {
        success: true,
        report,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Synthesize hypothesis ledger for an inspected format
   */
  foundry_synthesize_hypotheses: async ({
    evidenceId,
    content,
    formatName,
  }: {
    evidenceId: string;
    content: string;
    formatName?: string;
  }) => {
    try {
      const forensics = FormatForensicsEngine.analyze(evidenceId, content);
      const ledger = HypothesisLedger.fromForensics(forensics, formatName || forensics.detectedFormatFamily);
      return {
        success: true,
        ledger: ledger.getState(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Deterministically parse statement and run 7-stage layered validation
   */
  foundry_parse_and_validate: async ({
    content,
    formatId,
  }: {
    content: string;
    formatId?: string;
  }) => {
    try {
      const adapter = AdapterConstructor.resolveAdapter(content, formatId);
      if (!adapter) {
        return {
          success: false,
          error: 'No compatible adapter found for the provided format content.',
        };
      }

      const report = adapter.parse(content);
      const validation = await LayeredValidator.validate(content, report);

      return {
        success: true,
        formatId: adapter.formatId,
        report,
        validation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Normalize parsed statement transactions into canonical Artist Business Graph
   */
  foundry_normalize_to_graph: async ({
    content,
    catalogMap,
  }: {
    content: string;
    catalogMap: Record<string, ExtendedGoldenMetadata>;
  }) => {
    try {
      const adapter = AdapterConstructor.resolveAdapter(content);
      if (!adapter) {
        return {
          success: false,
          error: 'No compatible adapter found for the provided format content.',
        };
      }

      const report = adapter.parse(content);
      const catalog = new Map<string, ExtendedGoldenMetadata>(Object.entries(catalogMap));
      const graph = ArtistBusinessGraphNormalizer.normalizeToGraph(report, catalog);

      return {
        success: true,
        report,
        graph,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
