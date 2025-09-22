'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Settings, Lock, LogOut, ChevronDown } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

const routes = [
  { path: '/', name: 'Home', icon: '🏠' },
  { path: '/dashboard', name: 'Dashboard', icon: '📊', permission: 'dashboard' },
  { path: '/users', name: 'Users', icon: '👥', permission: 'users' },
  { path: '/sapodata', name: 'SAP OData', icon: '🔗', permission: 'sapodata' },
  { path: '/chat', name: 'Chat AI', icon: '💬', permission: 'chat' },
  { path: '/permissions', name: 'Permissions', icon: '🔐', permission: 'permissions' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { user, logout, hasPermission, isLoading } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  const handlePasswordChange = () => {
    setShowPasswordModal(true);
    setShowUserMenu(false);
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <>
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
            <div className="hidden md:flex gap-4 items-center">
              {routes.slice(1)
                .filter(route => !route.permission || hasPermission(route.permission))
                .map((route) => (
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
              
              {user && (
                <div className="flex items-center gap-3 ml-4 border-l border-gray-600 pl-4">
                  <span className="text-blue-200 text-sm">
                    Welcome, {user.name}
                  </span>
                  
                  {/* User Menu Dropdown */}
                  <div className="relative">
                    <Button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      variant="outline"
                      size="sm"
                      className="text-white border-gray-600 hover:bg-gray-700 flex items-center gap-1"
                    >
                      <Settings className="h-4 w-4" />
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    
                    {showUserMenu && (
                      <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-600 rounded-md shadow-lg min-w-48 z-50">
                        <button
                          onClick={handlePasswordChange}
                          className="w-full text-left px-4 py-3 text-blue-300 hover:bg-gray-700 hover:text-blue-200 transition-colors border-b border-gray-600 flex items-center gap-2"
                        >
                          <Lock className="h-4 w-4" />
                          Passwort ändern
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-3 text-blue-300 hover:bg-gray-700 hover:text-blue-200 transition-colors flex items-center gap-2"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <details className="relative">
                <summary className="text-white cursor-pointer p-2 hover:bg-gray-700 rounded-md transition-colors">
                  ☰ Menu
                </summary>
                <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-600 rounded-md shadow-lg min-w-48 z-50">
                  {routes.slice(1)
                    .filter(route => !route.permission || hasPermission(route.permission))
                    .map((route) => (
                      <Link 
                        key={route.path}
                        href={route.path} 
                        className={`block no-underline px-4 py-3 transition-colors border-b border-gray-600 ${
                          isActive(route.path)
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-blue-300 hover:bg-gray-700 hover:text-blue-200'
                        }`}
                      >
                        {route.icon} {route.name}
                      </Link>
                    ))}
                  
                  {user && (
                    <div className="px-4 py-3 border-t border-gray-600">
                      <p className="text-blue-200 text-sm mb-3">
                        Welcome, {user.name}
                      </p>
                      <div className="space-y-2">
                        <Button
                          onClick={handlePasswordChange}
                          variant="outline"
                          size="sm"
                          className="w-full text-white border-gray-600 hover:bg-gray-700 flex items-center gap-2 justify-start"
                        >
                          <Lock className="h-4 w-4" />
                          Passwort ändern
                        </Button>
                        <Button
                          onClick={handleLogout}
                          variant="outline"
                          size="sm"
                          className="w-full text-white border-gray-600 hover:bg-gray-700 flex items-center gap-2 justify-start"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      </nav>

      {/* Password Change Modal */}
      <ChangePasswordModal 
        open={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </>
  );
}
