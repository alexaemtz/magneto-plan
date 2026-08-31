import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const NO_PERMS = { read: false, create: false, update: false, delete: false };
const FULL_PERMS = { read: true, create: true, update: true, delete: true };

function allPagePerms(overrides: Record<string, typeof NO_PERMS> = {}) {
  return {
    dashboard: NO_PERMS,
    gantt: NO_PERMS,
    indicador: NO_PERMS,
    casosPendientes: NO_PERMS,
    refacciones: NO_PERMS,
    ...overrides,
  };
}

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-magneto-plan-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedUser(uid: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', uid), data);
  });
}

describe('users/{userId}', () => {
  it('lets a brand-new authenticated user create their own profile doc', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(setDoc(doc(alice.firestore(), 'users', 'alice'), {
      uid: 'alice', email: 'alice@x.com', role: 'user', active: false, permissions: allPagePerms(),
    }));
  });

  it('blocks creating a profile doc for someone else', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(setDoc(doc(alice.firestore(), 'users', 'bob'), {
      uid: 'bob', role: 'user', active: false, permissions: allPagePerms(),
    }));
  });

  it('lets a user update their own displayName', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: true, permissions: allPagePerms() });
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(updateDoc(doc(alice.firestore(), 'users', 'alice'), { displayName: 'Alice' }));
  });

  it('blocks a user from self-promoting to admin', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: true, permissions: allPagePerms() });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(updateDoc(doc(alice.firestore(), 'users', 'alice'), { role: 'admin' }));
  });

  it('blocks a pending user from activating their own account', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: false, permissions: allPagePerms() });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(updateDoc(doc(alice.firestore(), 'users', 'alice'), { active: true }));
  });

  it('blocks a user from granting themselves extra permissions', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: true, permissions: allPagePerms() });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(updateDoc(doc(alice.firestore(), 'users', 'alice'), {
      permissions: allPagePerms({ gantt: FULL_PERMS }),
    }));
  });

  it('lets an admin activate another user and change their permissions', async () => {
    await seedUser('admin1', { uid: 'admin1', role: 'admin', active: true });
    await seedUser('alice', { uid: 'alice', role: 'user', active: false, permissions: allPagePerms() });
    const admin = testEnv.authenticatedContext('admin1');
    await assertSucceeds(updateDoc(doc(admin.firestore(), 'users', 'alice'), {
      active: true,
      permissions: allPagePerms({ gantt: { ...NO_PERMS, read: true } }),
    }));
  });
});

describe('appointments — read gate', () => {
  it('denies read to an unauthenticated request', async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(anon.firestore(), 'appointments', 'a1')));
  });

  it('denies read to a pending (inactive) user even with read permission set', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: false, permissions: allPagePerms({ gantt: FULL_PERMS }) });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(getDoc(doc(alice.firestore(), 'appointments', 'a1')));
  });

  it('denies read to an active user without read permission on gantt/dashboard', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: true, permissions: allPagePerms() });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(getDoc(doc(alice.firestore(), 'appointments', 'a1')));
  });

  it('allows read to an active user with read permission on gantt', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: true, permissions: allPagePerms({ gantt: { ...NO_PERMS, read: true } }) });
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(getDoc(doc(alice.firestore(), 'appointments', 'a1')));
  });

  it('allows an admin to read regardless of the permissions map', async () => {
    await seedUser('admin1', { uid: 'admin1', role: 'admin', active: true });
    const admin = testEnv.authenticatedContext('admin1');
    await assertSucceeds(getDoc(doc(admin.firestore(), 'appointments', 'a1')));
  });
});

describe('rampBlocks — mirrors the appointments read gate', () => {
  it('denies read to an active user without gantt/dashboard read permission', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: true, permissions: allPagePerms() });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(getDoc(doc(alice.firestore(), 'rampBlocks', 'r1')));
  });

  it('allows read once gantt read permission is granted', async () => {
    await seedUser('alice', { uid: 'alice', role: 'user', active: true, permissions: allPagePerms({ gantt: { ...NO_PERMS, read: true } }) });
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(getDoc(doc(alice.firestore(), 'rampBlocks', 'r1')));
  });
});
