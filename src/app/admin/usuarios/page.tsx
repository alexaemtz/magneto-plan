'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { getUsersList, updateUserProfile } from '@/lib/firestore/users';
import {
  UserProfile, Role, PageKey, PagePermissions,
  PAGE_LABELS, DEFAULT_PAGE_PERMISSIONS,
} from '@/types';
import { cn } from '@/lib/utils';
import { ShieldCheck, User, X, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader, TableSkeleton } from '@/components/ui/primitives';

const PAGES: PageKey[] = ['dashboard', 'gantt', 'casosPendientes', 'refacciones'];
const PERM_LABELS: Record<keyof PagePermissions, string> = {
  read: 'Ver', create: 'Crear', update: 'Editar', delete: 'Eliminar',
};

// ── Permission Matrix Modal ───────────────────────────────────────────────────

interface EditModalProps {
  user: UserProfile;
  onClose: () => void;
  onSaved: (updated: UserProfile) => void;
}

function EditModal({ user, onClose, onSaved }: EditModalProps) {
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  const [perms, setPerms] = useState<Record<PageKey, PagePermissions>>(
    user.permissions ?? { ...DEFAULT_PAGE_PERMISSIONS },
  );
  const [saving, setSaving] = useState(false);

  function togglePerm(page: PageKey, key: keyof PagePermissions) {
    setPerms((prev) => ({
      ...prev,
      [page]: { ...prev[page], [key]: !prev[page][key] },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { role, active, permissions: perms });
      toast.success('Perfil actualizado');
      onSaved({ ...user, role, active, permissions: perms });
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
          <div>
            <p className="font-semibold text-gray-800">{user.displayName || 'Sin nombre'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Role + Active */}
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Rol</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['user', 'admin'] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={cn(
                      'px-3.5 py-1.5 text-xs font-semibold transition-colors',
                      role === r
                        ? r === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
                        : 'text-gray-500 hover:bg-gray-50',
                    )}
                  >
                    {r === 'admin' ? 'Administrador' : 'Usuario'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Estado</label>
              <button
                onClick={() => setActive((v) => !v)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  active
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-600',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', active ? 'bg-green-500' : 'bg-red-400')} />
                {active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </div>

          {/* Permission matrix — only for non-admin */}
          {role !== 'admin' && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Permisos por página
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Página</th>
                      {(Object.keys(PERM_LABELS) as (keyof PagePermissions)[]).map((k) => (
                        <th key={k} className="px-3 py-2.5 text-center font-semibold text-gray-600">
                          {PERM_LABELS[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {PAGES.map((page) => (
                      <tr key={page} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-700">{PAGE_LABELS[page]}</td>
                        {(Object.keys(PERM_LABELS) as (keyof PagePermissions)[]).map((key) => (
                          <td key={key} className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={perms[page]?.[key] ?? false}
                              onChange={() => togglePerm(page, key)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {role === 'admin' && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2.5">
              Los administradores tienen acceso completo a todas las páginas y acciones.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/40">
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsuariosPage() {
  const { isAdmin, loading: authLoading, user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    getUsersList()
      .then(setUsers)
      .catch(() => toast.error('Error al cargar usuarios'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  function handleSaved(updated: UserProfile) {
    setUsers((prev) => prev.map((u) => (u.uid === updated.uid ? updated : u)));
    setEditTarget(null);
  }

  if (authLoading || !isAdmin) return null;

  return (
    <AppShell>
      <div className="px-6 py-7 space-y-5 max-w-screen-lg mx-auto">
        <PageHeader
          title="Usuarios"
          description="Gestión de accesos y permisos"
        />

        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Usuario</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Rol</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Estado</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">Permisos</th>
                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                    {/* Usuario */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold',
                          u.role === 'admin' ? 'bg-blue-600' : 'bg-gray-400',
                        )}>
                          {u.role === 'admin' ? <ShieldCheck size={14} /> : <User size={14} />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 leading-tight">{u.displayName || 'Sin nombre'}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                        {u.uid === currentUser?.uid && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold">tú</span>
                        )}
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-semibold',
                        u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
                      )}>
                        {u.role === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        'flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-semibold',
                        u.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600',
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', u.active ? 'bg-green-500' : 'bg-red-400')} />
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Resumen de permisos */}
                    <td className="px-4 py-3.5">
                      {u.role === 'admin' ? (
                        <span className="text-xs text-blue-600 font-medium">Acceso completo</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {PAGES.filter((page) => u.permissions?.[page]?.read).map((page) => (
                            <span key={page} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                              {PAGE_LABELS[page]}
                            </span>
                          ))}
                          {!PAGES.some((p) => u.permissions?.[p]?.create || u.permissions?.[p]?.update || u.permissions?.[p]?.delete) && (
                            <span className="text-[11px] text-gray-500">Solo lectura</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => setEditTarget(u)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        Configurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editTarget && (
        <EditModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </AppShell>
  );
}
