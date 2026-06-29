import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Appointment } from '@/types';
import { cacheGet, cacheSet, cacheInvalidate, ttlForDate, ttlForMonth } from '@/lib/cache';

const COL = 'appointments';

function apptKey(date: string)     { return `appts:${date}`; }
function monthKey(ym: string)      { return `appts-month:${ym}`; }
function invalidateDate(date: string) {
  cacheInvalidate(apptKey(date), monthKey(date.slice(0, 7)));
}

function sortByTime(appts: Appointment[]): Appointment[] {
  return appts.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export async function getAppointmentsByDate(date: string, force = false): Promise<Appointment[]> {
  const key = apptKey(date);
  if (!force) {
    const cached = cacheGet<Appointment[]>(key, ttlForDate(date));
    if (cached) return cached;
  }

  const q = query(collection(db, COL), where('date', '==', date));
  const snap = await getDocs(q);
  const result = sortByTime(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));
  cacheSet(key, result);
  return result;
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Appointment;
}

export async function createAppointment(data: Omit<Appointment, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateDate(data.date);
  return ref.id;
}

export async function updateAppointment(id: string, data: Partial<Appointment>, forDate?: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  const date = data.date ?? forDate;
  if (date) invalidateDate(date);
}

export async function deleteAppointment(id: string, forDate?: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  if (forDate) invalidateDate(forDate);
}

export async function getAppointmentsByMonth(year: number, month: number, force = false): Promise<Appointment[]> {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const key = monthKey(ym);
  if (!force) {
    const cached = cacheGet<Appointment[]>(key, ttlForMonth(ym));
    if (cached) return cached;
  }

  const start = `${ym}-01`;
  const end   = `${ym}-31`;
  const q = query(collection(db, COL), where('date', '>=', start), where('date', '<=', end));
  const snap = await getDocs(q);
  const result = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Appointment))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  cacheSet(key, result);
  return result;
}
