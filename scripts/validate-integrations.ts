#!/usr/bin/env npx ts-node
/**
 * Validate that critical integrations are configured and reachable.
 * This script tests the actual environment setup without using mocks.
 * Run this to diagnose why the app is broken after account separation.
 */

import { getVertexAIClient } from "../packages/firebase/src/lib/vertexClient.js";
import { FUNCTION_INTELLIGENCE_MODELS } from "../packages/firebase/src/config/models.js";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";

interface ValidationResult {
  name: string;
  status: "✓" | "✗" | "⚠";
  message: string;
  details?: string;
}

const results: ValidationResult[] = [];

function log(result: ValidationResult) {
  const color = result.status === "✓" ? GREEN : result.status === "✗" ? RED : YELLOW;
  console.log(`${color}${result.status} ${result.name}${RESET}`);
  if (result.message) console.log(`  ${result.message}`);
  if (result.details) console.log(`  ${result.details}`);
}

async function validateVertexAI() {
  try {
    const ai = getVertexAIClient();
    const response = await ai.models.generateContent({
      model: FUNCTION_INTELLIGENCE_MODELS.TEXT.LITE,
      contents: "Reply with one word to confirm connectivity.",
    });
    if (!response.text?.trim()) throw new Error("Vertex returned no text.");

    log({
      name: "Vertex AI",
      status: "✓",
      message: "Authenticated Vertex text generation succeeded",
    });
  } catch (error) {
    log({
      name: "Vertex AI",
      status: "✗",
      message: "Vertex text generation failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

async function validateFirebase() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH || "./firebase-key.json";

  if (!projectId) {
    log({
      name: "Firebase Project ID",
      status: "✗",
      message: "VITE_FIREBASE_PROJECT_ID not set",
    });
    return;
  }

  if (!fs.existsSync(credentialsPath)) {
    log({
      name: "Firebase Credentials",
      status: "⚠",
      message: "firebase-key.json not found",
      details: `Expected at: ${path.resolve(credentialsPath)}. Backend functions can't authenticate without this.`,
    });
    return;
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));

    if (credentials.project_id !== projectId) {
      log({
        name: "Firebase Credentials",
        status: "✗",
        message: "Credentials project ID doesn't match configured project",
        details: `Credentials: ${credentials.project_id}, Config: ${projectId}`,
      });
      return;
    }

    const app = initializeApp({
      credential: cert(credentials),
      projectId,
    });

    // Test Firestore
    try {
      const db = getFirestore(app);
      await db.collection("_test").doc("_test").get();
      log({
        name: "Firebase Firestore",
        status: "✓",
        message: "Connected and accessible",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log({
        name: "Firebase Firestore",
        status: "✗",
        message: "Cannot access Firestore",
        details: `Error: ${msg}`,
      });
    }

    // Test Storage
    try {
      const storage = getStorage(app);
      const bucketName = `${projectId}.appspot.com`;
      const bucket = storage.bucket(bucketName);
      await bucket.getMetadata();
      log({
        name: "Firebase Storage",
        status: "✓",
        message: `Connected to ${bucketName}`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log({
        name: "Firebase Storage",
        status: "✗",
        message: "Cannot access Storage",
        details: `Error: ${msg}`,
      });
    }
  } catch (error) {
    log({
      name: "Firebase Setup",
      status: "✗",
      message: "Failed to initialize Firebase",
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

async function main() {
  console.log("\n=== indii Integration Validation ===\n");

  console.log("Checking critical integrations...\n");

  await validateVertexAI();
  console.log("");
  await validateFirebase();

  console.log("\n=== Summary ===\n");

  const failures = results.filter((r) => r.status === "✗");
  const warnings = results.filter((r) => r.status === "⚠");
  const passes = results.filter((r) => r.status === "✓");

  console.log(`Passed: ${passes.length}, Warnings: ${warnings.length}, Failed: ${failures.length}\n`);

  if (failures.length > 0) {
    console.log(`${RED}Action required:${RESET}`);
    failures.forEach((f) => console.log(`  • ${f.name}: ${f.message}`));
  }

  if (warnings.length > 0) {
    console.log(`\n${YELLOW}Check these:${RESET}`);
    warnings.forEach((w) => console.log(`  • ${w.name}: ${w.message}`));
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(console.error);
