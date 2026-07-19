export type ServiceType =
  | 'SERVICIO'
  | 'GARANTIA'
  | 'DIAGNOSTICO'
  | 'SERVICIO_DIAGNOSTICO'
  | 'SERVICIO_GARANTIA'
  | 'ALINEACION_BALANCEO'
  | 'BALANCEO'
  | 'GARANTIA_DIAGNOSTICO'
  | 'SIN_CITA';

export type AppointmentStatus =
  | 'RECIBIDO'
  | 'PROGRAMADO'
  | 'EN_PROCESO'
  | 'COMPLETADO'
  | 'NO_SHOW'
  | 'ESPERANDO_REFACCION'
  | 'LAVADO'
  | 'ENTREGADO'
  | 'CARRY_OVER';

export type Ramp = 1 | 2 | 3 | 4 | 5 | 6;

export type MaintenanceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Appointment {
  id?: string;
  date: string; // YYYY-MM-DD
  serviceType: ServiceType;
  carModel: string;
  serialNumber: string;
  appByd: boolean;
  invoice: boolean;
  clientName: string;
  clientPhone: string;
  workHours: number;
  workOrder: string;
  ramp: Ramp | null;
  advisor: string;
  tecnico?: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  status: AppointmentStatus;
  km?: number;
  notes?: string;
  lavadoStartTime?: string; // time placed in the LAVADO row — independent of ramp startTime/endTime
  // Service-specific
  maintenanceLevel?: MaintenanceLevel;
  warrantyType?: string;
  diagnosisType?: string;
  sinCitaSubtype?: 'MANTENIMIENTO' | 'GARANTIA' | 'DIAGNOSTICO';
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyIndicatorRow {
  hoy: number;
  realizado: number;
  acumulado: number;
}

export interface DailyIndicator {
  id?: string;
  date: string; // YYYY-MM-DD
  citadosServicio: DailyIndicatorRow;
  citadosServicioPlusOne: DailyIndicatorRow;
  citadosReparacion: DailyIndicatorRow;
  citadosRevision: DailyIndicatorRow;
  sinCita: DailyIndicatorRow;
  totalDia: number;
  ingresosTotal: number;
}

export interface PendingCase {
  id?: string;
  date: string; // YYYY-MM-DD
  carModel: string;
  vin: string;
  reason: string;
  clientName: string;
  clientPhone: string;
  comment?: string;
  partNumber?: string;
  stock?: string;
  workOrder?: string;
  status: string;
  createdAt?: string;
}

export interface Advisor {
  id?: string;
  name: string;
  email?: string;
  active: boolean;
}

export interface Tecnico {
  id?: string;
  name: string;
  active: boolean;
}

export interface CarModel {
  id?: string;
  name: string;
  active: boolean;
}

export type PartsOrderStatus = 'PENDIENTE' | 'ENTREGADO' | 'PEDIDO_ESPECIAL' | 'CANCELADO';

export interface PartsOrder {
  id?: string;
  captureDate: string;    // YYYY-MM-DD
  capturedBy: string;
  requestedBy?: string;
  carModel: string;
  vin: string;
  clientName: string;
  partNumber: string;
  quantity: number;
  description: string;
  price: number;          // MXN
  location: string;
  status: PartsOrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type Role = 'admin' | 'user';

export type PageKey = 'dashboard' | 'gantt' | 'indicador' | 'casosPendientes' | 'refacciones';

export interface PagePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard:       'Dashboard',
  gantt:           'Magneto Plan',
  indicador:       'Indicador Diario',
  casosPendientes: 'Casos Pendientes',
  refacciones:     'Refacciones',
};

export const DEFAULT_PAGE_PERMISSIONS: Record<PageKey, PagePermissions> = {
  dashboard:       { read: true, create: false, update: false, delete: false },
  gantt:           { read: true, create: false, update: false, delete: false },
  indicador:       { read: true, create: false, update: false, delete: false },
  casosPendientes: { read: true, create: false, update: false, delete: false },
  refacciones:     { read: true, create: false, update: false, delete: false },
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  avatarColor?: string;
  role: Role;
  active: boolean;
  permissions?: Record<PageKey, PagePermissions>;
}

export type GanttSlot = {
  time: string; // HH:MM
  appointment?: Appointment;
};

export type GanttRow = {
  label: string;
  type: 'ramp' | 'no_show' | 'wash';
  ramp?: Ramp;
  slots: GanttSlot[];
};
