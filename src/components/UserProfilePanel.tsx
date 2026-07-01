'use client';

import { useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { X, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { updateOwnProfile } from '@/lib/firestore/users';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const COLORS = [
  { hex: '#2563EB', label: 'Azul'    },
  { hex: '#4F46E5', label: 'Índigo'  },
  { hex: '#7C3AED', label: 'Morado'  },
  { hex: '#DB2777', label: 'Rosa'    },
  { hex: '#DC2626', label: 'Rojo'    },
  { hex: '#EA580C', label: 'Naranja' },
  { hex: '#CA8A04', label: 'Ámbar'   },
  { hex: '#16A34A', label: 'Verde'   },
  { hex: '#0D9488', label: 'Teal'    },
  { hex: '#4B5563', label: 'Gris'    },
];

export function getInitials(name: string, email: string): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

interface Props {
  onClose: () => void;
}

export default function UserProfilePanel({ onClose }: Props) {
  const { user, displayName, avatarColor, refreshProfile } = useAuth();

  const [name, setName]             = useState(displayName);
  const [color, setColor]           = useState(avatarColor);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCur, setShowCur]       = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [saving, setSaving]         = useState(false);

  const hasPassword = user?.providerData.some((p) => p.providerId === 'password') ?? false;
  const wantsPwd    = newPwd.length > 0 || currentPwd.length > 0;
  const initials    = getInitials(name, user?.email ?? '');

  async function handleSave() {
    if (wantsPwd) {
      if (!currentPwd) { toast.error('Ingresa tu contraseña actual'); return; }
      if (newPwd.length < 6) { toast.error('La nueva contraseña debe tener al menos 6 caracteres'); return; }
      if (newPwd !== confirmPwd) { toast.error('Las contraseñas no coinciden'); return; }
    }

    setSaving(true);
    try {
      // Re-authenticate and change password
      if (wantsPwd && user && user.email) {
        const cred = EmailAuthProvider.credential(user.email, currentPwd);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, newPwd);
        toast.success('Contraseña actualizada');
      }

      // Update Firestore profile
      if (user) {
        await updateOwnProfile(user.uid, { displayName: name, avatarColor: color });
        // Also update Firebase Auth display name
        await updateProfile(user, { displayName: name });
      }

      await refreshProfile();
      toast.success('Perfil guardado');
      onClose();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Contraseña actual incorrecta');
      } else if (code === 'auth/weak-password') {
        toast.error('La nueva contraseña es muy débil');
      } else {
        toast.error('Error al guardar el perfil');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">Mi perfil</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md select-none"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>

          {/* Color picker */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Color de avatar</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setColor(c.hex)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform hover:scale-110',
                    color === c.hex && 'ring-2 ring-offset-2 ring-gray-400 scale-110',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Password change — only for email/password users */}
          {hasPassword && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 border-t border-gray-100 pt-4">
                Cambiar contraseña
              </p>

              {/* Current password */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contraseña actual</label>
                <div className="relative">
                  <input
                    type={showCur ? 'text' : 'password'}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCur((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
