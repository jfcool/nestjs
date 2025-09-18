import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import Link from 'next/link';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NestJS + Next.js App',
  description: 'Full-stack application with user management and SAP integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {/* Navigation Header */}
          <nav className="bg-gray-800 p-4 mb-4 shadow-sm">
            <div className="max-w-6xl mx-auto flex items-center gap-8">
              <Link 
                href="/" 
                className="text-white text-xl font-bold no-underline hover:text-blue-200 transition-colors"
              >
                🏠 NestJS App
              </Link>
              <div className="flex gap-4">
                <Link 
                  href="/users" 
                  className="text-blue-300 no-underline px-4 py-2 rounded-md hover:bg-gray-700 hover:text-blue-200 transition-colors"
                >
                  👥 Users
                </Link>
                <Link 
                  href="/sapodata" 
                  className="text-blue-300 no-underline px-4 py-2 rounded-md hover:bg-gray-700 hover:text-blue-200 transition-colors"
                >
                  🔗 SAP OData
                </Link>
                <Link 
                  href="/chat" 
                  className="text-blue-300 no-underline px-4 py-2 rounded-md hover:bg-gray-700 hover:text-blue-200 transition-colors"
                >
                  💬 Chat AI
                </Link>
              </div>
            </div>
          </nav>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
