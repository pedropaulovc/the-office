import type { Metadata } from 'next';
import { Lato } from 'next/font/google';
import { AppProvider } from '@/context/AppContext';
import { DataProvider } from '@/context/DataContext';
import { listAgents, listChannelsWithMembers } from '@/db/queries';
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
  try {
    [agents, channels] = await Promise.all([listAgents(), listChannelsWithMembers()]);
  } catch {
    agents = [];
    channels = [];
  }

  return (
    <html lang="en">
      <body className={`${lato.variable} font-[family-name:var(--font-lato)] antialiased`}>
        <DataProvider initialAgents={agents} initialChannels={channels}>
          <AppProvider>{children}</AppProvider>
        </DataProvider>
      </body>
    </html>
  );
}
