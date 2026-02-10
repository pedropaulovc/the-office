import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import { AppProvider } from '@/context/AppContext';
import './globals.css';

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-lato',
});

export const metadata: Metadata = {
  title: 'Dunder Mifflin Slack',
  description: 'The Office Slack Clone',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lato.variable} font-[family-name:var(--font-lato)] antialiased`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
