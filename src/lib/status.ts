import type { AppointmentStatus, PartsOrderStatus, PendingCaseStatus } from '@/types';

/* ── Appointment status ─────────────────────────────────────────────────────
   Single source of truth for every status label/colour in the app. Status is
   reduced to four roles — new (accent), neutral, active (amber), done (green),
   blocked (red) — plus sky for the physical wash step. Service type is never a
   colour: it is read from the label and icon only, so a block carries one hue
   with one meaning. Purple/violet/indigo are banned. */

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  RECIBIDO:            'Recibido',
  PROGRAMADO:          'Programado',
  EN_PROCESO:          'En proceso',
  COMPLETADO:          'Completado',
  LAVADO:              'Lavado',
  NO_SHOW:             'No show',
  ESPERANDO_REFACCION: 'Esperando refacción',
  ENTREGADO:           'Entregado',
  CARRY_OVER:          'Carry over',
};

/** Soft pill: background + text + border, for tables and detail cards. */
export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  RECIBIDO:            'bg-accent-100 text-accent-700 border border-accent-300',
  PROGRAMADO:          'bg-slate-100 text-slate-600 border border-slate-300',
  EN_PROCESO:          'bg-amber-100 text-amber-700 border border-amber-300',
  COMPLETADO:          'bg-emerald-100 text-emerald-700 border border-emerald-300',
  LAVADO:              'bg-sky-100 text-sky-700 border border-sky-300',
  NO_SHOW:             'bg-red-100 text-red-600 border border-red-300',
  ESPERANDO_REFACCION: 'bg-red-100 text-red-600 border border-red-300',
  ENTREGADO:           'bg-emerald-100 text-emerald-700 border border-emerald-300',
  CARRY_OVER:          'bg-slate-100 text-slate-600 border border-slate-300',
};

/** Solid dot, for the Gantt blocks and compact legends. */
export const APPOINTMENT_STATUS_DOT: Record<AppointmentStatus, string> = {
  RECIBIDO:            'bg-accent-500',
  PROGRAMADO:          'bg-slate-400',
  EN_PROCESO:          'bg-amber-500',
  COMPLETADO:          'bg-emerald-500',
  LAVADO:              'bg-sky-500',
  NO_SHOW:             'bg-red-500',
  ESPERANDO_REFACCION: 'bg-red-500',
  ENTREGADO:           'bg-emerald-600',
  CARRY_OVER:          'bg-slate-400',
};

/* ── Pending cases ───────────────────────────────────────────────────────── */
export const PENDING_CASE_STATUSES: PendingCaseStatus[] = ['PENDIENTE', 'EN_PROCESO', 'ENTREGADO'];

export const PENDING_CASE_STATUS_LABELS: Record<PendingCaseStatus, string> = {
  PENDIENTE:  'Pendiente',
  EN_PROCESO: 'En proceso',
  ENTREGADO:  'Entregado',
};

export const PENDING_CASE_STATUS_COLORS: Record<PendingCaseStatus, string> = {
  PENDIENTE:  'bg-amber-100 text-amber-700 border border-amber-300',
  EN_PROCESO: 'bg-sky-100 text-sky-700 border border-sky-300',
  ENTREGADO:  'bg-emerald-100 text-emerald-700 border border-emerald-300',
};

/* ── Parts orders ────────────────────────────────────────────────────────── */
export const PARTS_STATUS_LABELS: Record<PartsOrderStatus, string> = {
  PENDIENTE:       'Pendiente',
  ENTREGADO:       'Entregado',
  PEDIDO_ESPECIAL: 'Pedido especial',
  CANCELADO:       'Cancelado',
};

export const PARTS_STATUS_COLORS: Record<PartsOrderStatus, string> = {
  PENDIENTE:       'bg-amber-100 text-amber-700 border border-amber-300',
  ENTREGADO:       'bg-emerald-100 text-emerald-700 border border-emerald-300',
  PEDIDO_ESPECIAL: 'bg-accent-100 text-accent-700 border border-accent-300',
  CANCELADO:       'bg-red-100 text-red-600 border border-red-300',
};
