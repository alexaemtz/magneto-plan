import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DailyIndicator } from '@/types';
import { cacheGet, cacheSet, cacheInvalidate, ttlForDate, ttlForMonth } from '@/lib/cache';

const COL = 'dailyIndicators';

function indKey(date: string)   { return `ind:${date}`; }
function indMKey(ym: string)    { return `ind-month:${ym}`; }
function invalidateDay(date: string) {
  cacheInvalidate(indKey(date), indMKey(date.slice(0, 7)));
}

export async function getDailyIndicator(date: string): Promise<DailyIndicator | null> {
  const key = indKey(date);
  const cached = cacheGet<DailyIndicator>(key, ttlForDate(date));
  if (cached) return cached;

  const snap = await getDoc(doc(db, COL, date));
  if (!snap.exists()) return null;
  const result = { id: snap.id, ...snap.data() } as DailyIndicator;
  cacheSet(key, result);
  return result;
}

export async function upsertDailyIndicator(data: DailyIndicator): Promise<void> {
  await setDoc(
    doc(db, COL, data.date),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
  invalidateDay(data.date);
}

export async function getIndicatorsByMonth(year: number, month: number, force = false): Promise<DailyIndicator[]> {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const key = indMKey(ym);
  if (!force) {
    const cached = cacheGet<DailyIndicator[]>(key, ttlForMonth(ym));
    if (cached) return cached;
  }

  const start = `${ym}-01`;
  const end   = `${ym}-31`;
  const q = query(collection(db, COL), where('date', '>=', start), where('date', '<=', end));
  const snap = await getDocs(q);
  const result = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as DailyIndicator))
    .sort((a, b) => a.date.localeCompare(b.date));
  cacheSet(key, result);
  return result;
}
