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
    }),

    run_cohort_analysis: wrapTool('run_cohort_analysis', async (args: { dataset_id: string; table_id: string; cohort_dimension: string; timeframe: string }) => {
        console.info(`[BigQuery] Running cohort analysis on ${args.dataset_id}.${args.table_id}`);

        // Build a standard weekly cohort retention SQL query.
        // Table is expected to have: user_id, event_date (YYYYMMDD string), event_name columns.
        const cohortSql = `
WITH cohorts AS (
  SELECT
    user_id,
    DATE_TRUNC(PARSE_DATE('%Y%m%d', MIN(event_date)), WEEK) AS cohort_week,
    MIN(PARSE_DATE('%Y%m%d', event_date))                   AS first_event_date
  FROM \`${args.dataset_id}.${args.table_id}\`
  WHERE event_name IN ('first_open', 'session_start', 'stream_start')
  GROUP BY user_id
),
activity AS (
  SELECT DISTINCT
    e.user_id,
    c.cohort_week,
    DATE_DIFF(PARSE_DATE('%Y%m%d', e.event_date), c.first_event_date, DAY) AS days_after_first
  FROM \`${args.dataset_id}.${args.table_id}\` e
  JOIN cohorts c ON e.user_id = c.user_id
  WHERE e.event_name IN ('session_start', 'stream_start')
)
SELECT
  FORMAT_DATE('%Y-%m-%d', cohort_week)                                               AS cohort,
  COUNT(DISTINCT user_id)                                                            AS cohort_size,
  ROUND(COUNTIF(days_after_first >= 7)  / COUNT(DISTINCT user_id), 2)               AS retention_d7,
  ROUND(COUNTIF(days_after_first >= 14) / COUNT(DISTINCT user_id), 2)               AS retention_d14,
  ROUND(COUNTIF(days_after_first >= 30) / COUNT(DISTINCT user_id), 2)               AS retention_d30
FROM activity
GROUP BY cohort_week
ORDER BY cohort_week DESC
LIMIT 8`;

        try {
            const executeFn = httpsCallable<
                { query: string; maxResults?: number; useLegacySql?: boolean },
                QueryResult
            >(functions, 'executeBigQueryQuery');

            const result = await executeFn({ query: cohortSql, maxResults: 8, useLegacySql: false });
            const rows = result.data.rows as Array<{
                cohort: string;
                cohort_size: number;
                retention_d7: number;
                retention_d14: number;
                retention_d30: number;
            }>;

            // Derive a narrative insight from the cohort data
            const best = rows.reduce((a, b) => (b.retention_d30 > a.retention_d30 ? b : a), rows[0]);
            const worst = rows.reduce((a, b) => (b.retention_d30 < a.retention_d30 ? b : a), rows[0]);
            const insight = rows.length > 0
                ? `Best D30 retention: cohort starting ${best?.cohort} (${(best.retention_d30 * 100).toFixed(0)}%). ` +
                  `Lowest: ${worst?.cohort} (${(worst.retention_d30 * 100).toFixed(0)}%). ` +
                  `${best.retention_d30 > 0.45 ? 'Strong retention — investigate what drove that cohort.' : 'Retention below 45% — consider playlist refresh or re-engagement campaign.'}`
                : 'No cohort data available for the selected table.';

            return toolSuccess({
                dataset: args.dataset_id,
                table: args.table_id,
                dimension: args.cohort_dimension,
                timeframe: args.timeframe,
                cohort_results: rows,
                totalRows: result.data.totalRows,
                jobId: result.data.jobId,
                insights: insight,
            }, `Cohort analysis complete (${rows.length} cohorts). ${insight}`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            // Surface a clear actionable error rather than silently returning fake data
            return toolSuccess({
                dataset: args.dataset_id,
                table: args.table_id,
                error: msg,
                cohort_results: [],
                insights: `BigQuery query failed: ${msg}. Ensure the BigQuery dataset is configured and the executeBigQueryQuery Cloud Function has the bigquery.jobs.create IAM permission.`,
            }, `Cohort analysis failed: ${msg}`);
        }
    })
};

// Aliases
export const {
    execute_bigquery_query,
    get_table_schema,
    list_datasets,
    run_cohort_analysis
} = BigQueryTools;
