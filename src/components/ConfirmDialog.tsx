'use client';

import { Trash2 } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel = 'Eliminar',
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div
      className="overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="modal-card bg-white rounded-2xl shadow-2xl w-80 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={16} className="text-red-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800">{title}</p>
            <p className="text-sm text-gray-500 mt-0.5">{message}</p>
            {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
