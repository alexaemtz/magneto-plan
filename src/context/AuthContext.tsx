'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAdmin: boolean;
  permissions: Record<PageKey, PagePermissions> | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const googleProvider = new GoogleAuthProvider();

// In-memory cache: avoids re-reading the user doc on every token refresh (~55 min)
const syncCache = new Map<string, { role: Role; permissions: Record<PageKey, PagePermissions>; ts: number }>();
const SYNC_TTL = 5 * 60_000;

async function syncUserDoc(u: User): Promise<{ role: Role; permissions: Record<PageKey, PagePermissions> }> {
  const cached = syncCache.get(u.uid);
  if (cached && Date.now() - cached.ts < SYNC_TTL) {
    return { role: cached.role, permissions: cached.permissions };
  }

  const ref = doc(db, 'users', u.uid);
  const snap = await getDoc(ref);
  let role: Role;
  let permissions: Record<PageKey, PagePermissions>;

  if (!snap.exists()) {
    permissions = { ...DEFAULT_PAGE_PERMISSIONS };
    await setDoc(ref, {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName ?? '',
      role: 'user' as Role,
      active: true,
      permissions,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    role = 'user';
  } else {
    await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true });
    role = (snap.data().role as Role) ?? 'user';
    permissions = (snap.data().permissions as Record<PageKey, PagePermissions>) ?? { ...DEFAULT_PAGE_PERMISSIONS };
  }

  syncCache.set(u.uid, { role, permissions, ts: Date.now() });
  return { role, permissions };
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
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Record<PageKey, PagePermissions> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onIdTokenChanged fires on login, logout, AND token refresh (~every 55 min)
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (u) {
        // 1. Set the session cookie immediately — decoupled from Firestore.
        //    A user authenticated in Firebase Auth always gets access;
        //    Firestore Security Rules protect the data independently.
        try {
          const idToken = await u.getIdToken();
          await persistSession(idToken);
        } catch (err) {
          console.warn('No se pudo establecer la sesión:', err);
        }

        // 2. Sync Firestore user doc separately — failure here does not block login.
        let role: Role = 'user';
        let perms: Record<PageKey, PagePermissions> = { ...DEFAULT_PAGE_PERMISSIONS };
        try {
          const result = await syncUserDoc(u);
          role = result.role;
          perms = result.permissions;
        } catch (err) {
          console.warn('Error sincronizando perfil en Firestore (verifica las Security Rules):', err);
        }

        setRole(role);
        setPermissions(perms);
      } else {
        setRole(null);
        setPermissions(null);
        await clearSession();
      }
      setUser(u);
      setLoading(false);
    });
    return unsub;
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
    <AuthContext.Provider
      value={{ user, role, isAdmin: role === 'admin', permissions, loading, signIn, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
