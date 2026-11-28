import { afterAll, beforeAll, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let environment: RulesTestEnvironment;
const asset = 'artists/artist-1/assets/song_mp3';

describe('white-glove import results (artists/{uid}/assets)', () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({ projectId: 'demo-white-glove-rules', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('packages/firebase/firestore.rules', 'utf8') } });
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), asset), { fileName: 'song.mp3', assetType: 'music', status: 'processed' });
    });
  });
  afterAll(async () => { await environment?.cleanup(); });

  const owner = () => environment.authenticatedContext('artist-1', { firebase: { sign_in_provider: 'password' } }).firestore();

  it('lets the uploading artist read and list their own results', async () => {
    await assertSucceeds(getDoc(doc(owner(), asset)));
    await assertSucceeds(getDocs(collection(owner(), 'artists/artist-1/assets')));
  });

  it('denies other accounts, anonymous sessions, and signed-out readers', async () => {
    await assertFails(getDoc(doc(environment.authenticatedContext('artist-2', { firebase: { sign_in_provider: 'password' } }).firestore(), asset)));
    await assertFails(getDocs(collection(environment.authenticatedContext('artist-1', { firebase: { sign_in_provider: 'anonymous' } }).firestore(), 'artists/artist-1/assets')));
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), asset)));
  });

  it('keeps results server-authored: the owner cannot create, edit, or delete them', async () => {
    await assertFails(setDoc(doc(owner(), 'artists/artist-1/assets/forged'), { status: 'processed' }));
    await assertFails(updateDoc(doc(owner(), asset), { status: 'processed', metadata: { bpm: 1 } }));
    await assertFails(deleteDoc(doc(owner(), asset)));
  });
});
