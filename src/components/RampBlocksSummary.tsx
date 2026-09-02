'use client';

import { useState } from 'react';
import { Ban, ChevronDown } from 'lucide-react';
import { RampBlock } from '@/types';
import { formatRamp, isoToDisplay, todayISO, cn } from '@/lib/utils';

interface Props {
  blocks: RampBlock[];
  onReactivate: (block: RampBlock) => void;
}

export default function RampBlocksSummary({ blocks, onReactivate }: Props) {
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const current = blocks.filter((b) => !b.endDate || b.endDate >= today);

  if (current.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
      >
        <Ban size={13} />
        {current.length} rampa{current.length !== 1 ? 's' : ''} inhabilitada{current.length !== 1 ? 's' : ''}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="overlay fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="dropdown-card absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden" style={{ ['--origin' as string]: 'top right' }}>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {current.map((b) => (
                <div key={b.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{formatRamp(b.ramp)}</p>
                    <button
                      onClick={() => { onReactivate(b); setOpen(false); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      Reactivar
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Desde {isoToDisplay(b.startDate)}{b.endDate ? ` hasta ${isoToDisplay(b.endDate)}` : ' (indefinido)'}
                  </p>
                  {b.carModel && <p className="text-xs text-gray-400 mt-0.5">{b.carModel}</p>}
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed line-clamp-2">{b.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
