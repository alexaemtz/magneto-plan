'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onIdTokenChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { cacheClear } from '@/lib/cache';
import { Role, PageKey, PagePermissions, DEFAULT_PAGE_PERMISSIONS } from '@/types';

const DEFAULT_COLOR = '#2563EB';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  active: boolean | null;
  isAdmin: boolean;
  permissions: Record<PageKey, PagePermissions> | null;
  displayName: string;
  avatarColor: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const googleProvider = new GoogleAuthProvider();

interface CacheEntry {
  role: Role;
  active: boolean;
  permissions: Record<PageKey, PagePermissions>;
  displayName: string;
  avatarColor: string;
  ts: number;
}

const syncCache = new Map<string, CacheEntry>();
const SYNC_TTL = 5 * 60_000;

async function syncUserDoc(u: User): Promise<Omit<CacheEntry, 'ts'>> {
  const cached = syncCache.get(u.uid);
  if (cached && Date.now() - cached.ts < SYNC_TTL) {
    const { ts: _, ...rest } = cached;
    return rest;
  }

  const ref = doc(db, 'users', u.uid);
  const snap = await getDoc(ref);
  let role: Role;
  let active: boolean;
  let permissions: Record<PageKey, PagePermissions>;
  let displayName: string;
  let avatarColor: string;

  if (!snap.exists()) {
    // Cuenta nueva: queda inactiva hasta que un admin la apruebe manualmente.
    permissions  = { ...DEFAULT_PAGE_PERMISSIONS };
    displayName  = u.displayName ?? '';
    avatarColor  = DEFAULT_COLOR;
    active       = false;
    await setDoc(ref, {
      uid: u.uid,
      email: u.email,
      displayName,
      avatarColor,
      role: 'user' as Role,
      active,
      permissions,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    role = 'user';
  } else {
    await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true });
    const data = snap.data();
    role        = (data.role as Role) ?? 'user';
    active      = (data.active as boolean) ?? false;
    permissions = (data.permissions as Record<PageKey, PagePermissions>) ?? { ...DEFAULT_PAGE_PERMISSIONS };
    displayName = (data.displayName as string) ?? u.displayName ?? '';
    avatarColor = (data.avatarColor as string) ?? DEFAULT_COLOR;
  }

  const entry = { role, active, permissions, displayName, avatarColor, ts: Date.now() };
  syncCache.set(u.uid, entry);
  return { role, active, permissions, displayName, avatarColor };
}

async function persistSession(idToken: string) {
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

async function clearSession() {
  await fetch('/api/auth/session', { method: 'DELETE' });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<User | null>(null);
  const [role, setRole]           = useState<Role | null>(null);
  const [active, setActive]       = useState<boolean | null>(null);
  const [permissions, setPerms]   = useState<Record<PageKey, PagePermissions> | null>(null);
  const [displayName, setName]    = useState('');
  const [avatarColor, setColor]   = useState(DEFAULT_COLOR);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (u) {
        try {
          const idToken = await u.getIdToken();
          await persistSession(idToken);
        } catch (err) {
          console.warn('No se pudo establecer la sesión:', err);
        }

        let role: Role = 'user';
        let isActive = false; // fail-closed si no se puede confirmar el estado
        let perms: Record<PageKey, PagePermissions> = { ...DEFAULT_PAGE_PERMISSIONS };
        let name = '';
        let color = DEFAULT_COLOR;
        try {
          const result = await syncUserDoc(u);
          role     = result.role;
          isActive = result.active;
          perms    = result.permissions;
          name     = result.displayName;
          color    = result.avatarColor;
        } catch (err) {
          console.warn('Error sincronizando perfil en Firestore:', err);
        }

        setRole(role);
        setActive(isActive);
        setPerms(perms);
        setName(name);
        setColor(color);
      } else {
        setRole(null);
        setActive(null);
        setPerms(null);
        setName('');
        setColor(DEFAULT_COLOR);
        await clearSession();
      }
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const refreshProfile = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    syncCache.delete(u.uid);
    try {
      const result = await syncUserDoc(u);
      setRole(result.role);
      setActive(result.active);
      setPerms(result.permissions);
      setName(result.displayName);
      setColor(result.avatarColor);
    } catch (err) {
      console.warn('Error refrescando perfil:', err);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    cacheClear();
    syncCache.clear();
    await Promise.all([firebaseSignOut(auth), clearSession()]);
  };

  return (
    <AuthContext.Provider value={{
      user, role, active, isAdmin: role === 'admin',
      permissions, displayName, avatarColor,
      loading, signIn, signInWithGoogle, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
