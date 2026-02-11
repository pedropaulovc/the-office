import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import { AppProvider } from '@/context/AppContext';
import { DataProvider } from '@/context/DataContext';
import { listAgents } from '@/db/queries';
import type { Agent } from '@/db/schema';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let agents: Agent[];
  try {
    agents = await listAgents();
  } catch {
    agents = [];
  }

  return (
    <html lang="en">
      <body className={`${lato.variable} font-[family-name:var(--font-lato)] antialiased`}>
        <DataProvider initialAgents={agents}>
          <AppProvider>{children}</AppProvider>
        </DataProvider>
      </body>
    </html>
  );
}
