'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CaretUp, CaretDown, CaretUpDown, Funnel, MagnifyingGlass,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { TableSkeleton } from './primitives';

/* ─────────────────────────────────────────────────────────────────────────────
   Unified data table: sorting, per-column filtering, global search, column
   resizing and optional pagination. Logic lives in `useDataTable`; rendering in
   `<DataTable>`. Parents compose their own toolbar/footer via render props.  */

export type SortDir = 'asc' | 'desc' | null;

export interface DataTableColumn<K extends string> {
  key: K;
  label: string;
  defaultWidth: number;
  align?: 'left' | 'center';
}

export interface DataTableControls<T, K extends string> {
  columns: DataTableColumn<K>[];
  /** Current page (all filtered rows when pagination is disabled). */
  rows: T[];
  /** Every row after search + column filters + sort, across all pages. */
  filteredRows: T[];
  /** Row count before any search/filter. */
  totalCount: number;
  sortCol: K | null;
  sortDir: SortDir;
  toggleSort: (col: K) => void;
  filters: Partial<Record<K, Set<string>>>;
  setFilter: (col: K, values: Set<string>) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  colWidths: Record<K, number>;
  startResize: (col: K, e: React.MouseEvent) => void;
  filterValues: (col: K) => string[];
  searchable: boolean;
  search: string;
  setSearch: (v: string) => void;
  openFilter: { col: K; top: number; left: number } | null;
  setOpenFilter: (v: { col: K; top: number; left: number } | null) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  safePage: number;
  getValue: (row: T, key: K) => string;
  getRowKey: (row: T) => string;
}

export interface UseDataTableOptions<T, K extends string> {
  rows: T[];
  columns: DataTableColumn<K>[];
  getValue: (row: T, key: K) => string;
  getRowKey: (row: T) => string;
  /** Search coming from an external source (e.g. the global search bar). When
   *  set, the table hides its own search box and filters by this value. */
  externalSearch?: string;
  /** Enables pagination and sets the page size. */
  pageSize?: number;
  /** Optional raw value for sorting — defaults to `getValue`. Return a number
   *  for numeric columns, or a string for locale sorting. */
  getSortValue?: (row: T, key: K) => string | number;
  /** Optional haystack for the global search — defaults to every column's
   *  `getValue`. Use when a row should match extra, non-column terms. */
  getSearchText?: (row: T) => string;
}

export function useDataTable<T, K extends string>({
  rows,
  columns,
  getValue,
  getRowKey,
  externalSearch,
  pageSize,
  getSortValue,
  getSearchText,
}: UseDataTableOptions<T, K>): DataTableControls<T, K> {
  const searchable = externalSearch === undefined;

  const [sortCol, setSortCol] = useState<K | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Partial<Record<K, Set<string>>>>({});
  const [colWidths, setColWidths] = useState<Record<K, number>>(
    () => Object.fromEntries(columns.map((c) => [c.key, c.defaultWidth])) as Record<K, number>,
  );
  const [search, setSearch] = useState('');
  const [openFilter, setOpenFilter] = useState<{ col: K; top: number; left: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const resizeRef = useRef<{ col: K; startX: number; startW: number } | null>(null);

  const query = (searchable ? search : externalSearch ?? '').trim().toLowerCase();
  const sortValue = getSortValue ?? getValue;

  const filteredRows = useMemo(() => {
    let result = rows;

    if (query) {
      result = result.filter((row) => {
        const haystack = getSearchText
          ? getSearchText(row)
          : columns.map((c) => getValue(row, c.key)).join(' ');
        return haystack.toLowerCase().includes(query);
      });
    }

    for (const [col, values] of Object.entries(filters) as [K, Set<string>][]) {
      if (!values || values.size === 0) continue;
      result = result.filter((row) => values.has(getValue(row, col)));
    }

    if (sortCol && sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const av = sortValue(a, sortCol);
        const bv = sortValue(b, sortCol);
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), 'es') * dir;
      });
    }

    return result;
  }, [rows, columns, getValue, sortValue, getSearchText, query, filters, sortCol, sortDir]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(filteredRows.length / pageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = pageSize
    ? filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filteredRows;

  // Reset to page 1 when the search input changes (adjust state in render).
  const resetKey = `${query}|${pageSize ?? ''}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setCurrentPage(1);
  }

  function toggleSort(col: K) {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortCol(null); setSortDir(null); }
  }

  function setFilter(col: K, values: Set<string>) {
    setFilters((prev) => ({ ...prev, [col]: values }));
    setCurrentPage(1);
  }

  // Global resize listeners (shared by all resize handles).
  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const { col, startX, startW } = resizeRef.current;
      setColWidths((prev) => ({ ...prev, [col]: Math.max(60, startW + ev.clientX - startX) }));
    }
    function onUp() { resizeRef.current = null; }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startResize(col: K, e: React.MouseEvent) {
    e.preventDefault();
    resizeRef.current = { col, startX: e.clientX, startW: colWidths[col] };
  }

  function filterValues(col: K) {
    return [...new Set(rows.map((row) => getValue(row, col)))].sort();
  }

  return {
    columns,
    rows: pageRows,
    filteredRows,
    totalCount: rows.length,
    sortCol,
    sortDir,
    toggleSort,
    filters,
    setFilter,
    clearFilters: () => { setFilters({}); setCurrentPage(1); },
    activeFilterCount: Object.values(filters).filter((s) => s instanceof Set && s.size > 0).length,
    colWidths,
    startResize,
    filterValues,
    searchable,
    search,
    setSearch,
    openFilter,
    setOpenFilter,
    currentPage,
    setCurrentPage,
    totalPages,
    safePage,
    getValue,
    getRowKey,
  };
}

/* ── Filter dropdown (portal) ─────────────────────────────────────────────── */

function FilterDropdown<T, K extends string>({ controls, col, top, left }: {
  controls: DataTableControls<T, K>;
  col: K;
  top: number;
  left: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState('');
  const unique = useMemo(() => controls.filterValues(col), [controls, col]);
  const active = controls.filters[col] ?? new Set<string>();
  const visible = term.trim()
    ? unique.filter((v) => v.toLowerCase().includes(term.trim().toLowerCase()))
    : unique;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) controls.setOpenFilter(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [controls]);

  function toggle(v: string) {
    const next = new Set(active);
    if (next.has(v)) next.delete(v); else next.add(v);
    controls.setFilter(col, next);
  }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 9999 }}
      className="dropdown-card w-64 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 flex flex-col max-h-80"
    >
      <div className="flex items-center justify-between px-3.5 pb-2 border-b border-gray-100 shrink-0">
        <span className="text-xs font-semibold text-gray-600">Filtrar</span>
        {active.size > 0 && (
          <button onClick={() => controls.setFilter(col, new Set())} className="text-xs text-red-500 hover:text-red-700 font-medium">
            Limpiar
          </button>
        )}
      </div>
      <div className="px-3.5 py-2 border-b border-gray-100 shrink-0">
        <div className="relative">
          <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar…"
            autoFocus
            className="w-full pl-8 pr-2.5 py-1.5 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-accent-400"
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {visible.length === 0
          ? <p className="px-3.5 py-2 text-sm text-gray-500">Sin coincidencias</p>
          : visible.map((v) => (
            <label key={v} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-accent-600 w-4 h-4"
                checked={active.has(v)}
                onChange={() => toggle(v)}
              />
              <span className="text-sm text-gray-700 truncate">{v || 'Sin valor'}</span>
            </label>
          ))
        }
      </div>
    </div>,
    document.body,
  );
}

/* ── Sort icon ────────────────────────────────────────────────────────────── */

function SortIcon<K extends string>({ col, sortCol, sortDir }: { col: K; sortCol: K | null; sortDir: SortDir }) {
  if (sortCol !== col) return <CaretUpDown size={13} className="text-gray-300 shrink-0" />;
  return sortDir === 'asc'
    ? <CaretUp size={13} className="text-accent-500 shrink-0" />
    : <CaretDown size={13} className="text-accent-500 shrink-0" />;
}

/* ── Table ────────────────────────────────────────────────────────────────── */

export interface DataTableProps<T, K extends string> {
  controls: DataTableControls<T, K>;
  renderCell: (row: T, key: K) => React.ReactNode;
  renderActions?: (row: T) => React.ReactNode;
  actionsWidth?: number;
  actionsLabel?: string;
  empty?: React.ReactNode;
  rowClassName?: (row: T) => string;
  loading?: boolean;
  /** Toolbar rendered above the table, receiving the table controls. */
  renderToolbar?: (controls: DataTableControls<T, K>) => React.ReactNode;
  /** Content rendered below the table (e.g. pagination). */
  renderFooter?: (controls: DataTableControls<T, K>) => React.ReactNode;
}

export function DataTable<T, K extends string>({
  controls,
  renderCell,
  renderActions,
  actionsWidth = 96,
  actionsLabel = 'Acciones',
  empty,
  rowClassName,
  loading = false,
  renderToolbar,
  renderFooter,
}: DataTableProps<T, K>) {
  const { columns, rows, colWidths, openFilter, sortCol, sortDir, filters } = controls;

  if (loading) {
    return <div className="p-4"><TableSkeleton rows={8} cols={Math.min(columns.length, 8)} /></div>;
  }

  const minWidth = columns.reduce((s, c) => s + colWidths[c.key], 0) + (renderActions ? actionsWidth : 0);

  return (
    <div className="space-y-2">
      {renderToolbar?.(controls)}

      <div className="overflow-x-auto scroll-slim rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="table-fixed border-collapse w-full" style={{ minWidth }}>
          <colgroup>
            {columns.map((c) => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
            {renderActions && <col style={{ width: actionsWidth }} />}
          </colgroup>

          <thead>
            <tr className="bg-gray-50/70 border-b border-gray-200">
              {columns.map((col) => {
                const hasFilter = (filters[col.key]?.size ?? 0) > 0;
                return (
                  <th
                    key={col.key}
                    className="relative select-none text-left px-3 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap border-r border-line last:border-r-0"
                  >
                    <div className="flex items-center gap-1.5 pr-4">
                      <button
                        onClick={() => controls.toggleSort(col.key)}
                        className="flex items-center gap-1 hover:text-gray-800 transition-colors min-w-0"
                      >
                        <span className="truncate">{col.label}</span>
                        <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilter?.col === col.key) { controls.setOpenFilter(null); return; }
                          const r = e.currentTarget.getBoundingClientRect();
                          const left = Math.min(r.left, window.innerWidth - 272);
                          controls.setOpenFilter({ col: col.key, top: r.bottom + 4, left });
                        }}
                        className={cn('p-0.5 rounded transition-colors shrink-0', hasFilter ? 'text-accent-600' : 'text-gray-300 hover:text-gray-500')}
                        aria-label={`Filtrar ${col.label}`}
                      >
                        <Funnel size={11} />
                      </button>
                    </div>
                    <div
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-accent-400 transition-colors"
                      onMouseDown={(e) => controls.startResize(col.key, e)}
                    />
                  </th>
                );
              })}
              {renderActions && (
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center bg-gray-50/70">
                  {actionsLabel}
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} className="py-14 text-center">
                  {empty ?? <span className="text-sm text-gray-500">Sin resultados</span>}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={controls.getRowKey(row)} className={cn('transition-colors', rowClassName?.(row) ?? 'hover:bg-accent-50/40')}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-2.5 text-xs text-gray-700 border-r border-gray-100 truncate',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {renderCell(row, col.key)}
                    </td>
                  ))}
                  {renderActions && (
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {renderActions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openFilter && (
        <FilterDropdown controls={controls} col={openFilter.col} top={openFilter.top} left={openFilter.left} />
      )}

      {renderFooter?.(controls)}
    </div>
  );
}
