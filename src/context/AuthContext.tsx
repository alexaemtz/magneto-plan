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
import { Role } from '@/types';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const googleProvider = new GoogleAuthProvider();

async function syncUserDoc(u: User): Promise<Role> {
  const ref = doc(db, 'users', u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName ?? '',
      role: 'user' as Role,
      active: true,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    return 'user';
  }
  await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true });
  return (snap.data().role as Role) ?? 'user';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onIdTokenChanged fires on login, logout, AND token refresh (~every 55 min)
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (u) {
        try {
          const [r, idToken] = await Promise.all([syncUserDoc(u), u.getIdToken()]);
          setRole(r);
          await persistSession(idToken);
        } catch (err) {
          console.warn('Error sincronizando sesión:', err);
          setRole('user');
        }
      } else {
        setRole(null);
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
    // Clear session cookie immediately; onIdTokenChanged(null) will also call clearSession()
    await Promise.all([firebaseSignOut(auth), clearSession()]);
  };

  return (
    <AuthContext.Provider
      value={{ user, role, isAdmin: role === 'admin', loading, signIn, signInWithGoogle, signOut }}
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
