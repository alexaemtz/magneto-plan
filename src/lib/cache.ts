const PREFIX = 'mgn:';

export const TTL = {
  CATALOG:        12 * 60 * 60_000, // 12 h  — catálogos cambian rara vez
  MONTH_PAST:     24 * 60 * 60_000, // 24 h  — meses cerrados no cambian
  MONTH_CURRENT:   3 * 60_000,      // 3 min — mes activo
  DAY_PAST:       30 * 60_000,      // 30 min
  DAY_CURRENT:     2 * 60_000,      // 2 min — cambia con frecuencia
  DAY_FUTURE:      5 * 60_000,      // 5 min
} as const;

interface Entry<T> { data: T; ts: number }

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentYM(): string {
  return todayStr().slice(0, 7);
}

export function ttlForDate(date: string): number {
  const today = todayStr();
  if (date === today) return TTL.DAY_CURRENT;
  if (date < today)  return TTL.DAY_PAST;
  return TTL.DAY_FUTURE;
}

export function ttlForMonth(ym: string): number {
  return ym === currentYM() ? TTL.MONTH_CURRENT : TTL.MONTH_PAST;
}

export function cacheGet<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (Date.now() - entry.ts > ttlMs) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: Entry<T> = { data, ts: Date.now() };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota excedida — ignorar silenciosamente
  }
}

export function cacheInvalidate(...keys: string[]): void {
  if (typeof window === 'undefined') return;
  for (const k of keys) localStorage.removeItem(PREFIX + k);
}

/** Elimina todas las entradas de caché de Magneto — llamar al cerrar sesión */
export function cacheClear(): void {
  if (typeof window === 'undefined') return;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
  for (const k of keys) localStorage.removeItem(k);
}
