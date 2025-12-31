// Revenue Seeding Logic
// Extracted to be testable without the TSX/Module Loader environment issues
// This file exports the seed function which can be imported by tests or other scripts.

import { collection, addDoc, Timestamp } from 'firebase/firestore';

export const PRODUCTS = [
    { id: 'prod-tshirt-001', price: 25.00, name: 'Band T-Shirt' },
    { id: 'prod-vinyl-001', price: 35.00, name: 'Debut Album Vinyl' },
    { id: 'prod-digital-001', price: 9.99, name: 'Digital Album' },
    { id: 'prod-sticker-001', price: 5.00, name: 'Sticker Pack' }
];

export const SOURCES = ['direct', 'social_drop'];

export async function seedRevenue(db: any, userId: string) {
    const revenueCol = collection(db, 'revenue');

    // Create 50 random transactions
    const promises = [];
    for (let i = 0; i < 50; i++) {
        const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
        const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 30)); // Last 30 days

        const entry = {
            userId: userId,
            productId: product.id,
            amount: product.price,
            source: source,
            customerId: `cust-${Math.floor(Math.random() * 1000)}`,
            timestamp: date.getTime(),
            createdAt: Timestamp.fromDate(date)
        };

        promises.push(addDoc(revenueCol, entry));
    }

    await Promise.all(promises);
    return 50;
}
