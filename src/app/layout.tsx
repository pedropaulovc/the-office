import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import { AppProvider } from '@/context/AppContext';
import { DataProvider } from '@/context/DataContext';
import { listAgents, listChannelsWithMembers, getAllUnreads } from '@/db/queries';
import type { Agent } from '@/db/schema';
import type { ChannelView } from '@/db/queries/messages';
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
  let channels: ChannelView[];
  let unreads: Record<string, Record<string, number>>;
  try {
    [agents, channels, unreads] = await Promise.all([
      listAgents(), listChannelsWithMembers(), getAllUnreads(),
    ]);
  } catch {
    agents = [];
    channels = [];
    unreads = {};
  }

  return (
    <html lang="en">
      <body className={`${lato.variable} font-[family-name:var(--font-lato)] antialiased`}>
        <DataProvider initialAgents={agents} initialChannels={channels} initialUnreads={unreads}>
          <AppProvider>{children}</AppProvider>
        </DataProvider>
      </body>
    </html>
  );
}
