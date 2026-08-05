import { collection, doc, addDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RampBlock } from '@/types';

const COL = 'rampBlocks';

/** Suscripción en tiempo real a todos los bloqueos de rampa (colección pequeña, sin filtro de fecha). */
export function subscribeToRampBlocks(onChange: (blocks: RampBlock[]) => void): () => void {
  return onSnapshot(collection(db, COL), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RampBlock)));
  });
}

export async function createRampBlock(data: Omit<RampBlock, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteRampBlock(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
