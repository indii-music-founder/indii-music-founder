import { describe, it, expect } from 'vitest';
import { execute_bigquery_query, get_table_schema } from './BigQueryTools';

describe('BigQueryTools (Mock)', () => {

    it('execute_bigquery_query returns sales data', async () => {
        const result = await execute_bigquery_query({ query: 'SELECT * FROM sales WHERE year = 2025' });
        const parsed = JSON.parse(result);

        expect(parsed).toHaveLength(4);
        expect(parsed[0]).toHaveProperty('revenue');
        expect(parsed[0].quarter).toBe('2025-Q1');
    });

    it('execute_bigquery_query returns budget data', async () => {
        const result = await execute_bigquery_query({ query: 'SHOW ME THE Marketing BUDGET' });
        const parsed = JSON.parse(result);

        expect(parsed).toHaveLength(3);
        expect(parsed[0].category).toBe('Marketing');
        expect(parsed[2].status).toBe('Over Budget');
    });

    it('execute_bigquery_query returns ROI data', async () => {
        const result = await execute_bigquery_query({ query: 'Calculate ROI for campaigns' });
        const parsed = JSON.parse(result);

        expect(parsed).toHaveLength(2);
        expect(parsed[0].campaign).toBe('Summer_Launch');
        expect(parsed[0].roi).toBe('300%');
    });

    it('execute_bigquery_query returns default message for unknown query', async () => {
        const result = await execute_bigquery_query({ query: 'SELECT * FROM unknown_table' });
        const parsed = JSON.parse(result);

        expect(parsed[0]).toHaveProperty('message');
        expect(parsed[0].rows_returned).toBe(0);
    });

    it('get_table_schema returns sales schema', async () => {
        const result = await get_table_schema({ table_id: 'sales_data' });
        const parsed = JSON.parse(result);

        expect(parsed).toHaveProperty('fields');
        expect(parsed.fields[0].name).toBe('date');
    });

    it('get_table_schema returns error for unknown table', async () => {
        const result = await get_table_schema({ table_id: 'unknown_table' });
        const parsed = JSON.parse(result);

        expect(parsed).toHaveProperty('message', 'Table not found.');
    });
});
