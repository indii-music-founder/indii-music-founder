
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { setDoc, doc, getDoc, collection } from 'firebase/firestore';

const PROJECT_ID = 'indiios-platinum-test';
const FIRESTORE_RULES_PATH = path.resolve(__dirname, 'firestore.rules');

describe('Firestore Security Rules: Deployments', () => {
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
        const rules = fs.readFileSync(FIRESTORE_RULES_PATH, 'utf8');
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                rules,
                host: '127.0.0.1',
                port: 8080
            }
        });
    });

    afterAll(async () => {
        if (testEnv) await testEnv.cleanup();
    });

    beforeEach(async () => {
        if (testEnv) await testEnv.clearFirestore();
    });

    // Helper to setup an organization
    async function setupOrg(orgId: string, memberUids: string[]) {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await setDoc(doc(db, `organizations/${orgId}`), {
                id: orgId,
                name: 'Test Org',
                members: memberUids
            });
        });
    }

    describe('Access Control', () => {
        it('should allow owner to read their own deployment', async () => {
            const aliceId = 'alice';
            const deploymentId = 'dep-1';

            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), `deployments/${deploymentId}`), {
                    id: deploymentId,
                    userId: aliceId,
                    orgId: 'some-org',
                    status: 'processing'
                });
            });

            const aliceContext = testEnv.authenticatedContext(aliceId);
            await assertSucceeds(getDoc(doc(aliceContext.firestore(), `deployments/${deploymentId}`)));
        });

        it('should allow org member to read shared deployment', async () => {
            const aliceId = 'alice';
            const bobId = 'bob';
            const orgId = 'org-123';
            const deploymentId = 'dep-shared';

            await setupOrg(orgId, [aliceId, bobId]);

            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), `deployments/${deploymentId}`), {
                    id: deploymentId,
                    userId: aliceId,
                    orgId: orgId,
                    status: 'processing'
                });
            });

            const bobContext = testEnv.authenticatedContext(bobId);
            await assertSucceeds(getDoc(doc(bobContext.firestore(), `deployments/${deploymentId}`)));
        });

        it('should deny non-member to read deployment', async () => {
            const aliceId = 'alice';
            const malloryId = 'mallory';
            const orgId = 'org-123';
            const deploymentId = 'dep-private';

            await setupOrg(orgId, [aliceId]);

            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), `deployments/${deploymentId}`), {
                    id: deploymentId,
                    userId: aliceId,
                    orgId: orgId,
                    status: 'processing'
                });
            });

            const malloryContext = testEnv.authenticatedContext(malloryId);
            await assertFails(getDoc(doc(malloryContext.firestore(), `deployments/${deploymentId}`)));
        });

        it('should allow owner to create deployment', async () => {
            const userId = 'user-1';
            const context = testEnv.authenticatedContext(userId);

            await assertSucceeds(setDoc(doc(context.firestore(), 'deployments/new-dep'), {
                id: 'new-dep',
                userId: userId,
                orgId: 'any-org',
                status: 'processing'
            }));
        });

        it('should allow org member to create deployment for their org', async () => {
            const bobId = 'bob';
            const orgId = 'org-123';
            await setupOrg(orgId, [bobId]);

            const context = testEnv.authenticatedContext(bobId);
            await assertSucceeds(setDoc(doc(context.firestore(), 'deployments/org-dep'), {
                id: 'org-dep',
                userId: 'different-user', // Member can create for org even if not owner (though logically they'd be owner)
                orgId: orgId,
                status: 'processing'
            }));
        });

        it('should deny creating deployment with someone else userId and no org access', async () => {
            const malloryId = 'mallory';
            const aliceId = 'alice';
            const context = testEnv.authenticatedContext(malloryId);

            await assertFails(setDoc(doc(context.firestore(), 'deployments/stolen-dep'), {
                id: 'stolen-dep',
                userId: aliceId,
                orgId: 'private-org',
                status: 'processing'
            }));
        });
    });
});
