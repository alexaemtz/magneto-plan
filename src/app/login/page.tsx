'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Wrench } from '@phosphor-icons/react';
import toast from 'react-hot-toast';

// Static sliver of the ramp board — one product-true moment instead of a
// feature list. Purely decorative, so it is removed from the a11y tree.
const BOARD = [
  { bay: 'Rampa 1', blocks: [{ w: '32%', c: 'bg-accent-500/80' }, { w: '24%', c: 'bg-emerald-500/70' }] },
  { bay: 'Rampa 2', blocks: [{ w: '12%', c: 'bg-amber-500/80' }, { w: '30%', c: 'bg-accent-500/60' }] },
  { bay: 'Rampa 3', blocks: [{ w: '20%', c: 'bg-emerald-500/60' }] },
  { bay: 'Alineador', blocks: [{ w: '26%', c: 'bg-sky-500/70' }] },
];

export default function LoginPage() {
  const { signIn, signInWithGoogle, signOut, user, active, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && active) router.replace('/');
  }, [user, active, authLoading, router]);

  if (user && !authLoading && active === false) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-ink px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Wrench size={26} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Cuenta pendiente de aprobación</h2>
          <p className="text-sm text-gray-500 mb-6">
            Tu cuenta ({user.email}) ya fue creada, pero un administrador debe activarla antes de que puedas acceder a Magneto Plan.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // Redirect handled by useEffect above once onIdTokenChanged sets the cookie
    } catch {
      toast.error('Credenciales incorrectas');
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      toast.error('No se pudo iniciar sesión con Google');
      setGoogleLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-ink p-12 text-white">
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent-600 flex items-center justify-center ring-1 ring-white/10">
            <Wrench size={22} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight tracking-tight">Magneto Plan</p>
            <p className="text-xs text-accent-300 leading-tight">Postventa BYD Hermosillo</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight leading-tight max-w-[16ch]">
            El taller, ordenado de principio a fin.
          </h1>
          <p className="text-sm text-gray-300 mt-3 max-w-[42ch] leading-relaxed">
            Programa servicios, da seguimiento a casos y refacciones, y consulta los indicadores del día desde un mismo lugar.
          </p>

          <div aria-hidden="true" className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between pb-3 text-[11px] font-medium text-gray-400">
              <span>Magneto Plan · hoy</span>
              <span className="tabular">07:00 – 21:00</span>
            </div>
            <div className="space-y-2.5">
              {BOARD.map((row) => (
                <div key={row.bay} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {row.bay}
                  </span>
                  <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md bg-white/[0.04] px-1.5">
                    {row.blocks.map((b, i) => (
                      <span key={i} className={`h-4 rounded-[4px] ${b.c}`} style={{ width: b.w }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative text-xs text-gray-600">© {new Date().getFullYear()} Magneto Plan — BYD Hermosillo</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-paper px-6 py-12 min-h-[100dvh]">
        <div className="w-full max-w-md">
          {/* Logo (mobile) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent-600 flex items-center justify-center mb-3 ring-1 ring-black/5">
              <Wrench size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Magneto Plan</h1>
            <p className="text-sm text-gray-500 mt-0.5">Postventa BYD Hermosillo</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_20px_40px_-15px_rgba(17,24,39,0.12)] p-8">
            <h2 className="text-lg font-semibold text-gray-900">Iniciar sesión</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">Accede con tu cuenta de trabajo.</p>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="pressable w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {googleLoading ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                  <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                </svg>
              )}
              Continuar con Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-500 font-medium">o</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Email / password */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <label htmlFor="login-email" className="text-xs font-semibold text-gray-700">
                  Correo electrónico
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500/70 focus:border-accent-500"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="login-password" className="text-xs font-semibold text-gray-700">Contraseña</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 bg-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-500/70 focus:border-accent-500"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="pressable w-full py-3 px-4 rounded-xl bg-accent-600 text-white font-semibold text-sm hover:bg-accent-700 disabled:opacity-60 transition-colors mt-2"
              >
                {loading ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
