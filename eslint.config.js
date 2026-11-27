import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Effect-TS safety and idiom rules adapted from mikearnaldi/accountability.
 */
const effectLocalPlugin = {
    rules: {
        'no-disable-validation': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow disableValidation: true in Schema operations' },
                messages: {
                    noDisableValidation:
                        'Do not use { disableValidation: true }. Fix the data or schema instead of disabling Schema validation.',
                },
                schema: [],
            },
            create(context) {
                return {
                    Property(node) {
                        const isKey =
                            node.key &&
                            ((node.key.type === 'Identifier' && node.key.name === 'disableValidation') ||
                                (node.key.type === 'Literal' && node.key.value === 'disableValidation'));
                        if (isKey && node.value && node.value.type === 'Literal' && node.value.value === true) {
                            context.report({ node, messageId: 'noDisableValidation' });
                        }
                    },
                };
            },
        },
        'prefer-option-from-nullable': {
            meta: {
                type: 'suggestion',
                docs: { description: 'Prefer Option.fromNullishOr (or Option.fromNullOr) over ternary with Option.some/none' },
                messages: {
                    preferFromNullable:
                        'Use Option.fromNullishOr({{name}}) (or Option.fromNullOr) instead of ternary with Option.some/Option.none.',
                },
                schema: [],
            },
            create(context) {
                const sourceCode = context.sourceCode ?? context.getSourceCode();
                return {
                    ConditionalExpression(node) {
                        const { test, consequent, alternate } = node;
                        if (test.type !== 'BinaryExpression') return;
                        if (test.operator !== '!==' && test.operator !== '!=') return;

                        let testedName = null;
                        const extractTested = (expr) => {
                            if (expr.type === 'Identifier') return expr.name;
                            if (expr.type === 'MemberExpression') return sourceCode.getText(expr);
                            return null;
                        };
                        if (test.right.type === 'Literal' && test.right.value === null) {
                            testedName = extractTested(test.left);
                        } else if (test.left.type === 'Literal' && test.left.value === null) {
                            testedName = extractTested(test.right);
                        }
                        if (!testedName) return;

                        if (consequent.type !== 'CallExpression') return;
                        const conseqCallee = consequent.callee;
                        const isOptionSome =
                            conseqCallee.type === 'MemberExpression' &&
                            conseqCallee.object.type === 'Identifier' &&
                            conseqCallee.object.name === 'Option' &&
                            conseqCallee.property.type === 'Identifier' &&
                            conseqCallee.property.name === 'some';
                        if (!isOptionSome) return;

                        if (alternate.type !== 'CallExpression') return;
                        const altCallee = alternate.callee;
                        const innerAlt =
                            altCallee.type === 'TSInstantiationExpression' ? altCallee.expression : altCallee;
                        const isOptionNone =
                            innerAlt.type === 'MemberExpression' &&
                            innerAlt.object.type === 'Identifier' &&
                            innerAlt.object.name === 'Option' &&
                            innerAlt.property.type === 'Identifier' &&
                            innerAlt.property.name === 'none';
                        if (!isOptionNone) return;

                        context.report({
                            node,
                            messageId: 'preferFromNullable',
                            data: { name: testedName },
                        });
                    },
                };
            },
        },
        'pipe-max-arguments': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow .pipe() with more than 20 arguments' },
                messages: {
                    tooManyArgs:
                        '.pipe() has {{count}} arguments. Split into multiple .pipe() calls for readability (max 20).',
                },
                schema: [],
            },
            create(context) {
                return {
                    CallExpression(node) {
                        const callee = node.callee;
                        if (
                            callee.type === 'MemberExpression' &&
                            callee.property.type === 'Identifier' &&
                            callee.property.name === 'pipe' &&
                            node.arguments.length > 20
                        ) {
                            context.report({
                                node,
                                messageId: 'tooManyArgs',
                                data: { count: String(node.arguments.length) },
                            });
                        }
                    },
                };
            },
        },
        'no-effect-asvoid': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow Effect.asVoid - it is usually unnecessary' },
                messages: {
                    noEffectAsVoid:
                        'Effect.asVoid is usually unnecessary because void allows any return value in Effect.',
                },
                schema: [],
            },
            create(context) {
                return {
                    MemberExpression(node) {
                        if (
                            node.object.type === 'Identifier' &&
                            node.object.name === 'Effect' &&
                            node.property.type === 'Identifier' &&
                            node.property.name === 'asVoid'
                        ) {
                            context.report({ node, messageId: 'noEffectAsVoid' });
                        }
                    },
                };
            },
        },
        'no-effect-ignore': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow Effect.ignore - errors should be explicitly handled' },
                messages: {
                    noEffectIgnore:
                        'Do not use Effect.ignore. Handle errors explicitly with Effect.catchTag, Effect.catch, or propagate them.',
                },
                schema: [],
            },
            create(context) {
                return {
                    MemberExpression(node) {
                        if (
                            node.object.type === 'Identifier' &&
                            node.object.name === 'Effect' &&
                            node.property.type === 'Identifier' &&
                            node.property.name === 'ignore'
                        ) {
                            context.report({ node, messageId: 'noEffectIgnore' });
                        }
                    },
                };
            },
        },
        'no-effect-catchallcause': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow Effect.catchAllCause / Effect.catchCause' },
                messages: {
                    noEffectCatchAllCause:
                        'Do not use Effect.catchAllCause or Effect.catchCause. They catch defects (bugs). Handle expected errors with Effect.catch or Effect.catchTag.',
                },
                schema: [],
            },
            create(context) {
                return {
                    MemberExpression(node) {
                        if (
                            node.object.type === 'Identifier' &&
                            node.object.name === 'Effect' &&
                            node.property.type === 'Identifier' &&
                            (node.property.name === 'catchAllCause' || node.property.name === 'catchCause')
                        ) {
                            context.report({ node, messageId: 'noEffectCatchAllCause' });
                        }
                    },
                };
            },
        },
        'no-silent-error-swallow': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow catch handlers that silently swallow errors by returning Effect.void' },
                messages: {
                    noSilentSwallow:
                        "Do not silently swallow errors with '() => Effect.void'. Propagate, transform with mapError, or recover meaningfully.",
                },
                schema: [],
            },
            create(context) {
                const isEffectVoidOrUnit = (node) =>
                    Boolean(
                        node &&
                            node.type === 'MemberExpression' &&
                            node.object.type === 'Identifier' &&
                            node.object.name === 'Effect' &&
                            node.property.type === 'Identifier' &&
                            (node.property.name === 'void' || node.property.name === 'unit')
                    );

                const isVoidReturningHandler = (node) => {
                    if (!node) return false;
                    if (node.type === 'ArrowFunctionExpression') {
                        if (isEffectVoidOrUnit(node.body)) return true;
                        if (node.body.type === 'BlockStatement') {
                            const body = node.body.body;
                            if (body.length === 1 && body[0].type === 'ReturnStatement') {
                                return isEffectVoidOrUnit(body[0].argument);
                            }
                        }
                    }
                    if (node.type === 'FunctionExpression') {
                        const body = node.body.body;
                        if (body.length === 1 && body[0].type === 'ReturnStatement') {
                            return isEffectVoidOrUnit(body[0].argument);
                        }
                    }
                    return false;
                };

                const getCatchType = (node) => {
                    if (node.type !== 'CallExpression') return null;
                    const callee = node.callee;
                    if (
                        callee.type === 'MemberExpression' &&
                        callee.object.type === 'Identifier' &&
                        callee.object.name === 'Effect' &&
                        callee.property.type === 'Identifier'
                    ) {
                        const propName = callee.property.name;
                        if (
                            propName === 'catchTag' ||
                            propName === 'catchAll' ||
                            propName === 'catch' ||
                            propName === 'catchTags'
                        ) {
                            return propName;
                        }
                    }
                    return null;
                };

                return {
                    CallExpression(node) {
                        const catchType = getCatchType(node);
                        if (!catchType) return;

                        if (catchType === 'catchTags' && node.arguments.length >= 1) {
                            const obj = node.arguments[0];
                            if (obj.type === 'ObjectExpression') {
                                for (const prop of obj.properties) {
                                    if (prop.type === 'Property' && isVoidReturningHandler(prop.value)) {
                                        context.report({ node: prop.value, messageId: 'noSilentSwallow' });
                                    }
                                }
                            }
                            return;
                        }

                        const handlerArg =
                            catchType === 'catchTag' && node.arguments.length >= 2
                                ? node.arguments[1]
                                : (catchType === 'catchAll' || catchType === 'catch') && node.arguments.length >= 1
                                  ? node.arguments[0]
                                  : null;

                        if (handlerArg && isVoidReturningHandler(handlerArg)) {
                            context.report({ node: handlerArg, messageId: 'noSilentSwallow' });
                        }
                    },
                };
            },
        },
        'no-service-option': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow Effect.serviceOption - services should always be in context' },
                messages: {
                    noServiceOption:
                        'Do not use Effect.serviceOption. Yield the service directly and provide it in your layer composition.',
                },
                schema: [],
            },
            create(context) {
                return {
                    CallExpression(node) {
                        const callee = node.callee;
                        if (
                            callee.type === 'MemberExpression' &&
                            callee.object.type === 'Identifier' &&
                            callee.object.name === 'Effect' &&
                            callee.property.type === 'Identifier' &&
                            callee.property.name === 'serviceOption'
                        ) {
                            context.report({ node, messageId: 'noServiceOption' });
                        }
                    },
                };
            },
        },
        'no-nested-layer-provide': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow nested Layer.provide calls' },
                messages: {
                    nestedProvide:
                        'Nested Layer.provide detected. Extract the inner Layer.provide to a separate variable or use Layer.provideMerge.',
                },
                schema: [],
            },
            create(context) {
                const isLayerProvide = (node) => {
                    if (!node || node.type !== 'CallExpression') return false;
                    const callee = node.callee;
                    return (
                        callee.type === 'MemberExpression' &&
                        callee.object.type === 'Identifier' &&
                        callee.object.name === 'Layer' &&
                        callee.property.type === 'Identifier' &&
                        callee.property.name === 'provide'
                    );
                };

                return {
                    CallExpression(node) {
                        if (!isLayerProvide(node)) return;
                        for (const arg of node.arguments) {
                            if (isLayerProvide(arg)) {
                                context.report({ node: arg, messageId: 'nestedProvide' });
                            }
                        }
                    },
                };
            },
        },
    },
};

export default tseslint.config(
    { ignores: ['dist', 'node_modules', 'repos/**', 'src/_archive_legacy', '**/dist-electron', '**/dist', '**/.next', '**/.turbo', '**/out', 'landing-page/**', 'functions/lib/**', '.claude/**', '.agent/**', 'scripts/**'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'effect-local': effectLocalPlugin,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            '@typescript-eslint/no-explicit-any': 'warn',
            // Unused vars: 'warn' — flags dead code without blocking CI.
            // Prefix with _ to intentionally suppress (e.g. _unused, _event).
            // TODO: Promote to 'error' after cleaning up ~261 existing violations.
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
                destructuredArrayIgnorePattern: '^_',
                ignoreRestSiblings: true,
            }],
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/ban-ts-comment': 'warn',
            'effect-local/no-disable-validation': 'error',
            'effect-local/prefer-option-from-nullable': 'error',
            'effect-local/pipe-max-arguments': 'error',
            'effect-local/no-effect-asvoid': 'error',
            'effect-local/no-effect-ignore': 'error',
            'effect-local/no-effect-catchallcause': 'error',
            'effect-local/no-silent-error-swallow': 'error',
            'effect-local/no-service-option': 'error',
            'effect-local/no-nested-layer-provide': 'error',
        },
    },
    // Test files, Cloud Functions, and Electron: relax no-explicit-any
    // Tests use mocks/stubs, Functions use Express/Admin SDK generics, Electron uses IPC bridge types
    {
        files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'functions/**/*.{ts,tsx}', 'electron/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
        // Phase 4 guard (REMOTE_EXECUTOR_CORE_PLAN): the executor Core must
        // stay host-portable — no DOM/browser globals in the class or contract
        // files. Host bindings live in studioExecutorCore.wiring.ts instead.
        files: ['**/services/remote/StudioExecutorCore.ts', '**/services/remote/studioExecutorContracts.ts'],
        rules: {
            'no-restricted-globals': ['error', 'document', 'window'],
        },
    },
    {
        // Refactor P1-B guardrail: flag direct Firebase SDK imports inside
        // renderer React components so P2 can migrate them to services/hooks.
        files: ['packages/renderer/src/**/*.tsx'],
        ignores: ['**/*.test.tsx', '**/*.spec.tsx', '**/__tests__/**'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    paths: [
                        'firebase/firestore',
                        'firebase/storage',
                        'firebase/functions',
                        'firebase/auth',
                        'firebase/database',
                    ].map((name) => ({
                        name,
                        message:
                            'UI components must not call the Firebase SDK directly; use a *Service.ts or hook (refactor P2).',
                    })),
                },
            ],
        },
    },
    {
        // Refactor P1-C guardrail: enforce @/ and @shared/ path aliases in renderer.
        // Cross-package test importing firebase helper is narrowly exempted.
        files: ['packages/renderer/src/**/*.{ts,tsx}'],
        ignores: ['packages/renderer/src/services/intelligence/billing/estimateAgentStreamCost.test.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['./*', '../*'],
                            message: 'Use @/ or @shared/ path aliases instead of relative imports (refactor P1-C).',
                        },
                    ],
                },
            ],
        },
    }
);
