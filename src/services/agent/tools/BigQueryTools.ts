import { delay } from '@/utils/async';

// Tool: BigQuery Mock
// This tool simulates BigQuery data retrieval for the Finance Agent.
// In a production environment, this would use the @google-cloud/bigquery library to query a real dataset.

export const execute_bigquery_query = async (args: { query: string }) => {
    console.log(`[BigQuery Mock] Executing query: ${args.query}`);

    // Simulate network delay
    await delay(1500);

    const lowerQuery = args.query.toLowerCase();

    // Mock Dataset: Sales
    if (lowerQuery.includes('sales') || lowerQuery.includes('revenue')) {
        return JSON.stringify([
            { quarter: '2025-Q1', revenue: 150000, region: 'North America' },
            { quarter: '2025-Q1', revenue: 80000, region: 'Europe' },
            { quarter: '2025-Q1', revenue: 60000, region: 'Asia' },
            { quarter: '2024-Q4', revenue: 200000, region: 'North America' } // Comparison data
        ]);
    }

    // Mock Dataset: Budget / Expenses
    if (lowerQuery.includes('budget') || lowerQuery.includes('spend') || lowerQuery.includes('cost')) {
        return JSON.stringify([
            { category: 'Marketing', budget: 50000, spent: 45000, status: 'On Track' },
            { category: 'R&D', budget: 120000, spent: 110000, status: 'On Track' },
            { category: 'Operations', budget: 30000, spent: 35000, status: 'Over Budget' }
        ]);
    }

    // Mock Dataset: ROI
    if (lowerQuery.includes('roi') || lowerQuery.includes('return')) {
        return JSON.stringify([
            { campaign: 'Summer_Launch', cost: 20000, revenue_generated: 80000, roi: '300%' },
            { campaign: 'Influencer_Push', cost: 15000, revenue_generated: 45000, roi: '200%' }
        ]);
    }

    // Default fallback
    return JSON.stringify([
        { message: "Query executed successfully, but no specific mock data matched the query keywords (sales, budget, roi).", rows_returned: 0 }
    ]);
};

export const get_table_schema = async (args: { table_id: string }) => {
    console.log(`[BigQuery Mock] Getting schema for: ${args.table_id}`);

    if (args.table_id.includes('sales')) {
        return JSON.stringify({
            fields: [
                { name: 'date', type: 'DATE' },
                { name: 'revenue', type: 'FLOAT' },
                { name: 'region', type: 'STRING' },
                { name: 'product_id', type: 'STRING' }
            ]
        });
    }

    if (args.table_id.includes('budget')) {
        return JSON.stringify({
            fields: [
                { name: 'department', type: 'STRING' },
                { name: 'budget_allocated', type: 'FLOAT' },
                { name: 'budget_spent', type: 'FLOAT' },
                { name: 'fiscal_year', type: 'INTEGER' }
            ]
        });
    }

    return JSON.stringify({ message: "Table not found." });
};
