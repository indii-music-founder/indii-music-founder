import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { executeVideoJob, type VideoGenerationJobRecord } from './gateway';

export const videoJobOrchestrator = onDocumentWritten(
  {
    document: 'creative_jobs/{jobId}',
    region: 'us-central1',
    memory: '512MiB',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.info('[videoJobOrchestrator] No snapshot data associated with event.');
      return;
    }

    const after = snapshot.after.data() as VideoGenerationJobRecord | undefined;
    if (!after) {
      logger.info(`[videoJobOrchestrator] Job ${event.params.jobId} was deleted.`);
      return;
    }

    if (after.type !== 'video' || after.status !== 'queued') {
      return;
    }

    logger.info(`[videoJobOrchestrator] Starting queued video job ${event.params.jobId}`);

    try {
      await executeVideoJob(event.params.jobId, after);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[videoJobOrchestrator] Failed to process queued job ${event.params.jobId}: ${message}`);
    }
  }
);
