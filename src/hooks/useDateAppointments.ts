'use client';

import { useEffect, useState } from 'react';
import { Appointment } from '@/types';
import { subscribeToAppointmentsByDate } from '@/lib/firestore/appointments';

/** Suscripción en tiempo real a las citas de una fecha. */
export function useDateAppointments(date: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);

  // Flag a stale view as loading while the requested date changes — derived in
  // render instead of an effect (avoids a cascading render).
  if (loadedDate !== date) {
    setLoadedDate(date);
    setLoading(true);
  }

  useEffect(() => {
    const unsubscribe = subscribeToAppointmentsByDate(date, (appts) => {
      setAppointments(appts);
      setLoading(false);
    });
    return unsubscribe;
  }, [date]);

  return { appointments, loading };
}
