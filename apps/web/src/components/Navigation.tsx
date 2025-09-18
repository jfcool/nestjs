'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const routes = [
  { path: '/', name: 'Home', icon: '🏠' },
  { path: '/dashboard', name: 'Dashboard', icon: '📊' },
  { path: '/users', name: 'Users', icon: '👥' },
  { path: '/sapodata', name: 'SAP OData', icon: '🔗' },
  { path: '/chat', name: 'Chat AI', icon: '💬' },
];

export default function Navigation() {
  const pathname = usePathname();

  // Update document title based on current route
  useEffect(() => {
    const currentRoute = routes.find(route => route.path === pathname);
    const routeName = currentRoute ? currentRoute.name : 'Page';
    document.title = `${routeName} - Joe's Playground`;
  }, [pathname]);

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <nav className="bg-gray-800 p-4 mb-4 shadow-sm">
      <div className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link 
            href="/" 
            className="text-white text-xl font-bold no-underline hover:text-blue-200 transition-colors flex items-center gap-2"
          >
            <img 
              src="/JoeCool.jpg" 
              alt="Joe's Playground" 
              className="w-8 h-8 rounded-full object-cover"
            />
            Joe's Playground
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-4">
            {routes.slice(1).map((route) => (
              <Link 
                key={route.path}
                href={route.path} 
                className={`no-underline px-4 py-2 rounded-md transition-colors ${
                  isActive(route.path)
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-blue-300 hover:bg-gray-700 hover:text-blue-200'
                }`}
              >
                {route.icon} {route.name}
              </Link>
            ))}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <details className="relative">
              <summary className="text-white cursor-pointer p-2 hover:bg-gray-700 rounded-md transition-colors">
                ☰ Menu
              </summary>
              <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-600 rounded-md shadow-lg min-w-48 z-50">
                {routes.slice(1).map((route) => (
                  <Link 
                    key={route.path}
                    href={route.path} 
                    className={`block no-underline px-4 py-3 transition-colors border-b border-gray-600 last:border-b-0 ${
                      isActive(route.path)
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-blue-300 hover:bg-gray-700 hover:text-blue-200'
                    }`}
                  >
                    {route.icon} {route.name}
                  </Link>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </nav>
  );
}
