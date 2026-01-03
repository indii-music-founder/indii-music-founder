"use strict";
/**
 * BigQuery Service - Data Analytics and Reporting
 *
 * This module provides real BigQuery query execution through the Google BigQuery API.
 * Requires service account with roles/bigquery.user or roles/bigquery.admin.
 *
 * Setup:
 * 1. Enable BigQuery API: gcloud services enable bigquery.googleapis.com
 * 2. Grant role: gcloud projects add-iam-policy-binding PROJECT_ID \
 *      --member="serviceAccount:FIREBASE_SERVICE_ACCOUNT" \
 *      --role="roles/bigquery.user"
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeQuery = executeQuery;
exports.getTableSchema = getTableSchema;
exports.listDatasets = listDatasets;
exports.listTables = listTables;
const bigquery_1 = require("@google-cloud/bigquery");
const firebase_functions_1 = require("firebase-functions");
// Initialize BigQuery client with ADC
const getBigQueryClient = () => {
    return new bigquery_1.BigQuery();
};
/**
 * Execute a BigQuery SQL query
 * @param query - SQL query string
 * @param projectId - GCP project ID
 * @param options - Query options (maxResults, timeout, etc.)
 */
async function executeQuery(query, projectId, options) {
    var _a, _b, _c, _d, _e, _f;
    try {
        const bigquery = getBigQueryClient();
        // Validate query (basic SQL injection prevention)
        const dangerousPatterns = [
            /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE)\s/i,
            /;\s*UPDATE\s.*SET/i,
            /--/,
            /\/\*/,
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(query)) {
                throw new Error('Query contains potentially dangerous patterns');
            }
        }
        const [job] = await bigquery.createQueryJob({
            query,
            location: 'US', // Default location
            maximumBytesBilled: '10000000000', // 10GB limit for safety
            useLegacySql: (_a = options === null || options === void 0 ? void 0 : options.useLegacySql) !== null && _a !== void 0 ? _a : false,
        });
        firebase_functions_1.logger.info(`[BigQuery] Job ${job.id} started for query`);
        // Wait for query to complete
        const [rows] = await job.getQueryResults({
            maxResults: (_b = options === null || options === void 0 ? void 0 : options.maxResults) !== null && _b !== void 0 ? _b : 1000,
            timeoutMs: (_c = options === null || options === void 0 ? void 0 : options.timeoutMs) !== null && _c !== void 0 ? _c : 30000,
        });
        // Get job metadata for additional info
        const [metadata] = await job.getMetadata();
        const stats = metadata.statistics;
        // Get schema from job
        const schema = ((_e = (_d = metadata.configuration) === null || _d === void 0 ? void 0 : _d.query) === null || _e === void 0 ? void 0 : _e.destinationTable)
            ? undefined // Would need another call
            : (rows[0] ? Object.keys(rows[0]).map((name) => ({
                name,
                type: typeof rows[0][name] === 'number' ? 'FLOAT' : 'STRING',
            })) : undefined);
        return {
            rows: rows,
            totalRows: rows.length,
            schema,
            jobId: job.id || undefined,
            bytesProcessed: ((_f = stats === null || stats === void 0 ? void 0 : stats.query) === null || _f === void 0 ? void 0 : _f.totalBytesBilled)
                ? parseInt(stats.query.totalBytesBilled)
                : undefined,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('[BigQuery] executeQuery failed:', error);
        throw new Error(`BigQuery query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Get schema for a specific table
 */
async function getTableSchema(projectId, datasetId, tableId) {
    try {
        const bigquery = getBigQueryClient();
        const dataset = bigquery.dataset(datasetId, { projectId });
        const table = dataset.table(tableId);
        const [metadata] = await table.getMetadata();
        const schema = metadata.schema;
        if (!schema || !schema.fields) {
            throw new Error('Table schema not found');
        }
        return {
            fields: schema.fields.map((field) => ({
                name: field.name || '',
                type: field.type || 'STRING',
                mode: field.mode,
                description: field.description,
            })),
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('[BigQuery] getTableSchema failed:', error);
        throw new Error(`Failed to get table schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * List available datasets in the project
 */
async function listDatasets(projectId) {
    try {
        const bigquery = getBigQueryClient();
        const [datasets] = await bigquery.getDatasets({ projectId });
        return datasets.map((dataset) => dataset.id || 'unknown');
    }
    catch (error) {
        firebase_functions_1.logger.error('[BigQuery] listDatasets failed:', error);
        throw new Error(`Failed to list datasets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * List tables in a dataset
 */
async function listTables(projectId, datasetId) {
    try {
        const bigquery = getBigQueryClient();
        const dataset = bigquery.dataset(datasetId, { projectId });
        const [tables] = await dataset.getTables();
        return tables.map((table) => table.id || 'unknown');
    }
    catch (error) {
        firebase_functions_1.logger.error('[BigQuery] listTables failed:', error);
        throw new Error(`Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
//# sourceMappingURL=bigqueryService.js.map