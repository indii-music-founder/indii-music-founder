/**
 * Inngest Job Orchestration
 *
 * Background job scheduling for:
 * - Distribution processing
 * - Batch analytics exports
 * - Webhook retry scheduling
 * - User onboarding workflows
 */

import { Inngest } from 'inngest';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Inngest client
 */
export const inngest = new Inngest({
  id: 'indiios-api',
  name: 'IndiiOS Analytics & Distribution API',
});

interface DistributionJobPayload {
  distributionId: string;
  userId: string;
  distributors: string[];
  tracks: Array<{ trackId: string; title: string }>;
}

interface AnalyticsExportPayload {
  userId: string;
  format: 'csv' | 'json';
  startDate: string;
  endDate: string;
}

interface WebhookRetryPayload {
  webhookEventId: string;
  userId: string;
  attempt: number;
}

interface OnboardingPayload {
  userId: string;
  email: string;
  name: string;
}

/**
 * Job: Process distribution across multiple platforms
 */
export const processDistribution = inngest.createFunction(
  { id: 'process-distribution', retries: 3 },
  { event: 'distribution/created' },
  async ({ event, step }) => {
    const { distributionId, userId, distributors, tracks } = event.data as DistributionJobPayload;

    // Update status to processing
    await step.run('update-status', async () => {
      await db
        .collection('users').doc(userId)
        .collection('distributions').doc(distributionId)
        .update({ status: 'processing', updatedAt: new Date().toISOString() });
    });

    // Process each distributor
    for (const distributor of distributors) {
      await step.run(`submit-${distributor}`, async () => {
        try {
          const result = await submitToDistributor(distributionId, userId, distributor, tracks);
          console.log(`[Inngest] Distribution ${distributionId} submitted to ${distributor}:`, result);
        } catch (err) {
          console.error(`[Inngest] Distributor submission failed for ${distributor}:`, err);
          throw err;
        }
      });
    }

    // Mark as complete
    await step.run('mark-complete', async () => {
      await db
        .collection('users').doc(userId)
        .collection('distributions').doc(distributionId)
        .update({ status: 'submitted', submittedAt: new Date().toISOString() });
    });

    return { distributionId, status: 'submitted' };
  }
);

/**
 * Job: Export analytics data
 */
export const exportAnalytics = inngest.createFunction(
  { id: 'export-analytics', retries: 2 },
  { event: 'analytics/export-requested' },
  async ({ event, step }) => {
    const { userId, format, startDate, endDate } = event.data as AnalyticsExportPayload;

    const filename = await step.run('generate-export', async () => {
      const query = db
        .collection('users').doc(userId).collection('events')
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate);

      const snapshot = await query.get();
      const events = snapshot.docs.map(doc => doc.data());

      let exportData: string;
      if (format === 'csv') {
        exportData = convertToCSV(events);
      } else {
        exportData = JSON.stringify(events, null, 2);
      }

      // Save to Cloud Storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(`exports/${userId}/analytics-${Date.now()}.${format === 'csv' ? 'csv' : 'json'}`);
      await file.save(exportData);

      return file.name;
    });

    // Send notification
    await step.run('send-notification', async () => {
      console.log(`[Inngest] Analytics export ready: ${filename}`);
    });

    return { filename, format, recordCount: 0 };
  }
);

/**
 * Job: Retry failed webhook deliveries
 */
export const retryWebhookDelivery = inngest.createFunction(
  { id: 'retry-webhook-delivery', retries: 2 },
  { event: 'webhook/retry-scheduled' },
  async ({ event, step }) => {
    const { webhookEventId, attempt } = event.data as WebhookRetryPayload;

    const result = await step.run(`attempt-${attempt}`, async () => {
      const webhookEvent = await db.collection('webhook_queue').doc(webhookEventId).get();
      if (!webhookEvent.exists) {
        return { status: 'not-found' };
      }

      // Retry logic handled by WebhookDispatcher
      // This job just ensures retries are scheduled
      return { status: 'queued', webhookEventId, attempt };
    });

    return result;
  }
);

/**
 * Job: Scheduled daily batch analytics aggregation
 */
export const batchAnalyticsAggregation = inngest.createFunction(
  { id: 'batch-analytics-aggregation' },
  { cron: '0 2 * * *' }, // 2 AM UTC daily
  async ({ step }) => {
    const result = await step.run('aggregate-daily-events', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Query all events from yesterday
      const snapshot = await db
        .collectionGroup('events')
        .where('timestamp', '>=', yesterday.toISOString())
        .where('timestamp', '<', now.toISOString())
        .limit(1000)
        .get();

      const eventsByUser: Record<string, any[]> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!eventsByUser[data.userId]) {
          eventsByUser[data.userId] = [];
        }
        eventsByUser[data.userId].push(data);
      });

      // Create daily aggregates
      for (const [userId, events] of Object.entries(eventsByUser)) {
        const aggregation = {
          date: yesterday.toISOString().split('T')[0],
          totalEvents: events.length,
          eventsByType: events.reduce((acc: Record<string, number>, e: any) => {
            acc[e.eventType] = (acc[e.eventType] || 0) + 1;
            return acc;
          }, {}),
          createdAt: new Date().toISOString(),
        };

        await db
          .collection('users').doc(userId).collection('analytics_daily')
          .doc(yesterday.toISOString().split('T')[0])
          .set(aggregation);
      }

      return { processedUsers: Object.keys(eventsByUser).length };
    });

    return result;
  }
);

/**
 * Job: Send onboarding emails
 */
export const sendOnboardingWorkflow = inngest.createFunction(
  { id: 'send-onboarding-workflow' },
  { event: 'user/onboarded' },
  async ({ event, step }) => {
    const { userId, email } = event.data as OnboardingPayload;

    // Step 1: Send welcome email
    await step.run('send-welcome', async () => {
      console.log(`[Inngest] Sending welcome email to ${email}`);
      // Integration with email service (SendGrid, etc.)
    });

    // Step 2: Wait 3 days, then send resources email
    await step.sleep('wait-3-days', '3 days');
    await step.run('send-resources', async () => {
      console.log(`[Inngest] Sending resources email to ${email}`);
    });

    // Step 3: Wait 1 week, then check engagement
    await step.sleep('wait-1-week', '7 days');
    await step.run('check-engagement', async () => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const createdTracks = (userDoc.data()?.stats?.tracksCreated) || 0;

      if (createdTracks === 0) {
        console.log(`[Inngest] Sending re-engagement email to ${email}`);
        // Send re-engagement email
      }
    });

    return { userId, email, workflowStatus: 'completed' };
  }
);

/**
 * Helper: Submit distribution to a specific platform
 */
async function submitToDistributor(
  distributionId: string,
  userId: string,
  distributor: string,
  tracks: Array<{ trackId: string; title: string }>
): Promise<any> {
  // This would integrate with actual distributor APIs
  // For now, return mock success
  return {
    distributionId,
    distributor,
    trackCount: tracks.length,
    status: 'submitted',
  };
}

/**
 * Helper: Convert events to CSV format
 */
function convertToCSV(events: any[]): string {
  if (events.length === 0) return '';

  const headers = ['eventId', 'eventType', 'userId', 'timestamp', 'data'];
  const rows = events.map(e => [
    e.id,
    e.eventType,
    e.userId,
    e.timestamp,
    JSON.stringify(e.data),
  ]);

  return [
    headers.join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
}
