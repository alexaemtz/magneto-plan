import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SearchProvider } from '@/context/SearchContext';
import { Toaster } from 'react-hot-toast';

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Magneto Plan — BYD Hermosillo',
  description: 'Sistema de gestión de servicio postventa BYD',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50">
        <AuthProvider>
          <SearchProvider>
            {children}
          </SearchProvider>
          <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        </AuthProvider>
      </body>
    </html>
  );
}
