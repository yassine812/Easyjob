import type { Metadata } from 'next';
import { Inter, Noto_Sans_Arabic, Geist_Mono } from 'next/font/google';
import './globals.css';
import './career-background.css';
import { CareerBackground } from '@/components/layout/career-background';
import { site } from '@/config/site';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { SocketProvider } from '@/providers/socket-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { I18nProvider } from '@/lib/i18n';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RetireLegacyWorker } from '@/components/layout/retire-legacy-worker';

const interSans = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  keywords: ['recruitment', 'job search', 'AI resume analyzer', 'startup hiring', 'career platform', 'Tunisia tech jobs'],
  authors: [{ name: 'EasyJob Team' }],
  openGraph: {
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    type: 'website',
    locale: 'en_US',
    siteName: site.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};




export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${interSans.variable} ${notoArabic.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <RetireLegacyWorker />
        <CareerBackground />
        <ThemeProvider>
          <I18nProvider>
            <QueryProvider>
              <AuthProvider>
                <SocketProvider>
                  <TooltipProvider delayDuration={250}>
                  {children}
                  <Toaster richColors position="top-right" />
                  </TooltipProvider>
                </SocketProvider>
              </AuthProvider>
            </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
