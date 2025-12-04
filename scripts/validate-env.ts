import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env vars from .env file
dotenv.config();

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the schema
const schemaPath = path.resolve(__dirname, '../env-schema.json');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
const jsonSchema = JSON.parse(schemaContent);

// Helper to convert JSON schema to Zod schema (simplified for this specific use case)
// For a robust solution, we might want to use a library like json-schema-to-zod,
// but for now we'll manually map the known structure of our env-schema.json
const envSchema = z.object({
    VITE_API_KEY: z.string().min(1),
    VITE_VERTEX_PROJECT_ID: z.string().min(1),
    VITE_VERTEX_LOCATION: z.string().default('us-central1'),
    VITE_USE_VERTEX: z.enum(['true', 'false']).default('false'),
    VITE_FUNCTIONS_URL: z.string().url().optional(),
    VITE_RAG_PROXY_URL: z.string().url().optional(),
    GCLOUD_PROJECT: z.string().optional(),
});

console.log('Validating environment variables...');

const processEnv = {
    VITE_API_KEY: process.env.VITE_API_KEY,
    VITE_VERTEX_PROJECT_ID: process.env.VITE_VERTEX_PROJECT_ID,
    VITE_VERTEX_LOCATION: process.env.VITE_VERTEX_LOCATION,
    VITE_USE_VERTEX: process.env.VITE_USE_VERTEX,
    VITE_FUNCTIONS_URL: process.env.VITE_FUNCTIONS_URL,
    VITE_RAG_PROXY_URL: process.env.VITE_RAG_PROXY_URL,
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
};

const result = envSchema.safeParse(processEnv);

if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
}

console.log('✅ Environment variables are valid.');
