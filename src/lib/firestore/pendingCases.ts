import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PendingCase } from '@/types';

const COL = 'pendingCases';

export async function getPendingCases(): Promise<PendingCase[]> {
  const snap = await getDocs(query(collection(db, COL)));
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PendingCase));
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

export async function createPendingCase(data: Omit<PendingCase, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePendingCase(id: string, data: Partial<PendingCase>): Promise<void> {
  await updateDoc(doc(db, COL, id), data);
}

export async function deletePendingCase(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
