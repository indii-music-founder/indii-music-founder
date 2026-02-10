
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { setDoc, doc, getDoc, collection, deleteDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-test-123';
const FIRESTORE_RULES_PATH = path.resolve(__dirname, 'firestore.rules');

describe.skip('Firestore Security Rules: Deployments & Organizations', () => {
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

    describe('Organization Access Control', () => {
        it('should allow member to update organization', async () => {
            const orgId = 'org-update';
            const memberId = 'member-1';
            await setupOrg(orgId, [memberId]);

            const context = testEnv.authenticatedContext(memberId);
            await assertSucceeds(setDoc(doc(context.firestore(), `organizations/${orgId}`), {
                id: orgId,
                name: 'Updated Name',
                members: [memberId]
            }, { merge: true }));
        });

        it('should deny member from deleting organization (CRITICAL FIX)', async () => {
            const orgId = 'org-delete';
            const memberId = 'member-1';
            await setupOrg(orgId, [memberId]);

            const context = testEnv.authenticatedContext(memberId);
            // This MUST fail now due to `allow delete: if false;`
            await assertFails(deleteDoc(doc(context.firestore(), `organizations/${orgId}`)));
        });
    });

    describe('Deployment Access Control', () => {
        const aliceId = 'alice';
        const validDeployment = {
            internalReleaseId: 'rel-1',
            userId: aliceId,
            orgId: 'org-1',
            distributorId: 'dist-1',
            status: 'processing',
            submittedAt: new Date(),
            lastCheckedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        it('should allow owner to read their own deployment', async () => {
            const deploymentId = 'dep-1';
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), `deployments/${deploymentId}`), validDeployment);
            });

            const aliceContext = testEnv.authenticatedContext(aliceId);
            await assertSucceeds(getDoc(doc(aliceContext.firestore(), `deployments/${deploymentId}`)));
        });

        it('should allow owner to create deployment with valid schema', async () => {
            const context = testEnv.authenticatedContext(aliceId);
            await assertSucceeds(setDoc(doc(context.firestore(), 'deployments/new-dep'), {
                ...validDeployment,
                id: 'new-dep'
            }));
        });

        it('should deny creating deployment with missing fields', async () => {
            const context = testEnv.authenticatedContext(aliceId);
            await assertFails(setDoc(doc(context.firestore(), 'deployments/invalid-dep'), {
                userId: aliceId,
                status: 'processing'
            }));
        });
    });

    describe('Distribution Task Access Control', () => {
        const bobId = 'bob';
        const validTask = {
            userId: bobId,
            type: 'QC',
            status: 'PENDING',
            progress: 0,
            title: 'Test Task',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        it('should allow owner to create task', async () => {
            const context = testEnv.authenticatedContext(bobId);
            await assertSucceeds(setDoc(doc(context.firestore(), 'distribution_tasks/task-1'), validTask));
        });

        it('should deny creating task for others', async () => {
            const context = testEnv.authenticatedContext('mallory');
            await assertFails(setDoc(doc(context.firestore(), 'distribution_tasks/task-stolen'), validTask));
        });

        it('should deny creating task with invalid type', async () => {
            const context = testEnv.authenticatedContext(bobId);
            await assertFails(setDoc(doc(context.firestore(), 'distribution_tasks/task-invalid'), {
                ...validTask,
                type: 'INVALID_TYPE'
            }));
        });
    });

    describe('ISRC Registry Access Control', () => {
        const charlieId = 'charlie';
        const validIsrc = {
            isrc: 'US-XXX-23-00001',
            releaseId: 'rel-1',
            userId: charlieId,
            trackTitle: 'Song 1',
            artistName: 'Artist 1',
            assignedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        it('should allow owner to create ISRC with valid format', async () => {
            const context = testEnv.authenticatedContext(charlieId);
            await assertSucceeds(setDoc(doc(context.firestore(), 'isrc_registry/isrc-1'), validIsrc));
        });

        it('should deny creating ISRC with invalid format', async () => {
            const context = testEnv.authenticatedContext(charlieId);
            await assertFails(setDoc(doc(context.firestore(), 'isrc_registry/isrc-bad'), {
                ...validIsrc,
                isrc: 'INVALID-ISRC'
            }));
        });

        it('should deny owner from updating ISRC (IMMUTABILITY)', async () => {
            const docId = 'isrc-immutable';
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), `isrc_registry/${docId}`), validIsrc);
            });

            const context = testEnv.authenticatedContext(charlieId);
            await assertFails(setDoc(doc(context.firestore(), `isrc_registry/${docId}`), {
                ...validIsrc,
                trackTitle: 'New Title'
            }, { merge: true }));
        });
    });

    describe('Tax Profile Access Control', () => {
        const davidId = 'david';
        const validProfile = {
            userId: davidId,
            formType: 'W-9',
            country: 'US',
            tinMasked: '...1234',
            tinValid: true,
            certified: true,
            payoutStatus: 'ACTIVE',
            certTimestamp: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        it('should allow owner to create tax profile', async () => {
            const context = testEnv.authenticatedContext(davidId);
            await assertSucceeds(setDoc(doc(context.firestore(), `tax_profiles/${davidId}`), validProfile));
        });

        it('should deny creating profile for others', async () => {
            const context = testEnv.authenticatedContext('mallory');
            await assertFails(setDoc(doc(context.firestore(), 'tax_profiles/stolen-profile'), validProfile));
        });

        it('should deny deleting tax profile (COMPLIANCE)', async () => {
            const docId = 'tax-doc';
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), `tax_profiles/${docId}`), validProfile);
            });

            const context = testEnv.authenticatedContext(davidId);
            await assertFails(deleteDoc(doc(context.firestore(), `tax_profiles/${docId}`)));
        });
    });
});
