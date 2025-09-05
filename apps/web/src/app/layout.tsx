import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import Link from 'next/link';

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
          <nav style={{ 
            backgroundColor: '#1f2937', 
            padding: '1rem', 
            marginBottom: '1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ 
              maxWidth: '1200px', 
              margin: '0 auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '2rem' 
            }}>
              <Link 
                href="/" 
                style={{ 
                  color: 'white', 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  textDecoration: 'none' 
                }}
              >
                🏠 NestJS App
              </Link>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Link 
                  href="/users" 
                  style={{ 
                    color: '#93c5fd', 
                    textDecoration: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem'
                  }}
                >
                  👥 Users
                </Link>
                <Link 
                  href="/sapodata" 
                  style={{ 
                    color: '#93c5fd', 
                    textDecoration: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem'
                  }}
                >
                  🔗 SAP OData
                </Link>
              </div>
            </div>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}
