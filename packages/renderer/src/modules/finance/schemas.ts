import { z } from "zod";

export const ExpenseCategorySchema = z.enum([
    'Equipment',
    'Software / Plugins',
    'Marketing',
    'Travel',
    'Services',
    'Other'
]);

export const ExpenseSchema = z.object({
    id: z.string().optional(),
    userId: z.string(),
    vendor: z.string().min(1, "Vendor is required"),
    amount: z.number().positive("Amount must be positive"),
    category: z.string().min(1, "Category is required"), // Can refine with Enum if strict
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    description: z.string().optional().default(''),
    createdAt: z.any().optional()
});

export const ReceiptScanResultSchema = z.object({
    vendor: z.string().optional(),
    date: z.string().optional(),
    amount: z.number().optional(),
    category: z.string().optional(),
    description: z.string().optional()
});

export type Expense = z.infer<typeof ExpenseSchema>;
