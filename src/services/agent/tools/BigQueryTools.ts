import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

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

export const BigQueryTools: Record<string, AnyToolFunction> = {
    execute_bigquery_query: wrapTool('execute_bigquery_query', async (args: {
        query: string;
        projectId?: string;
        maxResults?: number;
        useLegacySql?: boolean;
    }) => {
        console.info(`[BigQuery] Executing query: ${args.query.substring(0, 100)}...`);

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

        return toolSuccess({
            rows: result.data.rows,
            totalRows: result.data.totalRows,
            schema: result.data.schema,
            jobId: result.data.jobId
        }, `Successfully executed BigQuery query. Returned ${result.data.rows.length} rows.`);
    }),

    get_table_schema: wrapTool('get_table_schema', async (args: {
        table_id: string;
        dataset_id: string;
        projectId?: string;
    }) => {
        console.info(`[BigQuery] Getting schema for: ${args.dataset_id}.${args.table_id}`);

        const getBigQueryTableSchemaFn = httpsCallable<
            { tableId: string; datasetId: string; projectId?: string },
            BigQuerySchema
        >(functions, 'getBigQueryTableSchema');

        const result = await getBigQueryTableSchemaFn({
            tableId: args.table_id,
            datasetId: args.dataset_id,
            projectId: args.projectId
        });

        return toolSuccess(result.data, `Retrieved schema for table ${args.dataset_id}.${args.table_id}.`);
    }),

    list_datasets: wrapTool('list_datasets', async (args?: { projectId?: string }) => {
        console.info(`[BigQuery] Listing datasets`);

        const listBigQueryDatasetsFn = httpsCallable<
            { projectId?: string },
            { datasets: BigQueryDataset[] }
        >(functions, 'listBigQueryDatasets');

        const result = await listBigQueryDatasetsFn({
            projectId: args?.projectId
        });

        return toolSuccess({
            datasets: result.data.datasets
        }, `Retrieved ${result.data.datasets.length} datasets.`);
    })
};
