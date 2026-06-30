import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
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
  // Always read all advisors from one cache key; filter in memory for the active subset
  let all = cacheGet<Advisor[]>(ADVISOR_KEY, TTL.CATALOG);
  if (!all) {
    const snap = await getDocs(query(collection(db, 'advisors')));
    all = sortByName(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Advisor)));
    cacheSet(ADVISOR_KEY, all);
  }
  if (!onlyActive) return all;
  const active = all.filter((a) => a.active);
  cacheSet(ADVISOR_A_KEY, active);
  return active;
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
  let all = cacheGet<CarModel[]>(MODEL_KEY, TTL.CATALOG);
  if (!all) {
    const snap = await getDocs(query(collection(db, 'carModels')));
    all = sortByName(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarModel)));
    cacheSet(MODEL_KEY, all);
  }
  if (!onlyActive) return all;
  const active = all.filter((m) => m.active);
  cacheSet(MODEL_A_KEY, active);
  return active;
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
