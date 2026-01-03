import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/functions
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn()
}));

// Mock @/services/firebase
vi.mock('@/services/firebase', () => ({
    functions: {}
}));

import { httpsCallable } from 'firebase/functions';
import { execute_bigquery_query, get_table_schema, list_datasets } from './BigQueryTools';

const mockHttpsCallable = httpsCallable as ReturnType<typeof vi.fn>;

describe('BigQueryTools (Real BigQuery via Cloud Functions)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('execute_bigquery_query calls executeBigQueryQuery function', async () => {
        const mockResult = {
            rows: [{ quarter: '2025-Q1', revenue: 150000, region: 'North America' }],
            totalRows: 1,
            schema: [{ name: 'quarter', type: 'STRING' }],
            jobId: 'job_abc123'
        };
        const mockCallable = vi.fn().mockResolvedValue({ data: mockResult });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await execute_bigquery_query({ query: 'SELECT * FROM sales WHERE year = 2025' });
        const parsed = JSON.parse(result);

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'executeBigQueryQuery');
        expect(mockCallable).toHaveBeenCalledWith({
            query: 'SELECT * FROM sales WHERE year = 2025',
            projectId: undefined,
            maxResults: 1000,
            useLegacySql: false
        });
        expect(parsed.rows).toHaveLength(1);
        expect(parsed.jobId).toBe('job_abc123');
    });

    it('execute_bigquery_query accepts custom maxResults', async () => {
        const mockResult = { rows: [], totalRows: 0, schema: [], jobId: 'job_xyz' };
        const mockCallable = vi.fn().mockResolvedValue({ data: mockResult });
        mockHttpsCallable.mockReturnValue(mockCallable);

        await execute_bigquery_query({
            query: 'SELECT * FROM large_table',
            maxResults: 100,
            projectId: 'custom-project'
        });

        expect(mockCallable).toHaveBeenCalledWith({
            query: 'SELECT * FROM large_table',
            projectId: 'custom-project',
            maxResults: 100,
            useLegacySql: false
        });
    });

    it('get_table_schema calls getBigQueryTableSchema function', async () => {
        const mockSchema = {
            tableId: 'sales_data',
            fields: [
                { name: 'date', type: 'DATE' },
                { name: 'revenue', type: 'FLOAT' }
            ]
        };
        const mockCallable = vi.fn().mockResolvedValue({ data: mockSchema });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await get_table_schema({
            table_id: 'sales_data',
            dataset_id: 'analytics'
        });
        const parsed = JSON.parse(result);

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getBigQueryTableSchema');
        expect(mockCallable).toHaveBeenCalledWith({
            tableId: 'sales_data',
            datasetId: 'analytics',
            projectId: undefined
        });
        expect(parsed.fields).toHaveLength(2);
        expect(parsed.fields[0].name).toBe('date');
    });

    it('list_datasets calls listBigQueryDatasets function', async () => {
        const mockDatasets = [
            { datasetId: 'analytics', location: 'US', createdAt: '2025-01-01T00:00:00Z' },
            { datasetId: 'marketing', location: 'US', createdAt: '2025-02-01T00:00:00Z' }
        ];
        const mockCallable = vi.fn().mockResolvedValue({ data: { datasets: mockDatasets } });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await list_datasets({ projectId: 'test-project' });
        const parsed = JSON.parse(result);

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'listBigQueryDatasets');
        expect(parsed).toHaveLength(2);
        expect(parsed[0].datasetId).toBe('analytics');
    });

    it('handles query errors gracefully', async () => {
        const mockCallable = vi.fn().mockRejectedValue(new Error('Invalid SQL syntax'));
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await execute_bigquery_query({ query: 'INVALID SQL' });
        const parsed = JSON.parse(result);

        expect(parsed).toHaveProperty('error', 'Invalid SQL syntax');
        expect(parsed).toHaveProperty('hint');
    });

    it('handles schema errors for unknown tables', async () => {
        const mockCallable = vi.fn().mockRejectedValue(new Error('Table not found'));
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await get_table_schema({
            table_id: 'unknown_table',
            dataset_id: 'analytics'
        });
        const parsed = JSON.parse(result);

        expect(parsed).toHaveProperty('error', 'Table not found');
        expect(parsed).toHaveProperty('message');
    });
});
