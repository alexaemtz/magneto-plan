import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, Role, PageKey, PagePermissions } from '@/types';
import { cacheGet, cacheSet, cacheInvalidate, TTL } from '@/lib/cache';

const KEY = 'users-list';

export async function getUsersList(): Promise<UserProfile[]> {
  const cached = cacheGet<UserProfile[]>(KEY, TTL.DAY_CURRENT);
  if (cached) return cached;

  const snap = await getDocs(collection(db, 'users'));
  const result = snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
    .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
  cacheSet(KEY, result);
  return result;
}

export async function setUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role });
  cacheInvalidate(KEY);
}

export async function setUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { active });
  cacheInvalidate(KEY);
}

export async function setUserPagePermissions(
  uid: string,
  page: PageKey,
  perms: PagePermissions,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { [`permissions.${page}`]: perms });
  cacheInvalidate(KEY);
}

export async function updateUserProfile(
  uid: string,
  data: { role?: Role; active?: boolean; permissions?: Record<PageKey, PagePermissions> },
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), data);
  cacheInvalidate(KEY);
}
