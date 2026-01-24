import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load env vars from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the schema (for verification that file exists/is valid JSON, though not directly used for Zod creation here)
const schemaPath = path.resolve(__dirname, '../env-schema.json');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
const jsonSchema = JSON.parse(schemaContent);

// Helper to convert JSON schema to Zod schema (simplified for this specific use case)
// Manually mapped to match env-schema.json
const envSchema = z.object({
    VITE_API_KEY: z.string().min(1),
    VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),
    VITE_SKIP_ONBOARDING: z.enum(['true', 'false']).default('false').optional(),
    DEV: z.string().default('false').optional(),

    VITE_VERTEX_PROJECT_ID: z.string().min(1),
    VITE_VERTEX_LOCATION: z.string().default('us-central1'),
    VITE_USE_VERTEX: z.enum(['true', 'false']).default('false'),
    GCLOUD_PROJECT: z.string().optional(),

    VITE_FUNCTIONS_URL: z.string().url().optional(),
    VITE_RAG_PROXY_URL: z.string().url().optional(),

    // Firebase Frontend
    VITE_FIREBASE_API_KEY: z.string().optional(),
    VITE_FIREBASE_AUTH_DOMAIN: z.string().optional(),
    VITE_FIREBASE_PROJECT_ID: z.string().optional(),
    VITE_FIREBASE_STORAGE_BUCKET: z.string().optional(),
    VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
    VITE_FIREBASE_APP_ID: z.string().optional(),
    VITE_FIREBASE_MEASUREMENT_ID: z.string().optional(),
    VITE_FIREBASE_DATABASE_URL: z.string().optional(),

    // App Check
    VITE_FIREBASE_APP_CHECK_KEY: z.string().optional(),
    VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN: z.string().optional(),

    VITE_LANDING_PAGE_URL: z.string().optional(),

    // Firebase Scripts
    FIREBASE_API_KEY: z.string().optional(),
    FIREBASE_AUTH_DOMAIN: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_STORAGE_BUCKET: z.string().optional(),
    FIREBASE_APP_ID: z.string().optional(),

    // Automator
    AUTOMATOR_EMAIL: z.string().email().optional(),
    AUTOMATOR_PASSWORD: z.string().optional(),
});

console.log('Validating environment variables...');

const processEnv = {
    VITE_API_KEY: process.env.VITE_API_KEY,
    VITE_GOOGLE_MAPS_API_KEY: process.env.VITE_GOOGLE_MAPS_API_KEY,
    VITE_SKIP_ONBOARDING: process.env.VITE_SKIP_ONBOARDING,
    DEV: process.env.DEV,

    VITE_VERTEX_PROJECT_ID: process.env.VITE_VERTEX_PROJECT_ID,
    VITE_VERTEX_LOCATION: process.env.VITE_VERTEX_LOCATION,
    VITE_USE_VERTEX: process.env.VITE_USE_VERTEX,
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,

    VITE_FUNCTIONS_URL: process.env.VITE_FUNCTIONS_URL,
    VITE_RAG_PROXY_URL: process.env.VITE_RAG_PROXY_URL,

    VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MEASUREMENT_ID: process.env.VITE_FIREBASE_MEASUREMENT_ID,
    VITE_FIREBASE_DATABASE_URL: process.env.VITE_FIREBASE_DATABASE_URL,

    VITE_FIREBASE_APP_CHECK_KEY: process.env.VITE_FIREBASE_APP_CHECK_KEY,
    VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN: process.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN,

    VITE_LANDING_PAGE_URL: process.env.VITE_LANDING_PAGE_URL,

    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,

    AUTOMATOR_EMAIL: process.env.AUTOMATOR_EMAIL,
    AUTOMATOR_PASSWORD: process.env.AUTOMATOR_PASSWORD,
};

const result = envSchema.safeParse(processEnv);

if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
}

console.log('✅ Environment variables are valid.');
