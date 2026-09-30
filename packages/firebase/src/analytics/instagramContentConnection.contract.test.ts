import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

// Structural contract checks only: no simulated Meta responses, credentials,
// or persisted accounts. A genuine OAuth journey is still required for live proof.
const source = ts.createSourceFile(
    'platformTokenExchange.ts',
    readFileSync(new URL('./platformTokenExchange.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
);
const persistence = source.statements.find(
    (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node)
        && node.name?.text === 'storeInstagramConnection',
);

describe('Instagram content connection persistence contract (structural)', () => {
    it('only persists the authorized token, without requiring a messaging subscription', () => {
        expect(persistence?.body).toBeDefined();
        const statements = persistence!.body!.statements;
        expect(statements).toHaveLength(1);
        expect(ts.isExpressionStatement(statements[0])).toBe(true);
        const expression = (statements[0] as ts.ExpressionStatement).expression;
        expect(ts.isAwaitExpression(expression)).toBe(true);
        const call = (expression as ts.AwaitExpression).expression as ts.CallExpression;
        expect(ts.isCallExpression(call)).toBe(true);
        expect(call.expression.getText(source)).toBe('storeToken');
        expect(call.arguments[0].getText(source)).toBe('uid');
        expect(call.arguments[1].getText(source)).toBe("'instagram'");
        expect(call.arguments[2].getText(source)).toContain('accessToken: connection.accessToken');
        expect(call.arguments[2].getText(source)).toContain('igUserId: connection.igUserId');
        expect(call.arguments[2].getText(source)).toContain('facebookPageId: connection.facebookPageId');
    });

    it('uses the same content-only persistence for direct and Page-selection completion', () => {
        const callers: string[] = [];
        for (const statement of source.statements) {
            if (!ts.isVariableStatement(statement)) continue;
            for (const declaration of statement.declarationList.declarations) {
                const visit = (node: ts.Node): void => {
                    if (ts.isCallExpression(node)
                        && node.expression.getText(source) === 'storeInstagramConnection') {
                        callers.push(declaration.name.getText(source));
                    }
                    ts.forEachChild(node, visit);
                };
                visit(declaration);
            }
        }
        expect(callers.sort()).toEqual([
            'analyticsExchangeToken', 'analyticsFinalizeInstagramConnection',
        ]);
    });
});
