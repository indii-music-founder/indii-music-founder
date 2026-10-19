/** Structural authorization tests against the local emulator; no customer journey evidence. */
import { afterAll, beforeAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let environment: RulesTestEnvironment;
const projection = 'registrations/rights-owner/tracks/track-1/orgs/loc/filings/filing-1';
describe('rights server-authoritative security boundaries', () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({ projectId: 'demo-rights-rules', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('packages/firebase/firestore.rules', 'utf8') } });
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), projection), { filingId: 'filing-1', filingState: 'outcome_unknown' });
      await setDoc(doc(context.firestore(), 'users/rights-owner/rightsCases/case-1'), { ownerUid: 'rights-owner' });
    });
  });
  afterAll(async () => { await environment?.cleanup(); });
  const owner = () => environment.authenticatedContext('rights-owner', { email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  it('allows the owner to read a group-track projection', async () => { await assertSucceeds(getDoc(doc(owner(), projection))); });
  it('denies another account and unauthenticated readers', async () => {
    await assertFails(getDoc(doc(environment.authenticatedContext('other-owner').firestore(), projection)));
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), projection)));
  });
  it('denies forged projection creation and updates even by the owner', async () => {
    await assertFails(setDoc(doc(owner(), projection + '-forged'), { filingState: 'registered' }));
    await assertFails(updateDoc(doc(owner(), projection), { filingState: 'registered' }));
  });
  it('keeps filing evidence, session secrets and one-use tickets server-only for writes', async () => {
    for (const path of ['users/rights-owner/rightsFilings/filing-1', 'users/rights-owner/rightsFilings/filing-1/evidence/receipt-1', 'users/rights-owner/rightsSessions/session-1', 'rightsConnectionTickets/ticket-1', 'users/rights-owner/rightsCwrWorkCodes/work-1', 'users/rights-owner/rightsSocietyOutcomes/outcome-1', 'users/rights-owner/rightsSubmitterProfiles/the_mlc', 'users/rights-owner/rightsSocietyOnboarding/the_mlc', 'users/rights-owner/rightsCwrBatches/batch-1', 'users/rights-owner/rightsCwrBatches/batch-1/transactions/transaction-1', 'users/rights-owner/rightsCwrBatches/batch-1/decisions/decision-1']) {
      await assertFails(setDoc(doc(owner(), path), { ownerUid: 'rights-owner', state: 'registered' }));
    }
  });
  it('keeps private receiver credentials unreadable and outcomes owner-only', async () => {
    await assertFails(getDoc(doc(owner(), 'users/rights-owner/rightsSubmitterProfiles/the_mlc')));
    await assertSucceeds(getDoc(doc(owner(), 'users/rights-owner/rightsSocietyOutcomes/outcome-1')));
    await assertFails(getDoc(doc(environment.authenticatedContext('other-owner').firestore(), 'users/rights-owner/rightsSocietyOutcomes/outcome-1')));
  });
  it('keeps saved cases owner-readable and immutable to clients', async () => {
    await assertSucceeds(getDoc(doc(owner(), 'users/rights-owner/rightsCases/case-1')));
    await assertFails(updateDoc(doc(owner(), 'users/rights-owner/rightsCases/case-1'), { ownerUid: 'other-owner' }));
  });
});
