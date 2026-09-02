'use client';

import { X, Ban, RotateCcw, Calendar, Car } from 'lucide-react';
import { RampBlock } from '@/types';
import { formatRamp, isoToDisplay } from '@/lib/utils';

interface Props {
  block: RampBlock;
  onClose: () => void;
  onReactivate: (block: RampBlock) => void;
}

export default function RampBlockDetailDialog({ block, onClose, onReactivate }: Props) {
  function handleReactivate() {
    onClose();
    onReactivate(block);
  }

  return (
    <div className="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-50 text-red-500"><Ban size={16} /></span>
            <h2 className="text-base font-bold text-gray-900">{formatRamp(block.ramp)} inhabilitada</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-700">
              Desde {isoToDisplay(block.startDate)} {block.startTime}
              {block.endDate ? ` hasta ${isoToDisplay(block.endDate)} ${block.endTime ?? ''}` : ' (indefinido)'}
            </p>
          </div>
          {block.carModel && (
            <div className="flex items-start gap-2.5">
              <Car size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-700">{block.carModel}</p>
            </div>
          )}
          <div className="mt-1 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-1">Motivo</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{block.notes}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cerrar
          </button>
          <button
            onClick={handleReactivate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <RotateCcw size={14} />
            Reactivar rampa
          </button>
        </div>
      </div>
    </div>
  );
}
