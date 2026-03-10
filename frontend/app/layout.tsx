import type { Metadata } from 'next';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Navbar } from '@/components/layout/Navbar';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { RightSidebar } from '@/components/layout/RightSidebar';

export const metadata: Metadata = {
  title: 'Stock Analyzer',
  description: 'Профессиональная платформа анализа акций с конструктором стратегий и скринером',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <QueryProvider>
            <ProtectedRoute>
              <Navbar />
              <main style={{ paddingTop: 'var(--nav-height)' }}>
                {children}
              </main>
              <RightSidebar />
            </ProtectedRoute>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
