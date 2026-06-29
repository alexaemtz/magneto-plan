export type ServiceType =
  | 'SERVICIO'
  | 'GARANTIA'
  | 'DIAGNOSTICO'
  | 'SERVICIO_DIAGNOSTICO'
  | 'SERVICIO_GARANTIA'
  | 'SIN_CITA';

export type AppointmentStatus =
  | 'PROGRAMADO'
  | 'EN_PROCESO'
  | 'COMPLETADO'
  | 'NO_SHOW'
  | 'ESPERANDO_REFACCION';

export type Ramp = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  status: AppointmentStatus;
  km?: number;
  notes?: string;
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
  status: string;
  createdAt?: string;
}

export interface Advisor {
  id?: string;
  name: string;
  email?: string;
  active: boolean;
}

export interface CarModel {
  id?: string;
  name: string;
  active: boolean;
}

export type Role = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: Role;
  active: boolean;
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
