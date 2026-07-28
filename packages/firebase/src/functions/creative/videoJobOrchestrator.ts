import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { executeVideoJob, type VideoGenerationJobRecord } from './gateway';
import { claimQueuedGatewayVideoJob } from './videoJobAuthority';

export const videoJobFirestoreOrchestrator = onDocumentWritten(
  {
    document: 'videoJobs/{jobId}',
    region: 'us-central1',
    memory: '512MiB',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.info('[videoJobFirestoreOrchestrator] No snapshot data associated with event.');
      return;
    }

    const after = snapshot.after.data() as VideoGenerationJobRecord | undefined;
    if (!after) {
      logger.info(`[videoJobFirestoreOrchestrator] Job ${event.params.jobId} was deleted.`);
      return;
    }

    if (after.type !== 'video' || after.status !== 'queued') {
      return;
    }

    try {
      const claimed = await claimQueuedGatewayVideoJob(
        snapshot.after.ref.firestore,
        event.params.jobId,
      );
      if (!claimed) return;
      logger.info(`[videoJobFirestoreOrchestrator] Claimed queued video job ${event.params.jobId}`);
      await executeVideoJob(event.params.jobId, claimed as VideoGenerationJobRecord);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[videoJobFirestoreOrchestrator] Failed to process queued job ${event.params.jobId}: ${message}`);
    }
  }
);
