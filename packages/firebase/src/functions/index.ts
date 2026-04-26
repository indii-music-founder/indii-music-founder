/**
 * Cloud Functions — Orchestrated exports
 *
 * This index re-exports all Cloud Functions from their respective modules.
 * Firebase automatically picks up functions from this file.
 */

// API Router
export * from './api/router';

// Analytics & BigQuery
export * from './analytics/bigquery-pipeline';

// Webhooks & Event Dispatch
export * from './webhooks/dispatcher';

// Job Orchestration (Inngest)
export { inngest } from './orchestration/inngest';

// OpenAPI Schema Generation
export { generateOpenAPISpec, writeOpenAPISpec } from './openapi';

// Admin operations
export { setGodMode } from './admin/setGodMode';
