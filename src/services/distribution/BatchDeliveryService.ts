import path from 'path';
import { DDEX_CONFIG } from '@/core/config/ddex';

/**
 * BatchDeliveryService
 *
 * Handles the grouping of multiple release packages into a single "Batch"
 * for efficient SFTP delivery. This corresponds to the "Choreography"
 * requirement in Step 3 of the roadmap.
 */

export interface BatchManifest {
  batchId: string;
  messageSender: string; // DPID
  messageRecipient: string; // DPID
  releaseCount: number;
  createdDateTime: string;
}

export class BatchDeliveryService {

  /**
   * Generate a Batch Complete Manifest (XML)
   * This file (BatchComplete_XXX.xml) tells the DSP that a batch upload is finished.
   */
  static generateBatchManifest(manifest: BatchManifest): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ern:BatchCompleteMessage xmlns:ern="http://ddex.net/xml/ern/43" MessageSchemaVersionId="4.3">
  <MessageHeader>
    <MessageThreadId>${manifest.batchId}</MessageThreadId>
    <MessageSender>
      <PartyId>${manifest.messageSender}</PartyId>
    </MessageSender>
    <MessageRecipient>
      <PartyId>${manifest.messageRecipient}</PartyId>
    </MessageRecipient>
    <MessageCreatedDateTime>${manifest.createdDateTime}</MessageCreatedDateTime>
  </MessageHeader>
  <BatchDetail>
    <BatchId>${manifest.batchId}</BatchId>
    <NumberOfReleasesInBatch>${manifest.releaseCount}</NumberOfReleasesInBatch>
  </BatchDetail>
</ern:BatchCompleteMessage>`;
  }

  /**
   * Structure a batch directory.
   * Moves individual release packages into a structured batch folder.
   *
   * Structure:
   * /Batch_20240101_001/
   *   /Release_UPC1/
   *     ern.xml
   *     /resources/
   *   /Release_UPC2/
   *     ern.xml
   *     /resources/
   *   BatchComplete_20240101_001.xml
   */
  static async createBatchDirectory(
    batchId: string,
    releasePackages: string[], // Paths to individual release folders
    outputDir: string
  ): Promise<string> {
    // Dynamic import fs
    const fs = await import('fs');

    const batchDir = path.join(outputDir, `Batch_${batchId}`);
    if (!fs.existsSync(batchDir)) {
      await fs.promises.mkdir(batchDir, { recursive: true });
    }

    // Move Releases
    for (const releasePath of releasePackages) {
      const folderName = path.basename(releasePath);
      const destPath = path.join(batchDir, folderName);
      await fs.promises.rename(releasePath, destPath);
    }

    // Generate Manifest
    const manifestXml = this.generateBatchManifest({
      batchId,
      messageSender: DDEX_CONFIG.PARTY_ID,
      messageRecipient: 'PADPIDA_RECIPIENT_MOCK', // Recipient should be dynamic in real use
      releaseCount: releasePackages.length,
      createdDateTime: new Date().toISOString()
    });

    await fs.promises.writeFile(
      path.join(batchDir, `BatchComplete_${batchId}.xml`),
      manifestXml
    );

    return batchDir;
  }
}
