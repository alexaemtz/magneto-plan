'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { Advisor, CarModel, Tecnico, UserProfile } from '@/types';
import { getAdvisors, createAdvisor, updateAdvisor, getCarModels, createCarModel, updateCarModel, getTecnicos, createTecnico, updateTecnico } from '@/lib/firestore/catalog';
import { getUsersList, setUserRole, setUserActive } from '@/lib/firestore/users';
import { useAuth } from '@/context/AuthContext';
import { Plus, Pencil, Check, X, Upload, Shield, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader, Card, TableSkeleton } from '@/components/ui/primitives';

type EditState = { id: string; name: string } | null;

const inputCls = 'flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400';

// ── Bulk import modal ────────────────────────────────────────────────────────
function BulkImportModal({
  title,
  existingNames,
  onImport,
  onClose,
}: {
  title: string;
  existingNames: Set<string>;
  onImport: (names: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);

  const preview = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const newOnes = preview.filter((n) => !existingNames.has(n));
  const dupes   = preview.filter((n) =>  existingNames.has(n));

  async function handleImport() {
    if (newOnes.length === 0) { toast.error('No hay entradas nuevas'); return; }
    setImporting(true);
    try {
      await onImport(newOnes);
      toast.success(`${newOnes.length} ${title.toLowerCase()} agregados`);
      onClose();
    } catch {
      toast.error('Error al importar');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Importar {title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Un nombre por línea</label>
            <textarea
              autoFocus
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
              placeholder={'Nombre 1\nNombre 2\nNombre 3\n...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {preview.length > 0 && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs space-y-1">
              <p className="font-semibold text-gray-700">
                {preview.length} detectados · <span className="text-green-700">{newOnes.length} nuevos</span>
                {dupes.length > 0 && <span className="text-amber-600"> · {dupes.length} ya existen (se omitirán)</span>}
              </p>
              {newOnes.slice(0, 6).map((n) => <p key={n} className="text-gray-600">· {n}</p>)}
              {newOnes.length > 6 && <p className="text-gray-400">…y {newOnes.length - 6} más</p>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={importing || newOnes.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Upload size={15} />
            {importing ? 'Importando...' : `Importar ${newOnes.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Catalog section ──────────────────────────────────────────────────────────
function CatalogSection<T extends { id?: string; name: string; active: boolean }>({
  title,
  items,
  onAdd,
  onBulkAdd,
  onToggle,
  onRename,
  readOnly = false,
}: {
  title: string;
  items: T[];
  onAdd: (name: string) => Promise<void>;
  onBulkAdd: (names: string[]) => Promise<void>;
  onToggle: (item: T) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [edit, setEdit] = useState<EditState>(null);

  const existingNames = new Set(items.map((i) => i.name));

  async function handleAdd() {
    if (!newName.trim()) return;
    await onAdd(newName.trim());
    setNewName('');
    setAdding(false);
  }

  async function handleRename() {
    if (!edit || !edit.name.trim()) return;
    await onRename(edit.id, edit.name.trim());
    setEdit(null);
  }

  return (
    <>
      <Card className="overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5 tabular">{items.length} registros</p>
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors">
                <Upload size={13} /> Importar lista
              </button>
              <button onClick={() => { setAdding(true); setEdit(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors">
                <Plus size={13} /> Agregar
              </button>
            </div>
          )}
        </div>

        {adding && !readOnly && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-blue-50/40">
            <input
              autoFocus
              className={inputCls}
              placeholder="Nombre..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            />
            <button onClick={handleAdd} className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600"><Check size={16} /></button>
            <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100"><X size={16} /></button>
          </div>
        )}

        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto flex-1">
          {items.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">
              {readOnly ? 'Sin registros' : 'Sin registros. Usa "Importar lista" para cargar varios a la vez'}
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-2.5">
              {!readOnly && edit?.id === item.id ? (
                <>
                  <input
                    autoFocus
                    className={inputCls}
                    value={edit?.name ?? ''}
                    onChange={(e) => setEdit(edit ? { ...edit, name: e.target.value } : null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEdit(null); }}
                  />
                  <button onClick={handleRename} className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600"><Check size={15} /></button>
                  <button onClick={() => setEdit(null)} className="p-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100"><X size={15} /></button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm font-medium ${item.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                    {item.name}
                  </span>
                  {!readOnly && (
                    <>
                      <button onClick={() => setEdit({ id: item.id!, name: item.name })}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => onToggle(item)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          item.active
                            ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                        }`}
                      >
                        {item.active ? 'Activo' : 'Inactivo'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      {showImport && !readOnly && (
        <BulkImportModal
          title={title}
          existingNames={existingNames}
          onImport={onBulkAdd}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  );
}

// ── Users section (solo admins) ───────────────────────────────────────────────
function UsersSection({ currentUid }: { currentUid: string }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setUsers(await getUsersList());
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      toast.error('Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getUsersList()
      .then((users) => { if (active) setUsers(users); })
      .catch((err) => {
        console.error('Error cargando usuarios:', err);
        toast.error('Error al cargar los usuarios');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function toggleRole(u: UserProfile) {
    const next = u.role === 'admin' ? 'user' : 'admin';
    try {
      await setUserRole(u.uid, next);
      toast.success(`${u.email}: rol cambiado a ${next === 'admin' ? 'Administrador' : 'Usuario'}`);
      load();
    } catch {
      toast.error('Error al cambiar el rol');
    }
  }

  async function toggleActive(u: UserProfile) {
    try {
      await setUserActive(u.uid, !u.active);
      toast.success(`${u.email} ${!u.active ? 'activado' : 'desactivado'}`);
      load();
    } catch {
      toast.error('Error al cambiar el estado');
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50/60 to-transparent">
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Shield size={15} className="text-violet-600" />
            Usuarios y permisos
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{users.length} registros · solo visible para administradores</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {users.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-10">Sin usuarios registrados</p>
          )}
          {users.map((u) => {
            const isSelf = u.uid === currentUid;
            return (
              <div key={u.uid} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${u.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                    {u.email}
                  </p>
                  {u.displayName && (
                    <p className="text-xs text-gray-400 truncate">{u.displayName}</p>
                  )}
                  {isSelf && <p className="text-xs text-purple-500 font-medium">Tú</p>}
                </div>

                {/* Rol */}
                <button
                  onClick={() => toggleRole(u)}
                  disabled={isSelf}
                  title={isSelf ? 'No puedes cambiar tu propio rol' : `Cambiar a ${u.role === 'admin' ? 'Usuario' : 'Administrador'}`}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    u.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
                  }`}
                >
                  {u.role === 'admin' ? <Shield size={11} /> : <ShieldOff size={11} />}
                  {u.role === 'admin' ? 'Admin' : 'Usuario'}
                </button>

                {/* Activo */}
                <button
                  onClick={() => toggleActive(u)}
                  disabled={isSelf}
                  title={isSelf ? 'No puedes desactivarte a ti mismo' : (u.active ? 'Desactivar' : 'Activar')}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    u.active
                      ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600'
                      : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                  }`}
                >
                  {u.active ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const { user, isAdmin } = useAuth();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [a, c, t] = await Promise.all([
        getAdvisors(),
        getCarModels(),
        getTecnicos().catch(() => [] as Tecnico[]),
      ]);
      setAdvisors(a);
      setCarModels(c);
      setTecnicos(t);
    } catch (err) {
      console.error('Error cargando catálogos:', err);
      toast.error('Error al cargar los catálogos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      getAdvisors(),
      getCarModels(),
      getTecnicos().catch(() => [] as Tecnico[]),
    ])
      .then(([a, c, t]) => {
        if (!active) return;
        setAdvisors(a);
        setCarModels(c);
        setTecnicos(t);
      })
      .catch((err) => {
        console.error('Error cargando catálogos:', err);
        toast.error('Error al cargar los catálogos.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Advisors ──
  async function addAdvisor(name: string) {
    await createAdvisor({ name, active: true });
    toast.success('Asesor agregado');
    load();
  }
  async function bulkAddAdvisors(names: string[]) {
    await Promise.all(names.map((n) => createAdvisor({ name: n, active: true })));
    load();
  }
  async function toggleAdvisor(a: Advisor) {
    await updateAdvisor(a.id!, { active: !a.active });
    load();
  }
  async function renameAdvisor(id: string, name: string) {
    await updateAdvisor(id, { name });
    toast.success('Asesor actualizado');
    load();
  }

  // ── Técnicos ──
  async function addTecnico(name: string) {
    await createTecnico({ name, active: true });
    toast.success('Técnico agregado');
    load();
  }
  async function bulkAddTecnicos(names: string[]) {
    await Promise.all(names.map((n) => createTecnico({ name: n, active: true })));
    load();
  }
  async function toggleTecnico(t: Tecnico) {
    await updateTecnico(t.id!, { active: !t.active });
    load();
  }
  async function renameTecnico(id: string, name: string) {
    await updateTecnico(id, { name });
    toast.success('Técnico actualizado');
    load();
  }

  // ── Car models ──
  async function addCarModel(name: string) {
    await createCarModel({ name, active: true });
    toast.success('Modelo agregado');
    load();
  }
  async function bulkAddCarModels(names: string[]) {
    await Promise.all(names.map((n) => createCarModel({ name: n, active: true })));
    load();
  }
  async function toggleCarModel(m: CarModel) {
    await updateCarModel(m.id!, { active: !m.active });
    load();
  }
  async function renameCarModel(id: string, name: string) {
    await updateCarModel(id, { name });
    toast.success('Modelo actualizado');
    load();
  }

  return (
    <AppShell>
      <div className="px-6 py-7 max-w-screen-lg mx-auto space-y-6">
        <PageHeader
          title="Configuración"
          description={
            isAdmin
              ? 'Catálogos de asesores, técnicos y modelos de auto'
              : 'Catálogos de asesores, técnicos y modelos de auto · solo lectura: contacta a un administrador para realizar cambios'
          }
        />

        {loading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CatalogSection
              title="Asesores"
              items={advisors}
              readOnly={!isAdmin}
              onAdd={addAdvisor}
              onBulkAdd={bulkAddAdvisors}
              onToggle={toggleAdvisor}
              onRename={renameAdvisor}
            />
            <CatalogSection
              title="Técnicos"
              items={tecnicos}
              readOnly={!isAdmin}
              onAdd={addTecnico}
              onBulkAdd={bulkAddTecnicos}
              onToggle={toggleTecnico}
              onRename={renameTecnico}
            />
            <CatalogSection
              title="Modelos BYD"
              items={carModels}
              readOnly={!isAdmin}
              onAdd={addCarModel}
              onBulkAdd={bulkAddCarModels}
              onToggle={toggleCarModel}
              onRename={renameCarModel}
            />
          </div>
        )}

        {isAdmin && user && (
          <UsersSection currentUid={user.uid} />
        )}
      </div>
    </AppShell>
  );
}
