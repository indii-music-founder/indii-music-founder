import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';

vi.unmock('firebase/firestore');

import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { createConnection } from 'net';
import { resolve } from 'path';

const PROJECT_ID = 'indii-os-rules-test';
const ALICE_UID = 'alice-entry-command';
const BOB_UID = 'bob-entry-command';
const ORG_ID = 'org-entry-command';
const EMULATOR_HOST = 'localhost';
const EMULATOR_PORT = 8080;

describe('Entry command Firestore rules emulator coverage', () => {
  let testEnv: RulesTestEnvironment | null = null;
  let emulatorAvailable = false;

  beforeAll(async () => {
    emulatorAvailable = await checkEmulatorAvailable();
    if (!emulatorAvailable) return;

    const rules = readFileSync(resolve(process.cwd(), 'packages/firebase/firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules, host: EMULATOR_HOST, port: EMULATOR_PORT },
    });
  });

  beforeEach(async () => {
    if (!testEnv) return;
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'organizations', ORG_ID), {
        name: 'Entry Command Org',
        members: [ALICE_UID],
        ownerId: ALICE_UID,
      });
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it('allows owners to create user-scoped custom commands and blocks cross-user reads', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();

    // Guard against accidentally using the renderer Firestore mock instead of rules-unit testing.
    await assertFails(setDoc(doc(aliceDb, 'unlistedEntryCommandProbe', 'probe'), { ok: true }));

    await assertSucceeds(setDoc(
      doc(aliceDb, 'entryCommands', `${ALICE_UID}_custom-shirt`),
      buildCommand({ ownerId: ALICE_UID, scope: 'user' })
    ));

    await assertSucceeds(getDoc(doc(aliceDb, 'entryCommands', `${ALICE_UID}_custom-shirt`)));
    await assertFails(getDoc(doc(bobDb, 'entryCommands', `${ALICE_UID}_custom-shirt`)));
  });

  it('allows organization members to create team commands and blocks non-member reads', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
    const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();

    await assertSucceeds(setDoc(
      doc(aliceDb, 'teamEntryCommands', `${ORG_ID}_custom-shirt`),
      buildCommand({ ownerId: ALICE_UID, scope: 'team', orgId: ORG_ID })
    ));

    await assertSucceeds(getDoc(doc(aliceDb, 'teamEntryCommands', `${ORG_ID}_custom-shirt`)));
    await assertFails(getDoc(doc(bobDb, 'teamEntryCommands', `${ORG_ID}_custom-shirt`)));
  });

  it('rejects invalid slash names', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();

    await assertFails(setDoc(
      doc(aliceDb, 'entryCommands', `${ALICE_UID}_bad-command`),
      buildCommand({ ownerId: ALICE_UID, scope: 'user', slash: 'shirt' })
    ));
  });
});

function buildCommand(overrides: {
  ownerId: string;
  scope: 'user' | 'team';
  orgId?: string;
  slash?: string;
}) {
  return {
    id: 'custom-shirt',
    slash: overrides.slash || '/shirt',
    aliases: [],
    title: 'Shirt',
    summary: 'Shared shirt workflow.',
    surfaces: ['command-bar', 'mobile', 'voice'],
    intakeFields: [],
    harnessDomain: 'merch_pod',
    launchMode: 'guided-chat',
    outputContract: 'Merch workflow.',
    approvalRequiredFor: ['paid checkout'],
    resumeBehavior: 'Resume shirt workflow.',
    isCustom: true,
    ownerId: overrides.ownerId,
    scope: overrides.scope,
    ...(overrides.orgId ? { orgId: overrides.orgId } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function checkEmulatorAvailable(): Promise<boolean> {
  return new Promise(resolveAvailable => {
    const socket = createConnection({ host: EMULATOR_HOST, port: EMULATOR_PORT }, () => {
      socket.destroy();
      resolveAvailable(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolveAvailable(false);
    });
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolveAvailable(false);
    });
  });
}
