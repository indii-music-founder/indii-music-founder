# Finance & Royalties Module (RC1)

The Finance module provides a unified ledger for independent artists and labels to track revenue, manage budgets, and automate royalty distributions. It integrates with the **Finance Agent** for AI-driven financial forecasting and the **Stripe** service for real-time payments.

## 💰 Key Features
- **Royalty Ledger:** A secure, immutable record of all income (Streaming, Physical, Sync).
- **Waterfall Splits:** Automated calculation of royalty payments across multiple stakeholders (Producers, Features, Writers).
- **Expense Tracking:** Capture and categorize studio time, marketing spend, and tour logistics costs.
- **Budgeting Engine:** Project-level financial planning for album releases and tours.
- **Invoice Generator:** Automated creation and tracking of professional invoices.
- **BigQuery Analytics:** High-performance revenue analysis of Digital Sales Reports (DSR).

## 🏗️ Technical Architecture
- **`FinanceService`**: Core logic for transactions and split calculations.
- **`ExpenseTracker`**: React component for categorizing and auditing spending.
- **Waterfall Calculations**: Recursive math engine to handle complex multi-tier payout structures.
- **Firestore Integration**: Atomic transaction handling for financial data integrity.

## 🤖 Finance Agent
The module is enhanced by a specialized **Finance Agent** capable of:
- Calculating "break-even" points for projects.
- Identifying missing royalty streams.
- Generating quarterly financial reports from raw sales data.
