import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Advisor, CarModel } from '@/types';
import { cacheGet, cacheSet, cacheInvalidate, TTL } from '@/lib/cache';

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// ── Advisors ─────────────────────────────────────────────────────────────────

const ADVISOR_KEY   = 'advisors';
const ADVISOR_A_KEY = 'advisors:active';

export async function getAdvisors(onlyActive = false): Promise<Advisor[]> {
  const key = onlyActive ? ADVISOR_A_KEY : ADVISOR_KEY;
  const cached = cacheGet<Advisor[]>(key, TTL.CATALOG);
  if (cached) return cached;

  const q = onlyActive
    ? query(collection(db, 'advisors'), where('active', '==', true))
    : query(collection(db, 'advisors'));
  const snap = await getDocs(q);
  const result = sortByName(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Advisor)));
  cacheSet(key, result);
  return result;
}

export async function createAdvisor(data: Omit<Advisor, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'advisors'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  cacheInvalidate(ADVISOR_KEY, ADVISOR_A_KEY);
  return ref.id;
}

export async function updateAdvisor(id: string, data: Partial<Advisor>): Promise<void> {
  await updateDoc(doc(db, 'advisors', id), data);
  cacheInvalidate(ADVISOR_KEY, ADVISOR_A_KEY);
}

// ── Car Models ────────────────────────────────────────────────────────────────

const MODEL_KEY   = 'carModels';
const MODEL_A_KEY = 'carModels:active';

export async function getCarModels(onlyActive = false): Promise<CarModel[]> {
  const key = onlyActive ? MODEL_A_KEY : MODEL_KEY;
  const cached = cacheGet<CarModel[]>(key, TTL.CATALOG);
  if (cached) return cached;

  const q = onlyActive
    ? query(collection(db, 'carModels'), where('active', '==', true))
    : query(collection(db, 'carModels'));
  const snap = await getDocs(q);
  const result = sortByName(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarModel)));
  cacheSet(key, result);
  return result;
}

export async function createCarModel(data: Omit<CarModel, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'carModels'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  cacheInvalidate(MODEL_KEY, MODEL_A_KEY);
  return ref.id;
}

export async function updateCarModel(id: string, data: Partial<CarModel>): Promise<void> {
  await updateDoc(doc(db, 'carModels', id), data);
  cacheInvalidate(MODEL_KEY, MODEL_A_KEY);
}
