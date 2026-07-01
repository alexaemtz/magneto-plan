'use client';

import { useAuth } from '@/context/AuthContext';
import { PageKey, PagePermissions, DEFAULT_PAGE_PERMISSIONS } from '@/types';

const FULL: PagePermissions = { read: true, create: true, update: true, delete: true };

export function usePermissions(page: PageKey): PagePermissions {
  const { role, permissions } = useAuth();
  if (role === 'admin') return FULL;
  if (!permissions) return DEFAULT_PAGE_PERMISSIONS[page];
  return permissions[page] ?? DEFAULT_PAGE_PERMISSIONS[page];
}
