import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PartsOrder } from '@/types';

export function subscribeToPartsOrders(
  callback: (orders: PartsOrder[]) => void,
): () => void {
  const q = query(collection(db, 'refacciones'), orderBy('captureDate', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PartsOrder)));
    },
    (err) => {
      console.error('Error en suscripción de refacciones:', err);
      callback([]);
    },
  );
}

export async function createPartsOrder(data: Omit<PartsOrder, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'refacciones'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePartsOrder(
  id: string,
  data: Partial<Omit<PartsOrder, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, 'refacciones', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePartsOrder(id: string): Promise<void> {
  await deleteDoc(doc(db, 'refacciones', id));
}
