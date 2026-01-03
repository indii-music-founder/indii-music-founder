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

import { BigQuery, Dataset, Table } from '@google-cloud/bigquery';
import { logger } from 'firebase-functions';

// Initialize BigQuery client with ADC
const getBigQueryClient = (): BigQuery => {
    return new BigQuery();
};

export interface QueryResult {
    rows: Record<string, unknown>[];
    totalRows: number;
    schema?: { name: string; type: string }[];
    jobId?: string;
    bytesProcessed?: number;
}

export interface TableSchema {
    fields: { name: string; type: string; mode?: string; description?: string }[];
}

/**
 * Execute a BigQuery SQL query
 * @param query - SQL query string
 * @param projectId - GCP project ID
 * @param options - Query options (maxResults, timeout, etc.)
 */
export async function executeQuery(
    query: string,
    projectId: string,
    options?: {
        maxResults?: number;
        timeoutMs?: number;
        useLegacySql?: boolean;
    }
): Promise<QueryResult> {
    try {
        const bigquery = getBigQueryClient();

        // SQL injection prevention - strict validation
        const trimmedQuery = query.trim();

        // 1. Query length limit (prevent DoS)
        if (trimmedQuery.length > 10000) {
            throw new Error('Query exceeds maximum length (10000 characters)');
        }

        // 2. Only allow SELECT queries
        if (!/^\s*SELECT\s/i.test(trimmedQuery)) {
            throw new Error('Only SELECT queries are allowed');
        }

        // 3. Block dangerous patterns
        const dangerousPatterns = [
            /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE|GRANT|REVOKE)\s/i,
            /INTO\s+OUTFILE/i,
            /LOAD_FILE\s*\(/i,
            /--/,                    // SQL comments
            /\/\*/,                  // Block comments
            /xp_/i,                  // SQL Server extended procedures
            /EXEC(\s|\()/i,          // Execute statements
            /UNION\s+ALL\s+SELECT/i, // Union injection
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(trimmedQuery)) {
                throw new Error('Query contains prohibited patterns');
            }
        }

        const [job] = await bigquery.createQueryJob({
            query,
            location: 'US', // Default location
            maximumBytesBilled: '10000000000', // 10GB limit for safety
            useLegacySql: options?.useLegacySql ?? false,
        });

        logger.info(`[BigQuery] Job ${job.id} started for query`);

        // Wait for query to complete
        const [rows] = await job.getQueryResults({
            maxResults: options?.maxResults ?? 1000,
            timeoutMs: options?.timeoutMs ?? 30000,
        });

        // Get job metadata for additional info
        const [metadata] = await job.getMetadata();
        const stats = metadata.statistics;

        // Get schema from job
        const schema = metadata.configuration?.query?.destinationTable
            ? undefined // Would need another call
            : (rows[0] ? Object.keys(rows[0]).map((name) => ({
                name,
                type: typeof rows[0][name] === 'number' ? 'FLOAT' : 'STRING',
            })) : undefined);

        return {
            rows: rows as Record<string, unknown>[],
            totalRows: rows.length,
            schema,
            jobId: job.id || undefined,
            bytesProcessed: stats?.query?.totalBytesBilled
                ? parseInt(stats.query.totalBytesBilled)
                : undefined,
        };
    } catch (error) {
        logger.error('[BigQuery] executeQuery failed:', error);
        throw new Error(`BigQuery query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get schema for a specific table
 */
export async function getTableSchema(
    projectId: string,
    datasetId: string,
    tableId: string
): Promise<TableSchema> {
    try {
        const bigquery = getBigQueryClient();
        const dataset: Dataset = bigquery.dataset(datasetId, { projectId });
        const table: Table = dataset.table(tableId);

        const [metadata] = await table.getMetadata();
        const schema = metadata.schema;

        if (!schema || !schema.fields) {
            throw new Error('Table schema not found');
        }

        return {
            fields: schema.fields.map((field: {
                name?: string;
                type?: string;
                mode?: string;
                description?: string;
            }) => ({
                name: field.name || '',
                type: field.type || 'STRING',
                mode: field.mode,
                description: field.description,
            })),
        };
    } catch (error) {
        logger.error('[BigQuery] getTableSchema failed:', error);
        throw new Error(`Failed to get table schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * List available datasets in the project
 */
export async function listDatasets(projectId: string): Promise<string[]> {
    try {
        const bigquery = getBigQueryClient();
        const [datasets] = await bigquery.getDatasets({ projectId });

        return datasets.map((dataset) => dataset.id || 'unknown');
    } catch (error) {
        logger.error('[BigQuery] listDatasets failed:', error);
        throw new Error(`Failed to list datasets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * List tables in a dataset
 */
export async function listTables(projectId: string, datasetId: string): Promise<string[]> {
    try {
        const bigquery = getBigQueryClient();
        const dataset = bigquery.dataset(datasetId, { projectId });
        const [tables] = await dataset.getTables();

        return tables.map((table) => table.id || 'unknown');
    } catch (error) {
        logger.error('[BigQuery] listTables failed:', error);
        throw new Error(`Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
