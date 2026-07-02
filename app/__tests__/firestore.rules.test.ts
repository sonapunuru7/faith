import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

// React Native's Jest test environment polyfills the global `fetch` with a
// stub that never completes a real network request (RN component tests
// aren't supposed to hit the network). @firebase/rules-unit-testing uses the
// global `fetch` directly (Emulator Hub discovery, loading firestore.rules
// into the emulator, clearFirestore, etc.), which breaks under that stub.
// Swap in Node's real fetch implementation (via `undici`, already present in
// node_modules) for this suite only, so those admin calls reach the actual
// local emulator instead of the RN network stub.
(global as any).fetch = require('undici').fetch;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'faith-app-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

test('a user can read and write their own user document', async () => {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(aliceDb, 'users/alice'), { displayName: 'Alice' }));
  await assertSucceeds(getDoc(doc(aliceDb, 'users/alice')));
});

test("a user cannot read another user's document", async () => {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const bobDb = testEnv.authenticatedContext('bob').firestore();
  await assertSucceeds(setDoc(doc(aliceDb, 'users/alice'), { displayName: 'Alice' }));
  await assertFails(getDoc(doc(bobDb, 'users/alice')));
});

test('an unauthenticated request cannot read any user document', async () => {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  await assertSucceeds(setDoc(doc(aliceDb, 'users/alice'), { displayName: 'Alice' }));
  const unauthedDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthedDb, 'users/alice')));
});

test('any authenticated user can read the daily verse, but not write it', async () => {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'dailyVerses/2026-07-02'), {
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
  });
  await assertSucceeds(getDoc(doc(aliceDb, 'dailyVerses/2026-07-02')));
  await assertFails(
    setDoc(doc(aliceDb, 'dailyVerses/2026-07-02'), { reference: 'tampered' })
  );
});
