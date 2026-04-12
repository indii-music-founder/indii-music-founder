import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'node_modules', 'src/_archive_legacy', '**/dist-electron', '**/dist', '**/.next', '**/.turbo', '**/out', 'landing-page/**', 'functions/lib/**', '.claude/**', '.agent/**', 'scripts/**'] },
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
);
