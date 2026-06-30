import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PendingCase } from '@/types';
import { cacheGet, cacheSet, cacheInvalidate, TTL } from '@/lib/cache';

const COL = 'pendingCases';
const KEY = 'pending-cases';

/** Real-time subscription for all pending cases. Returns the unsubscribe function. */
export function subscribeToPendingCases(
  onChange: (cases: PendingCase[]) => void,
): () => void {
  return onSnapshot(query(collection(db, COL)), (snap) => {
    const result = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PendingCase))
      .sort((a, b) => b.date.localeCompare(a.date));
    cacheSet(KEY, result);
    onChange(result);
  });
}

export async function getPendingCases(): Promise<PendingCase[]> {
  const cached = cacheGet<PendingCase[]>(KEY, TTL.DAY_CURRENT);
  if (cached) return cached;

  const snap = await getDocs(query(collection(db, COL)));
  const result = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as PendingCase))
    .sort((a, b) => b.date.localeCompare(a.date));
  cacheSet(KEY, result);
  return result;
}

export async function createPendingCase(data: Omit<PendingCase, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
  cacheInvalidate(KEY);
  return ref.id;
}

export async function updatePendingCase(id: string, data: Partial<PendingCase>): Promise<void> {
  await updateDoc(doc(db, COL, id), data);
  cacheInvalidate(KEY);
}

export async function deletePendingCase(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  cacheInvalidate(KEY);
}
