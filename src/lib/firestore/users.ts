import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, Role } from '@/types';

export async function getUsersList(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
    .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
}

export async function setUserRole(uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role });
}

export async function setUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { active });
}
