'use client';

import { useEffect, useState } from 'react';
import { X, Ban } from 'lucide-react';
import { Ramp, CarModel } from '@/types';
import { getCarModels } from '@/lib/firestore/catalog';
import { createRampBlock } from '@/lib/firestore/rampBlocks';
import { formatRamp } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Props {
  ramp: Ramp;
  date: string;
  startTime: string;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400';
const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

export default function RampBlockForm({ ramp, date, startTime, onClose, onSaved }: Props) {
  const [startDate, setStartDate] = useState(date);
  const [start, setStart]         = useState(startTime);
  const [endDate, setEndDate]     = useState('');
  const [endTime, setEndTime]     = useState('21:00');
  const [carModel, setCarModel]   = useState('');
  const [notes, setNotes]         = useState('');
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    getCarModels(true).catch(() => [] as CarModel[]).then(setCarModels);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error('Escribe el motivo de la inhabilitación');
      return;
    }
    setSaving(true);
    try {
      await createRampBlock({
        ramp,
        startDate,
        startTime: start,
        endDate: endDate || null,
        endTime: endDate ? endTime : null,
        carModel: carModel || undefined,
        notes: notes.trim(),
      });
      onSaved();
    } catch {
      toast.error('Error al inhabilitar la rampa');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Ban size={18} className="text-red-500" />
            Inhabilitar {formatRamp(ramp)}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Desde *</label>
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Hora</label>
              <input type="time" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Hasta (opcional)</label>
              <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
            </div>
            <div>
              <label className={labelCls}>Hora</label>
              <input
                type="time"
                className={inputCls}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={!endDate}
              />
            </div>
          </div>
          {!endDate && (
            <p className="text-xs text-gray-400 -mt-2">
              Sin fecha de fin, la rampa queda inhabilitada hasta que la reactives manualmente.
            </p>
          )}

          <div>
            <label className={labelCls}>Modelo del auto (opcional)</label>
            {carModels.length > 0 ? (
              <select className={inputCls} value={carModel} onChange={(e) => setCarModel(e.target.value)}>
                <option value="">— Ninguno —</option>
                {carModels.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            ) : (
              <input className={inputCls} placeholder="Ej. BYD Shark" value={carModel} onChange={(e) => setCarModel(e.target.value)} />
            )}
          </div>

          <div>
            <label className={labelCls}>Motivo *</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder="Ej. Elevador descompuesto, en espera de refacción"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Guardando...' : 'Inhabilitar rampa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
