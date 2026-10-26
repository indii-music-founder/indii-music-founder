import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const guardNames = new Set(['protectCallableRequest', 'protectAuthenticatedApiRequest', 'protectAnonymousSignupRequest']);
const triggerNames = new Set(['onCall', 'onRequest', 'defineCallable', 'defineHttps']);

/** Static evidence only: a referenced guard is not proof that all paths enforce it. */
export function inspectSource(source, path) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const locals = new Map();
  const guards = new Set();
  const secrets = new Set();
  const triggers = new Map();
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) locals.set(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) locals.set(declaration.name.text, declaration.initializer);
      }
    }
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements) {
      const imported = binding.propertyName?.text ?? binding.name.text;
      if (module.endsWith('/security/arcjet') || module.endsWith('/security/arcjet.js')) {
        if (guardNames.has(imported)) guards.add(binding.name.text);
      }
      if (/\/config\/secrets(?:\.js)?$/.test(module) && imported === 'arcjetKey') secrets.add(binding.name.text);
      if ((module.startsWith('firebase-functions') || /(?:^|\/)factory(?:\.js)?$/.test(module)) && triggerNames.has(imported)) {
        triggers.set(binding.name.text, imported);
      }
    }
  }
  function evidence(node, names, seen = new Set()) {
    if (!node) return false;
    if (ts.isIdentifier(node) && locals.has(node.text) && !seen.has(node.text)) {
      const next = new Set(seen).add(node.text);
      if (evidence(locals.get(node.text), names, next)) return true;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) return true;
    return ts.forEachChild(node, child => evidence(child, names, seen)) === true;
  }
  function secretEvidence(node, seen = new Set()) {
    if (!node) return false;
    if (ts.isIdentifier(node)) {
      if (secrets.has(node.text)) return true;
      if (locals.has(node.text) && !seen.has(node.text)) return secretEvidence(locals.get(node.text), new Set(seen).add(node.text));
    }
    if (ts.isStringLiteral(node) && node.text === 'ARCJET_KEY') return true;
    return ts.forEachChild(node, child => secretEvidence(child, seen)) === true;
  }
  function optionEvidence(node, seen = new Set()) {
    if (!node) return false;
    if (ts.isIdentifier(node) && locals.has(node.text) && !seen.has(node.text)) {
      return optionEvidence(locals.get(node.text), new Set(seen).add(node.text));
    }
    if (ts.isObjectLiteralExpression(node)) {
      return node.properties.some(property => {
        if (ts.isSpreadAssignment(property)) return optionEvidence(property.expression, seen);
        return ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
          property.name.text === 'secrets' && secretEvidence(property.initializer);
      });
    }
    return false;
  }
  const rows = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
      // Namespace/v1 chains are retained conservatively even when the import cannot be resolved.
      const trigger = triggers.get(name) ?? (['onCall', 'onRequest'].includes(name) ? name : undefined);
      if (trigger) {
        const owner = ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(file) : '(factory/helper)';
        const options = node.arguments.length > 1 ? node.arguments[0] : undefined;
        rows.push({ path, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, owner, trigger,
          secret: optionEvidence(options), guard: evidence(node.arguments.at(-1), guards) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return rows;
}

export function collectInventory(root) {
  const base = join(root, 'packages/firebase/src');
  const rows = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (['__tests__', 'node_modules', 'dist'].includes(entry.name) && entry.isDirectory()) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts') && !/\.(test|spec|d)\.ts$/.test(entry.name)) {
        rows.push(...inspectSource(readFileSync(path, 'utf8'), relative(base, path).split('\\').join('/')));
      }
    }
  }
  walk(base);
  return rows;
}

export function renderInventory(rows) {
  const both = rows.filter(row => row.secret && row.guard).length;
  return `# Arcjet Protection Inventory (ISSUE-1244 / ISSUE-1543)

Generated from current source with \`npm run inventory:arcjet\`. Check freshness with \`npm run check:arcjet-inventory\`.

This replaces the earlier blanket compliance claim. **No row is a runtime protection certification.**

- Trigger declarations: **${rows.length}** across **${new Set(rows.map(row => row.path)).size}** source files.
- Declarations with both a local guard-call reference and an ARCJET_KEY option reference: **${both}**.
- Declarations missing at least one of those local references: **${rows.length - both}**. These require review; absence of local evidence does not prove the absence of imported middleware.

Scope: non-test TypeScript under \`packages/firebase/src\`; \`onCall\`, \`onRequest\` (including namespace/v1 chains) and imported \`defineCallable\` / \`defineHttps\` wrappers. Factory declarations are included and labeled. Event triggers are outside this HTTP inventory; that exclusion makes no IAM or caller-authentication guarantee. This is a source inventory, not a deployed export list.

Evidence rules: inspect each trigger's options and callback, following same-file variable/function references. Guard references must be calls to imported Arcjet helpers; comments, strings and unused imports do not qualify. Secret references must occur within options (following same-file constants), not merely elsewhere in the file. Imported callbacks/options, dynamic factories, control-flow dominance, denial handling, policy selection, deployed secret versions, and live decisions require separate review. A local call reference can be conditional or unreachable and is **not** proof that every request is admitted correctly.

ISSUE-1543 remains open: endpoint admission gaps, device-bound App Check, verified executor enrollment, deployed configuration, and genuine acceptance remain separate requirements. Changes to this inventory cannot close them.

| Source (relative to packages/firebase/src) | Declaration | Trigger | ARCJET_KEY option reference | Local guard-call reference |
|---|---|---|---|---|
${rows.map(row => `| \`${row.path}:${row.line}\` | \`${row.owner}\` | \`${row.trigger}\` | ${row.secret ? 'Present' : 'Not established'} | ${row.guard ? 'Present' : 'Not established'} |`).join('\n')}
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const output = join(root, 'docs/ARCJET_PROTECTION_MATRIX.md');
  const rendered = renderInventory(collectInventory(root));
  if (process.argv.includes('--write')) {
    writeFileSync(output, rendered);
    console.log('Updated Arcjet source inventory; runtime coverage remains unverified.');
  } else if (readFileSync(output, 'utf8') !== rendered) {
    console.error('Arcjet source inventory is stale. Run npm run inventory:arcjet and review the evidence changes.');
    process.exitCode = 1;
  } else console.log('Arcjet source inventory matches current trigger evidence.');
}
