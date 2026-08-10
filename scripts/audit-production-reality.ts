import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";
import { MODULE_IDS } from "../packages/renderer/src/core/constants";

type Classification =
  | "Implemented"
  | "Structurally Tested"
  | "Runtime-Path Verified"
  | "Production Verified";

interface RuntimeEvidence {
  feature: string;
  deployedSha: string;
  environment: string;
  productionOrigin?: string;
  genuineAccount: string;
  genuineTier: string;
  userAction: string;
  productionEntrypoint: string;
  serviceBackend: string;
  persistenceOrSideEffect: string;
  visibleUserResult: string;
  result: "passed" | "failed" | "blocked";
  observedBuildSha: string;
  evidenceSource: "playwright-production-gate";
  runId: string;
  runUrl: string;
}

const root = process.cwd();
const inventoryOnly = process.argv.includes("--inventory");
const appShellPath = path.join(root, "packages/renderer/src/core/AppShell.tsx");
const appShell = fs.readFileSync(appShellPath, "utf8");
const sourceRoot = path.dirname(appShellPath);
const sourceFile = ts.createSourceFile(
  appShellPath,
  appShell,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const deployedSha = process.env.PRODUCTION_SHA?.trim();
const evidenceFile = process.env.PRODUCTION_REALITY_EVIDENCE_FILE?.trim();
const githubSha = process.env.GITHUB_SHA?.trim();
const githubRunId = process.env.GITHUB_RUN_ID?.trim();
const githubRunUrl =
  githubRunId && process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${githubRunId}`
    : undefined;

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function findVariable(name: string): ts.VariableDeclaration | undefined {
  let result: ts.VariableDeclaration | undefined;
  function visit(node: ts.Node): void {
    if (result) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      result = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return result;
}

function findDynamicImport(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }
  let result: string | undefined;
  ts.forEachChild(node, (child) => {
    result ??= findDynamicImport(child);
  });
  return result;
}

function resolveSource(importPath: string): string | undefined {
  const base = importPath.startsWith("@/")
    ? path.join(root, "packages/renderer/src", importPath.slice(2))
    : path.resolve(sourceRoot, importPath);
  return [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ].find((candidate) => fs.existsSync(candidate));
}

const componentImports = new Map<string, string>();
sourceFile.forEachChild((node) => {
  if (!ts.isVariableStatement(node)) return;
  for (const declaration of node.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) continue;
    const importPath = findDynamicImport(declaration.initializer);
    if (importPath) componentImports.set(declaration.name.text, importPath);
  }
});

const moduleDeclaration = findVariable("MODULE_COMPONENTS");
if (
  !moduleDeclaration?.initializer ||
  !ts.isObjectLiteralExpression(moduleDeclaration.initializer)
) {
  throw new Error(
    "Could not find the MODULE_COMPONENTS object in AppShell.tsx.",
  );
}
const routedComponents = new Map<string, string>();
for (const property of moduleDeclaration.initializer.properties) {
  if (
    !ts.isPropertyAssignment(property) ||
    !ts.isIdentifier(property.initializer)
  )
    continue;
  const id =
    ts.isStringLiteral(property.name) || ts.isIdentifier(property.name)
      ? property.name.text
      : undefined;
  if (id) routedComponents.set(id, property.initializer.text);
}

const testFiles = [
  ...walk(path.join(root, "packages/renderer/src")),
  ...walk(path.join(root, "e2e")),
]
  .filter((file) => /\.(test|spec)\.(ts|tsx)$/.test(file))
  .map((file) => ({
    absolute: file,
    relative: path.relative(root, file),
    content: fs.readFileSync(file, "utf8"),
  }));

const e2eInventory = testFiles
  .filter((file) => file.relative.startsWith(`e2e${path.sep}`))
  .map((file) => ({
    file: file.relative,
    classification: file.content.includes("@live")
      ? "production-candidate"
      : file.content.includes("@external-legacy")
        ? "external-legacy-structural"
        : file.content.includes("@structural")
          ? "structural-explicit"
          : "structural-implicit",
  }));

const forbiddenLiveMarkers = [
  "/fixtures/",
  "fixtures/auth",
  ".route(",
  "routeFromHAR",
  "addInitScript(",
  "addCookies(",
  "storageState",
  "localStorage",
  "sessionStorage",
  "test.extend",
  "TEST_INJECT",
  "FIREBASE_E2E_MOCK",
  "window.useStore",
  "http://localhost",
  "test@indii.music",
  "getIdToken()",
];
const misleadingLive = testFiles
  .filter(
    (file) =>
      file.relative.startsWith(`e2e${path.sep}`) &&
      file.content.includes("@live"),
  )
  .flatMap((file) => {
    const markers = forbiddenLiveMarkers.filter((marker) =>
      file.content.includes(marker),
    );
    return markers.length ? [{ file: file.relative, markers }] : [];
  });
const allowedProductionSuites = new Set([
  path.join("e2e", "evolas-production-reality.spec.ts"),
]);
const unexpectedLiveFiles = e2eInventory.filter(
  (row) =>
    row.classification === "production-candidate" &&
    !allowedProductionSuites.has(row.file),
);

let evidenceCandidates: unknown[] = [];
if (evidenceFile) {
  const parsed = JSON.parse(
    fs.readFileSync(path.resolve(root, evidenceFile), "utf8"),
  ) as unknown;
  if (!Array.isArray(parsed))
    throw new Error("Production-reality evidence must be a JSON array.");
  evidenceCandidates = parsed;
}

const requiredEvidenceFields: Array<keyof RuntimeEvidence> = [
  "feature",
  "deployedSha",
  "environment",
  "genuineAccount",
  "genuineTier",
  "userAction",
  "productionEntrypoint",
  "serviceBackend",
  "persistenceOrSideEffect",
  "visibleUserResult",
  "result",
  "observedBuildSha",
  "evidenceSource",
  "runId",
  "runUrl",
];
function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasFullRuntimeChain(value: unknown): value is RuntimeEvidence {
  return (
    isObjectRecord(value) &&
    requiredEvidenceFields.every(
      (field) =>
        typeof value[field] === "string" && value[field].trim().length > 0,
    ) &&
    (value.result === "passed" ||
      value.result === "failed" ||
      value.result === "blocked") &&
    value.evidenceSource === "playwright-production-gate"
  );
}

function isPlaceholder(value: string): boolean {
  return /^(missing|unverified|unknown|none|n\/a|not[- ]?recorded)$/i.test(
    value.trim(),
  );
}

const malformedEvidence = evidenceCandidates.filter(
  (row) => !hasFullRuntimeChain(row),
);
const evidence = evidenceCandidates.filter(hasFullRuntimeChain);

const audit = MODULE_IDS.map((feature) => {
  const component = routedComponents.get(feature);
  const importPath = component ? componentImports.get(component) : undefined;
  const entrypoint = importPath ? resolveSource(importPath) : undefined;
  const terms = [feature.toLowerCase(), component?.toLowerCase()].filter(
    Boolean,
  ) as string[];
  const structuralEvidence = testFiles
    .filter((file) =>
      terms.some(
        (term) =>
          file.relative.toLowerCase().includes(term) ||
          file.content.toLowerCase().includes(term),
      ),
    )
    .map((file) => file.relative);
  const exactProductionRuntime = evidence.find(
    (row) =>
      row.feature === feature &&
      row.result === "passed" &&
      Boolean(deployedSha) &&
      row.deployedSha === deployedSha &&
      row.environment === "production" &&
      row.productionOrigin === "https://indii.music" &&
      row.observedBuildSha === deployedSha &&
      row.evidenceSource === "playwright-production-gate" &&
      process.env.CI === "true" &&
      githubSha === deployedSha &&
      row.runId === githubRunId &&
      row.runUrl === githubRunUrl &&
      !requiredEvidenceFields.some((field) =>
        isPlaceholder(String(row[field])),
      ) &&
      row.productionEntrypoint ===
        (entrypoint ? path.relative(root, entrypoint) : ""),
  );
  const runtime =
    exactProductionRuntime ??
    evidence.find((row) => row.feature === feature && row.result === "passed");
  const isExactProductionEvidence = Boolean(exactProductionRuntime);
  const classification: Classification = isExactProductionEvidence
    ? "Production Verified"
    : runtime
      ? "Runtime-Path Verified"
      : structuralEvidence.length > 0
        ? "Structurally Tested"
        : "Implemented";

  return {
    feature,
    component: component ?? "MISSING",
    productionEntrypoint: entrypoint
      ? path.relative(root, entrypoint)
      : "MISSING",
    classification,
    structuralEvidence,
    runtimeEvidence: runtime ?? null,
    remainingGap:
      classification === "Production Verified"
        ? null
        : "No passing full-chain evidence for this exact SHA on https://indii.music with a genuine account and tier.",
  };
});

const report = {
  deployedSha: deployedSha ?? null,
  evidenceFile: evidenceFile ?? null,
  audit,
  e2eInventory,
  misleadingLive,
  unexpectedLiveFiles,
  malformedEvidence,
};
if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log("Feature\tClassification\tEntrypoint\tRemaining gap");
  for (const row of audit) {
    console.log(
      `${row.feature}\t${row.classification}\t${row.productionEntrypoint}\t${row.remainingGap ?? "none"}`,
    );
  }
}

const missingEntrypoints = audit.filter(
  (row) => row.productionEntrypoint === "MISSING",
);
const notProductionVerified = audit.filter(
  (row) => row.classification !== "Production Verified",
);
if (
  !inventoryOnly &&
  (!deployedSha ||
    !evidenceFile ||
    missingEntrypoints.length > 0 ||
    misleadingLive.length > 0 ||
    unexpectedLiveFiles.length > 0 ||
    malformedEvidence.length > 0 ||
    notProductionVerified.length > 0)
) {
  console.error(
    `Production-reality gate failed: sha=${deployedSha ?? "missing"}, evidence=${evidenceFile ?? "missing"}, ` +
      `missingEntrypoints=${missingEntrypoints.length}, misleadingLive=${misleadingLive.length}, ` +
      `unexpectedLiveFiles=${unexpectedLiveFiles.length}, ` +
      `malformedEvidence=${malformedEvidence.length}, unverifiedFeatures=${notProductionVerified.length}.`,
  );
  process.exitCode = 1;
}
