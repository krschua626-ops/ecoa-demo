import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'eCOA Localization Workflow',
  description: 'AI-powered eCOA localization prototype',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 antialiased h-screen overflow-hidden`}>
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-auto h-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
