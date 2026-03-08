#!/usr/bin/env node
/**
 * Item 263: Firestore Composite Index Audit Script
 *
 * Compares Firestore queries in the codebase against deployed indexes.
 * Run: npx ts-node scripts/firestore-index-audit.ts
 *
 * Checks:
 *   1. Scans source files for Firestore queries with .where() + .orderBy()
 *   2. Reads firestore.indexes.json for existing index definitions
 *   3. Reports queries that may need composite indexes
 */

import * as fs from 'fs';
import * as path from 'path';

interface QueryPattern {
    file: string;
    line: number;
    collection: string;
    fields: string[];
    orderBy?: string;
    needsComposite: boolean;
}

interface IndexDefinition {
    collectionGroup: string;
    queryScope: string;
    fields: Array<{ fieldPath: string; order: string }>;
}

// ─── Scanner ────────────────────────────────────────────────────

function scanForQueries(srcDir: string): QueryPattern[] {
    const patterns: QueryPattern[] = [];
    const files = getAllTSFiles(srcDir);

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Look for .where() calls
            if (line.includes('.where(') || line.includes('.orderBy(')) {
                // Try to extract collection name from surrounding context
                const collectionMatch = findCollection(lines, i);
                const whereFields = extractWhereFields(lines, i);
                const orderByField = extractOrderBy(lines, i);

                if (whereFields.length > 0) {
                    patterns.push({
                        file: path.relative(process.cwd(), file),
                        line: i + 1,
                        collection: collectionMatch || 'unknown',
                        fields: whereFields,
                        orderBy: orderByField,
                        needsComposite: whereFields.length > 1 || (whereFields.length >= 1 && !!orderByField),
                    });
                }
            }
        }
    }

    return patterns;
}

function getAllTSFiles(dir: string): string[] {
    const files: string[] = [];

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                files.push(...getAllTSFiles(fullPath));
            } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
                files.push(fullPath);
            }
        }
    } catch {
        // Ignore permission errors
    }

    return files;
}

function findCollection(lines: string[], index: number): string | null {
    // Search backward for .collection('name') or .doc('name')
    for (let i = index; i >= Math.max(0, index - 10); i--) {
        const match = lines[i].match(/\.collection\(['"](\w+)['"]\)/);
        if (match) return match[1];

        const docMatch = lines[i].match(/\.doc\(['"](\w+)['"]\)/);
        if (docMatch) return docMatch[1];
    }
    return null;
}

function extractWhereFields(lines: string[], index: number): string[] {
    const fields: string[] = [];
    // Check current line and next few lines for .where()
    for (let i = index; i < Math.min(lines.length, index + 5); i++) {
        const matches = lines[i].matchAll(/\.where\(['"](\w+)['"]/g);
        for (const match of matches) {
            if (!fields.includes(match[1])) {
                fields.push(match[1]);
            }
        }
    }
    return fields;
}

function extractOrderBy(lines: string[], index: number): string | undefined {
    for (let i = index; i < Math.min(lines.length, index + 5); i++) {
        const match = lines[i].match(/\.orderBy\(['"](\w+)['"]/);
        if (match) return match[1];
    }
    return undefined;
}

// ─── Index Loader ───────────────────────────────────────────────

function loadExistingIndexes(): IndexDefinition[] {
    const indexFile = path.join(process.cwd(), 'firestore.indexes.json');

    if (!fs.existsSync(indexFile)) {
        console.warn('⚠ firestore.indexes.json not found. Create it with: firebase firestore:indexes > firestore.indexes.json');
        return [];
    }

    try {
        const data = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
        return data.indexes || [];
    } catch {
        console.warn('⚠ Failed to parse firestore.indexes.json');
        return [];
    }
}

// ─── Main ───────────────────────────────────────────────────────

function main() {
    console.log('🔍 Firestore Composite Index Audit\n');

    const srcDir = path.join(process.cwd(), 'src');
    const queries = scanForQueries(srcDir);
    const indexes = loadExistingIndexes();

    const compositeQueries = queries.filter(q => q.needsComposite);

    console.log(`Found ${queries.length} Firestore queries`);
    console.log(`  └─ ${compositeQueries.length} may need composite indexes\n`);

    if (compositeQueries.length > 0) {
        console.log('Queries requiring potential composite indexes:');
        console.log('─'.repeat(80));

        for (const q of compositeQueries) {
            console.log(`\n  📄 ${q.file}:${q.line}`);
            console.log(`     Collection: ${q.collection}`);
            console.log(`     Where:      ${q.fields.join(', ')}`);
            if (q.orderBy) console.log(`     OrderBy:    ${q.orderBy}`);

            // Check if index exists
            const hasIndex = indexes.some(idx =>
                idx.collectionGroup === q.collection &&
                q.fields.every(f => idx.fields.some(idxF => idxF.fieldPath === f))
            );

            console.log(`     Index:      ${hasIndex ? '✅ Found' : '⚠️  MISSING'}`);
        }
    }

    console.log(`\n${indexes.length} existing indexes in firestore.indexes.json`);
    console.log('\n✅ Audit complete.');
}

main();
