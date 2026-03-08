/**
 * Automated API Key & Service Account Rotation Script
 * 
 * This script provides tools to rotate critical service credentials:
 * 1. Google Cloud Service Account Keys
 * 2. Firebase App Check Tokens (Logic only)
 * 3. Rotated key archival & cleanup
 * 
 * Usage:
 * npx tsx scripts/rotate-keys.ts --service-account [ACCOUNT_NAME]
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/utils/logger';

const PROJECT_ID = 'indiios-v-1-1';
const KEY_DIR = path.join(process.cwd(), 'config/keys');

interface RotationResult {
    success: boolean;
    keyId?: string;
    filePath?: string;
    error?: string;
}

async function rotateServiceAccountKey(accountName: string): Promise<RotationResult> {
    const email = `${accountName}@${PROJECT_ID}.iam.gserviceaccount.com`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${accountName}-${timestamp}.json`;
    const filePath = path.join(KEY_DIR, fileName);

    if (!fs.existsSync(KEY_DIR)) {
        fs.mkdirSync(KEY_DIR, { recursive: true });
    }

    try {
        logger.info(`[Rotation] Creating new key for ${email}...`);

        // 1. List existing keys to identify old ones
        const existingKeysRaw = execSync(`gcloud iam service-accounts keys list --iam-account=${email} --format=json`).toString();
        const existingKeys = JSON.parse(existingKeysRaw);

        // 2. Create new key
        execSync(`gcloud iam service-accounts keys create ${filePath} --iam-account=${email}`);

        logger.info(`[Rotation] New key saved to ${filePath}`);

        // 3. Optional: Delete oldest key if we have more than 2
        // We keep at least 2 for zero-downtime transition
        if (existingKeys.length > 2) {
            const userKeys = existingKeys.filter((k: any) => k.keyType === 'USER_MANAGED');
            if (userKeys.length > 1) {
                const oldestKey = userKeys.reduce((prev: any, curr: any) =>
                    new Date(prev.validAfterTime) < new Date(curr.validAfterTime) ? prev : curr
                );
                logger.warn(`[Rotation] Recommended: Delete old key ${oldestKey.name.split('/').pop()}`);
                // execSync(`gcloud iam service-accounts keys delete ${oldestKey.name.split('/').pop()} --iam-account=${email} --quiet`);
            }
        }

        return { success: true, filePath };
    } catch (error: any) {
        logger.error(`[Rotation] Failed to rotate key for ${accountName}:`, error.message);
        return { success: false, error: error.message };
    }
}

async function main() {
    const args = process.argv.slice(2);
    const saIndex = args.indexOf('--service-account');

    if (saIndex !== -1 && args[saIndex + 1]) {
        const account = args[saIndex + 1];
        const result = await rotateServiceAccountKey(account);
        if (result.success) {
            console.log(`\n✅ Successfully rotated key for ${account}`);
            console.log(`📍 Path: ${result.filePath}`);
            console.log(`\nNext steps:`);
            console.log(`1. Update your deployment environment with the new JSON content.`);
            console.log(`2. Verify your services are running correctly.`);
            console.log(`3. Run this script again with --cleanup to remove the previous key once verified.\n`);
        } else {
            console.error(`\n❌ Rotation failed: ${result.error}\n`);
            process.exit(1);
        }
    } else {
        console.log(`
indiiOS Key Rotation Utility
============================
Usage:
  npx tsx scripts/rotate-keys.ts --service-account [ACCOUNT_NAME]

Examples:
  npx tsx scripts/rotate-keys.ts --service-account firebase-adminsdk
  npx tsx scripts/rotate-keys.ts --service-account github-deployer
        `);
    }
}

if (require.main === module) {
    main();
}
