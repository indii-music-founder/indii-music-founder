
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function checkEnv(filePath, name) {
    if (fs.existsSync(filePath)) {
        const config = dotenv.parse(fs.readFileSync(filePath));
        console.log(`[${name}] VITE_VERTEX_PROJECT_ID:`, config.VITE_VERTEX_PROJECT_ID);
        if (config.VITE_VERTEX_PROJECT_ID !== 'indiios-v-1-1') {
            console.error(`[FAIL] ${name} incorrect project ID.`);
        } else {
            console.log(`[PASS] ${name} correct.`);
        }
    } else {
        console.warn(`[WARN] ${name} file not found.`);
    }
}

checkEnv(path.join(process.cwd(), '.env'), 'Root .env');
checkEnv(path.join(process.cwd(), 'functions/.env'), 'Functions .env');

const configTs = fs.readFileSync(path.join(process.cwd(), 'functions/src/config.ts'), 'utf8');
if (configTs.includes("default('indiios-v-1-1')")) {
    console.log('[PASS] functions/src/config.ts default updated.');
} else {
    console.error('[FAIL] functions/src/config.ts default NOT updated.');
}
