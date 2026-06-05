import { z } from "zod";
import * as dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Load env vars from .env file
dotenv.config();

const args = process.argv.slice(2);
const isProd = args.includes("--prod") || process.env.NODE_ENV === "production";

// ANSI colors
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const cyan = "\x1b[36m";
const reset = "\x1b[0m";

// Helper to check required renderer env vars for production
const rendererProdSchema = z.object({
  VITE_API_KEY: z.string().min(1, "Missing VITE_API_KEY (Tuned Agents)"),
  VITE_USE_FINE_TUNED_AGENTS: z.enum(["true", "false"]).refine(val => !isProd || val === "true", {
    message: "VITE_USE_FINE_TUNED_AGENTS must be 'true' in production",
  }).optional(),
  VITE_FUNCTIONS_URL: z.string().url("Missing or invalid VITE_FUNCTIONS_URL").optional().refine(val => !isProd || !!val, {
    message: "Missing VITE_FUNCTIONS_URL"
  }),
  VITE_FUNCTIONS_REGION: z.string().optional().default("us-central1"),
  VITE_REMOTION_GCP_REGION: z.string().optional().default("us-central1"),
  
  // Firebase
  VITE_FIREBASE_API_KEY: z.string().min(1, "Missing VITE_FIREBASE_API_KEY"),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1, "Missing VITE_FIREBASE_PROJECT_ID"),
  VITE_FIREBASE_APP_ID: z.string().min(1, "Missing VITE_FIREBASE_APP_ID"),
  
  // App Check
  VITE_FIREBASE_APP_CHECK_KEY: z.string().min(1, "Missing VITE_FIREBASE_APP_CHECK_KEY").optional().refine(val => !isProd || !!val, {
    message: "Missing VITE_FIREBASE_APP_CHECK_KEY"
  }),

  // Ingestion
  VITE_INGESTION_SYSTEM_IDENTIFIER: z.string().min(1, "Missing VITE_INGESTION_SYSTEM_IDENTIFIER").optional().refine(val => !isProd || !!val, {
    message: "Missing VITE_INGESTION_SYSTEM_IDENTIFIER"
  }),
  VITE_INGESTION_ENTITY_NAME: z.string().min(1, "Missing VITE_INGESTION_ENTITY_NAME").optional().refine(val => !isProd || !!val, {
    message: "Missing VITE_INGESTION_ENTITY_NAME"
  }),
}).refine(data => {
  if (!isProd) return true;
  const region = data.VITE_FUNCTIONS_REGION || "us-central1";
  return data.VITE_FUNCTIONS_URL?.startsWith(`https://${region}-`);
}, {
  message: "VITE_FUNCTIONS_URL must match VITE_FUNCTIONS_REGION",
  path: ["VITE_FUNCTIONS_URL"],
}).refine(data => !isProd || (data.VITE_REMOTION_GCP_REGION || "us-central1") === "us-central1", {
  message: "VITE_REMOTION_GCP_REGION must be us-central1",
  path: ["VITE_REMOTION_GCP_REGION"],
});

// Helper to check Firebase function secrets/env
const backendSecretsSchema = z.object({
  // Social
  SPOTIFY_CLIENT_ID: z.string().min(1).optional(),
  VITE_SPOTIFY_CLIENT_ID: z.string().min(1).optional(),
  SPOTIFY_CLIENT_SECRET: z.string().min(1).optional(),
  VITE_SPOTIFY_CLIENT_SECRET: z.string().min(1).optional(),
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  VITE_TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
  VITE_TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
  META_APP_ID: z.string().min(1).optional(),
  VITE_META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),

  // Legal
  PANDADOC_API_KEY: z.string().min(1).optional(),
  PANDADOC_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Tax/Commerce
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Fan enrichment
  RESEND_API_KEY: z.string().min(1).optional(),

  // Edge/API request protection
  ARCJET_KEY: z.string().startsWith("ajkey_", "Missing or invalid ARCJET_KEY").optional(),

  // Distributor
  VITE_DDEX_DPID_SPOTIFY: z.string().min(1).optional(),

  // POD
  PRINTFUL_API_KEY: z.string().min(1).optional(),
  VITE_PRINTFUL_API_KEY: z.string().min(1).optional(),
}).refine(data => !isProd || (data.SPOTIFY_CLIENT_ID || data.VITE_SPOTIFY_CLIENT_ID), {
  message: "Missing SPOTIFY_CLIENT_ID",
  path: ["SPOTIFY_CLIENT_ID"]
}).refine(data => !isProd || (data.SPOTIFY_CLIENT_SECRET || data.VITE_SPOTIFY_CLIENT_SECRET), {
  message: "Missing SPOTIFY_CLIENT_SECRET",
  path: ["SPOTIFY_CLIENT_SECRET"]
}).refine(data => !isProd || (data.TIKTOK_CLIENT_KEY || data.VITE_TIKTOK_CLIENT_KEY), {
  message: "Missing TIKTOK_CLIENT_KEY",
  path: ["TIKTOK_CLIENT_KEY"]
}).refine(data => !isProd || (data.TIKTOK_CLIENT_SECRET || data.VITE_TIKTOK_CLIENT_SECRET), {
  message: "Missing TIKTOK_CLIENT_SECRET",
  path: ["TIKTOK_CLIENT_SECRET"]
}).refine(data => !isProd || (data.META_APP_ID || data.VITE_META_APP_ID), {
  message: "Missing META_APP_ID",
  path: ["META_APP_ID"]
}).refine(data => !isProd || data.META_APP_SECRET, {
  message: "Missing META_APP_SECRET",
  path: ["META_APP_SECRET"]
}).refine(data => !isProd || data.PANDADOC_API_KEY, {
  message: "Missing PANDADOC_API_KEY",
  path: ["PANDADOC_API_KEY"]
}).refine(data => !isProd || data.PANDADOC_WEBHOOK_SECRET, {
  message: "Missing PANDADOC_WEBHOOK_SECRET",
  path: ["PANDADOC_WEBHOOK_SECRET"]
}).refine(data => !isProd || data.STRIPE_SECRET_KEY, {
  message: "Missing STRIPE_SECRET_KEY",
  path: ["STRIPE_SECRET_KEY"]
}).refine(data => !isProd || data.STRIPE_WEBHOOK_SECRET, {
  message: "Missing STRIPE_WEBHOOK_SECRET",
  path: ["STRIPE_WEBHOOK_SECRET"]
}).refine(data => !isProd || data.RESEND_API_KEY, {
  message: "Missing RESEND_API_KEY",
  path: ["RESEND_API_KEY"]
}).refine(data => !isProd || data.VITE_DDEX_DPID_SPOTIFY, {
  message: "Missing VITE_DDEX_DPID_SPOTIFY",
  path: ["VITE_DDEX_DPID_SPOTIFY"]
}).refine(data => !isProd || (data.PRINTFUL_API_KEY || data.VITE_PRINTFUL_API_KEY), {
  message: "Missing PRINTFUL_API_KEY",
  path: ["PRINTFUL_API_KEY"]
});

console.log(`${cyan}======================================${reset}`);
console.log(`${cyan}    Production Config Preflight Gate  ${reset}`);
console.log(`${cyan}======================================${reset}`);

const processEnv = process.env;
let hasErrors = false;
let hasFatalErrors = false;
const repoRoot = process.cwd();

function readJsonFile(path: string): Record<string, any> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
  } catch {
    return null;
  }
}

function validateReact18Lock(): boolean {
  const expected: Record<string, string> = {
    react: "18.3.1",
    "react-dom": "18.3.1",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
  };
  const packageFiles = [
    "package.json",
    "packages/renderer/package.json",
    "packages/landing/package.json",
    "packages/admin-dashboard/package.json",
  ];
  const errors: string[] = [];

  for (const relativePath of packageFiles) {
    const json = readJsonFile(join(repoRoot, relativePath));
    if (!json) {
      errors.push(`${relativePath}: unreadable package manifest`);
      continue;
    }

    for (const [pkg, version] of Object.entries(expected)) {
      const actual = json.dependencies?.[pkg] ?? json.devDependencies?.[pkg] ?? json.overrides?.[pkg];
      if (actual && actual !== version) {
        errors.push(`${relativePath}: ${pkg} is ${actual}, expected ${version}`);
      }
    }
  }

  const packageLock = readJsonFile(join(repoRoot, "package-lock.json"));
  const lockPackages = packageLock?.packages as Record<string, Record<string, unknown>> | undefined;
  if (lockPackages) {
    for (const [lockPath, meta] of Object.entries(lockPackages)) {
      const name = meta.name ?? lockPath.split("node_modules/").pop();
      const version = meta.version;
      if (typeof name === "string" && name in expected && version !== expected[name]) {
        errors.push(`package-lock.json:${lockPath || "."}: ${name} is ${String(version)}, expected ${expected[name]}`);
      }
    }
  }

  const installedPackageJsons = [
    "node_modules/react/package.json",
    "node_modules/react-dom/package.json",
    "packages/admin-dashboard/node_modules/react/package.json",
    "packages/admin-dashboard/node_modules/react-dom/package.json",
    "packages/renderer/node_modules/react/package.json",
    "packages/renderer/node_modules/react-dom/package.json",
    "packages/landing/node_modules/react/package.json",
    "packages/landing/node_modules/react-dom/package.json",
  ];

  for (const relativePath of installedPackageJsons) {
    const absolutePath = join(repoRoot, relativePath);
    if (!existsSync(absolutePath)) continue;

    const json = readJsonFile(absolutePath);
    const name = json?.name;
    const version = json?.version;
    if (typeof name === "string" && name in expected && version !== expected[name]) {
      errors.push(`${relativePath}: ${name} is ${String(version)}, expected ${expected[name]}`);
    }
  }

  if (errors.length > 0) {
    errors.forEach(error => console.log(`${red}  ❌ ${error}${reset}`));
    return false;
  }

  console.log(`${green}  ✅ React runtime locked to 18.3.1.${reset}`);
  return true;
}

console.log(`\n${cyan}[1/3] Validating React Runtime Lock (React 18.3.1 only)...${reset}`);
if (!validateReact18Lock()) {
  hasErrors = true;
  hasFatalErrors = true;
}

console.log(`\n${cyan}[2/3] Validating Renderer Config (Firebase, App Check, Tuned Agents, Functions)...${reset}`);
const rendererResult = rendererProdSchema.safeParse(processEnv);
if (!rendererResult.success) {
  rendererResult.error.errors.forEach(err => {
    console.log(`${red}  ❌ ${err.path.join('.')}: ${err.message}${reset}`);
  });
  hasErrors = true;
} else {
  console.log(`${green}  ✅ Renderer config validated.${reset}`);
}

console.log(`\n${cyan}[3/3] Validating Function Secrets (Social, Legal, Tax, Fan Enrichment, Distributor, POD)...${reset}`);
const backendResult = backendSecretsSchema.safeParse(processEnv);
if (!backendResult.success) {
  backendResult.error.errors.forEach(err => {
    console.log(`${red}  ❌ ${err.path.join('.')}: ${err.message}${reset}`);
  });
  hasErrors = true;
} else {
  console.log(`${green}  ✅ Backend secrets/env validated.${reset}`);
}

console.log("\n--------------------------------------");
if (hasErrors) {
  if (isProd || hasFatalErrors) {
    console.error(`${red}🚨 FAILED: Required preflight checks failed. Fails closed.${reset}`);
    process.exit(1);
  } else {
    console.warn(`${yellow}⚠️ WARNING: Missing required config. Allowed in Local/Dev mode.${reset}`);
  }
} else {
  console.log(`${green}🚀 READY: All production configurations are present.${reset}`);
}
