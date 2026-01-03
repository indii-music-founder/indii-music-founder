import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

// Tool: BigQuery (Real queries via Cloud Functions)
// This tool executes BigQuery queries through Firebase Cloud Functions.
// Backend uses @google-cloud/bigquery for real data retrieval.

interface BigQueryField {
    name: string;
    type: string;
    mode?: string;
    description?: string;
}

interface BigQuerySchema {
    tableId: string;
    fields: BigQueryField[];
}

interface BigQueryDataset {
    datasetId: string;
    location: string;
    createdAt: string;
}

interface QueryResult {
    rows: Record<string, unknown>[];
    totalRows: number;
    schema: BigQueryField[];
    jobId: string;
}

export const execute_bigquery_query = async (args: {
    query: string;
    projectId?: string;
    maxResults?: number;
    useLegacySql?: boolean;
}) => {
    console.log(`[BigQuery] Executing query: ${args.query.substring(0, 100)}...`);

    try {
        const executeBigQueryQueryFn = httpsCallable<
            { query: string; projectId?: string; maxResults?: number; useLegacySql?: boolean },
            QueryResult
        >(functions, 'executeBigQueryQuery');

        const result = await executeBigQueryQueryFn({
            query: args.query,
            projectId: args.projectId,
            maxResults: args.maxResults || 1000,
            useLegacySql: args.useLegacySql || false
        });

        return JSON.stringify({
            rows: result.data.rows,
            totalRows: result.data.totalRows,
            schema: result.data.schema,
            jobId: result.data.jobId
        });
    } catch (error) {
        const err = error as Error;
        console.error('[BigQuery] Query failed:', err.message);
        return JSON.stringify({
            error: err.message,
            hint: 'Check query syntax and ensure BigQuery API is enabled with proper permissions.'
        });
    }
};

export const get_table_schema = async (args: {
    table_id: string;
    dataset_id: string;
    projectId?: string;
}) => {
    console.log(`[BigQuery] Getting schema for: ${args.dataset_id}.${args.table_id}`);

    try {
        const getBigQueryTableSchemaFn = httpsCallable<
            { tableId: string; datasetId: string; projectId?: string },
            BigQuerySchema
        >(functions, 'getBigQueryTableSchema');

        const result = await getBigQueryTableSchemaFn({
            tableId: args.table_id,
            datasetId: args.dataset_id,
            projectId: args.projectId
        });

        return JSON.stringify(result.data);
    } catch (error) {
        const err = error as Error;
        console.error('[BigQuery] Failed to get schema:', err.message);
        return JSON.stringify({
            error: err.message,
            message: 'Table not found or access denied.'
        });
    }
};

export const list_datasets = async (args?: { projectId?: string }) => {
    console.log(`[BigQuery] Listing datasets`);

    try {
        const listBigQueryDatasetsFn = httpsCallable<
            { projectId?: string },
            { datasets: BigQueryDataset[] }
        >(functions, 'listBigQueryDatasets');

        const result = await listBigQueryDatasetsFn({
            projectId: args?.projectId
        });

        return JSON.stringify(result.data.datasets);
    } catch (error) {
        const err = error as Error;
        console.error('[BigQuery] Failed to list datasets:', err.message);
        return JSON.stringify({
            error: err.message,
            hint: 'Ensure BigQuery API is enabled and service account has bigquery.datasets.list permission.'
        });
    }
};

export const BigQueryTools = {
    execute_bigquery_query,
    get_table_schema,
    list_datasets
};
