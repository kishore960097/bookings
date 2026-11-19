/**
 * Firebase Storage Security Rules Unit Tests
 * Uses @firebase/rules-unit-testing to verify storage.rules
 *
 * To run:
 *   1. firebase emulators:start --only firestore,storage
 *   2. npx vitest run tests/storage.rules.test.ts
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import fs from 'node:fs';
import path from 'node:path';

const hasFirebaseEmulator = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST &&
  (process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST)
);

describe.skipIf(!hasFirebaseEmulator)('Firebase Storage Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-qgo-test',
      storage: {
        rules: fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8'),
      },
      firestore: {
        rules: fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearStorage();
    await testEnv.clearFirestore();

    // Seed mock salon document in Firestore with ownerId 'owner_123'
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('salons').doc('salon_abc').set({
        id: 'salon_abc',
        ownerId: 'owner_123',
        name: 'Test Arena',
      });
    });
  });

  // 1. Owner uploading to own salon: allowed
  it('allows owner to upload valid image to their own salon', async () => {
    const ownerContext = testEnv.authenticatedContext('owner_123');
    const storageRef = ownerContext.storage().ref('salons/salon_abc/logo_123.jpg');
    const validBytes = new Uint8Array(100 * 1024); // 100 KB
    await assertSucceeds(
      storageRef.put(validBytes, { contentType: 'image/jpeg' })
    );
  });

  // 2. Another owner uploading to that salon: denied
  it('denies a different owner from uploading to another salon', async () => {
    const otherOwnerContext = testEnv.authenticatedContext('other_owner_999');
    const storageRef = otherOwnerContext.storage().ref('salons/salon_abc/hack.jpg');
    const validBytes = new Uint8Array(100 * 1024);
    await assertFails(
      storageRef.put(validBytes, { contentType: 'image/jpeg' })
    );
  });

  // 3. Customer uploading: denied
  it('denies customer from uploading to a salon', async () => {
    const customerContext = testEnv.authenticatedContext('customer_456');
    const storageRef = customerContext.storage().ref('salons/salon_abc/unauthorized.png');
    const validBytes = new Uint8Array(50 * 1024);
    await assertFails(
      storageRef.put(validBytes, { contentType: 'image/png' })
    );
  });

  // 4. 5 MB file: denied (limit is 2 MB)
  it('denies uploads exceeding the 2 MB size limit', async () => {
    const ownerContext = testEnv.authenticatedContext('owner_123');
    const storageRef = ownerContext.storage().ref('salons/salon_abc/heavy.jpg');
    const oversizedBytes = new Uint8Array(5 * 1024 * 1024); // 5 MB
    await assertFails(
      storageRef.put(oversizedBytes, { contentType: 'image/jpeg' })
    );
  });

  // 5. .exe/svg: denied (only jpeg, png, webp allowed)
  it('denies forbidden file formats (.exe, .svg)', async () => {
    const ownerContext = testEnv.authenticatedContext('owner_123');
    const exeRef = ownerContext.storage().ref('salons/salon_abc/malware.exe');
    const svgRef = ownerContext.storage().ref('salons/salon_abc/vector.svg');
    const smallBytes = new Uint8Array(1024);

    await assertFails(exeRef.put(smallBytes, { contentType: 'application/octet-stream' }));
    await assertFails(svgRef.put(smallBytes, { contentType: 'image/svg+xml' }));
  });
});
