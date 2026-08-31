'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { normalizeName } from '@/lib/utils';
import { Play, CheckCircle2, Loader2, Database } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Collection normalization configs ─────────────────────────────────────────

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return String(v ?? '').trim();
}

const COLLECTIONS: {
  key: string;
  label: string;
  description: string;
  transform: (d: Row) => Row;
}[] = [
  {
    key: 'refacciones',
    label: 'Refacciones',
    description: 'capturedBy, requestedBy, clientName, location → nombre propio · VIN, No. Parte → mayúsculas · descripción → trim',
    transform: (d) => ({
      capturedBy:  normalizeName(str(d.capturedBy)),
      requestedBy: normalizeName(str(d.requestedBy)),
      clientName:  normalizeName(str(d.clientName)),
      location:    normalizeName(str(d.location)),
      description: str(d.description),
      vin:         str(d.vin).toUpperCase(),
      partNumber:  str(d.partNumber).toUpperCase(),
    }),
  },
  {
    key: 'appointments',
    label: 'Citas',
    description: 'clientName, advisor, tecnico → nombre propio · serialNumber, workOrder → mayúsculas',
    transform: (d) => ({
      clientName:   normalizeName(str(d.clientName)),
      advisor:      normalizeName(str(d.advisor)),
      tecnico:      normalizeName(str(d.tecnico)),
      serialNumber: str(d.serialNumber).toUpperCase(),
      workOrder:    str(d.workOrder).toUpperCase(),
    }),
  },
  {
    key: 'pendingCases',
    label: 'Casos Pendientes',
    description: 'clientName, carModel → nombre propio · vin, workOrder, partNumber → mayúsculas · reason, comment → trim',
    transform: (d) => ({
      clientName:  normalizeName(str(d.clientName)),
      carModel:    normalizeName(str(d.carModel)),
      vin:         str(d.vin).toUpperCase(),
      workOrder:   str(d.workOrder).toUpperCase(),
      partNumber:  str(d.partNumber).toUpperCase(),
      reason:      str(d.reason),
      comment:     str(d.comment),
    }),
  },
];

// ── Batch update helper ───────────────────────────────────────────────────────

async function normalizeCollection(
  colKey: string,
  transform: (d: Row) => Row,
): Promise<{ updated: number; skipped: number }> {
  const snap = await getDocs(collection(db, colKey));

  const batches = [writeBatch(db)];
  let opCount = 0;
  let updated = 0;
  let skipped = 0;

  snap.docs.forEach((d) => {
    const data = d.data() as Row;
    const normalized = transform(data);

    const hasChange = Object.entries(normalized).some(
      ([k, v]) => data[k] !== v,
    );

    if (!hasChange) { skipped++; return; }

    if (opCount >= 499) {
      batches.push(writeBatch(db));
      opCount = 0;
    }

    batches[batches.length - 1].update(doc(db, colKey, d.id), normalized);
    opCount++;
    updated++;
  });

  await Promise.all(batches.map((b) => b.commit()));
  return { updated, skipped };
}

// ── Status per collection ─────────────────────────────────────────────────────

type ColStatus = 'idle' | 'running' | 'done' | 'error';

interface ColState {
  status: ColStatus;
  updated?: number;
  skipped?: number;
  error?: string;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NormalizacionPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [isAdmin, authLoading, router]);

  const [states, setStates] = useState<Record<string, ColState>>(
    () => Object.fromEntries(COLLECTIONS.map((c) => [c.key, { status: 'idle' }])),
  );
  const [runningAll, setRunningAll] = useState(false);

  function setColState(key: string, s: Partial<ColState>) {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], ...s } }));
  }

  async function runOne(col: typeof COLLECTIONS[number]) {
    setColState(col.key, { status: 'running' });
    try {
      const { updated, skipped } = await normalizeCollection(col.key, col.transform);
      setColState(col.key, { status: 'done', updated, skipped });
      toast.success(`${col.label}: ${updated} actualizado${updated !== 1 ? 's' : ''}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setColState(col.key, { status: 'error', error: msg });
      toast.error(`Error en ${col.label}`);
    }
  }

  async function runAll() {
    setRunningAll(true);
    for (const col of COLLECTIONS) {
      await runOne(col);
    }
    setRunningAll(false);
    toast.success('Normalización completa');
  }

  if (authLoading || !isAdmin) return null;

  const anyRunning = Object.values(states).some((s) => s.status === 'running');
  const allDone    = COLLECTIONS.every((c) => states[c.key].status === 'done');

  return (
    <AppShell>
      <div className="px-6 py-6 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Normalización de datos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aplica formato de nombre propio y mayúsculas a los registros existentes en Firestore.
            Cada operación es incremental — solo actualiza los documentos que cambien.
          </p>
        </div>

        {/* Cards per collection */}
        <div className="space-y-3">
          {COLLECTIONS.map((col) => {
            const s = states[col.key];
            return (
              <div
                key={col.key}
                className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Database size={17} className="text-gray-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{col.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{col.description}</p>

                  {s.status === 'done' && (
                    <p className="text-xs text-emerald-600 font-medium mt-1.5">
                      ✓ {s.updated} actualizado{s.updated !== 1 ? 's' : ''},{' '}
                      {s.skipped} sin cambios
                    </p>
                  )}
                  {s.status === 'error' && (
                    <p className="text-xs text-red-500 mt-1.5">{s.error}</p>
                  )}
                </div>

                <button
                  onClick={() => runOne(col)}
                  disabled={s.status === 'running' || runningAll}
                  className="shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40
                    bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  {s.status === 'running' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : s.status === 'done' ? (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  ) : (
                    <Play size={14} />
                  )}
                  {s.status === 'running' ? 'Procesando…' : s.status === 'done' ? 'Repetir' : 'Ejecutar'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Run all */}
        <div className="flex justify-end">
          <button
            onClick={runAll}
            disabled={anyRunning || runningAll}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md shadow-blue-200"
          >
            {runningAll ? (
              <Loader2 size={15} className="animate-spin" />
            ) : allDone ? (
              <CheckCircle2 size={15} />
            ) : (
              <Play size={15} />
            )}
            {runningAll ? 'Normalizando todo…' : 'Normalizar todo'}
          </button>
        </div>

        <p className="text-xs text-gray-400">
          Esta página solo es visible para administradores. La operación puede tardar algunos
          segundos dependiendo del volumen de registros.
        </p>
      </div>
    </AppShell>
  );
}
