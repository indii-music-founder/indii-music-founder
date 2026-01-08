import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHttpsCallable = vi.fn();

// Mock firebase/functions
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: (...args: any[]) => mockHttpsCallable(...args)
}));

// Mock @/services/firebase
vi.mock('@/services/firebase', () => ({
    functions: {}
}));

import { httpsCallable } from 'firebase/functions';
import { BigQueryTools } from '../BigQueryTools';

// No need to cast again since we defined mockHttpsCallable above
// const mockHttpsCallable = httpsCallable as ReturnType<typeof vi.fn>;

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

        const result = await BigQueryTools.execute_bigquery_query({ query: 'SELECT * FROM sales WHERE year = 2025' });

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'executeBigQueryQuery');
        expect(mockCallable).toHaveBeenCalledWith({
            query: 'SELECT * FROM sales WHERE year = 2025',
            projectId: undefined,
            maxResults: 1000,
            useLegacySql: false
        });
        expect(result.success).toBe(true);
        expect(result.data.rows).toEqual(mockResult.rows);
        expect(result.data.jobId).toBe('job_abc123');
    });

    it('execute_bigquery_query accepts custom maxResults', async () => {
        const mockResult = { rows: [], totalRows: 0, schema: [], jobId: 'job_xyz' };
        const mockCallable = vi.fn().mockResolvedValue({ data: mockResult });
        mockHttpsCallable.mockReturnValue(mockCallable);

        await BigQueryTools.execute_bigquery_query({
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

        const result = await BigQueryTools.get_table_schema({
            table_id: 'sales_data',
            dataset_id: 'analytics'
        });

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getBigQueryTableSchema');
        expect(mockCallable).toHaveBeenCalledWith({
            tableId: 'sales_data',
            datasetId: 'analytics',
            projectId: undefined
        });
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockSchema);
    });

    it('list_datasets calls listBigQueryDatasets function', async () => {
        const mockDatasets = [
            { datasetId: 'analytics', location: 'US', createdAt: '2025-01-01T00:00:00Z' },
            { datasetId: 'marketing', location: 'US', createdAt: '2025-02-01T00:00:00Z' }
        ];
        const mockCallable = vi.fn().mockResolvedValue({ data: { datasets: mockDatasets } });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await BigQueryTools.list_datasets({ projectId: 'test-project' });

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'listBigQueryDatasets');
        expect(result.success).toBe(true);
        expect(result.data.datasets).toEqual(mockDatasets);
    });

    it('handles query errors gracefully', async () => {
        const mockCallable = vi.fn().mockRejectedValue(new Error('Invalid SQL syntax'));
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await BigQueryTools.execute_bigquery_query({ query: 'INVALID SQL' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid SQL syntax');
    });

    it('handles schema errors for unknown tables', async () => {
        const mockCallable = vi.fn().mockRejectedValue(new Error('Table not found'));
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await BigQueryTools.get_table_schema({
            table_id: 'unknown_table',
            dataset_id: 'analytics'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Table not found');
    });
});
