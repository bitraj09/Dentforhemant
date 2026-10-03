import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import AuthContext from '@/components/AuthContext';
import AppShell from '@/components/layout/AppShell';
import PWARegister from '@/components/PWARegister';
import { DentalStateProvider } from '@/context/DentalStateContext';

export const metadata = {
  title: 'DENTEX Dental Studio — Dental Intelligence',
  description: 'Analyze dental radiographs, explore anatomy, and learn with DENTEX Dental Studio.',
  keywords: ['dental AI', 'radiograph analysis', 'orthopantomogram', 'landmark detection', 'dental diagnosis', 'forensic odontology'],
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FFFFFF" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body suppressHydrationWarning>
        <AuthContext>
          <ThemeProvider>
            <DentalStateProvider>
              <AppShell>{children}</AppShell>
              <PWARegister />
            </DentalStateProvider>
          </ThemeProvider>
        </AuthContext>
      </body>
    </html>
  );
}

