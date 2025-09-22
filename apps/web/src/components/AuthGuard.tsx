'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export function AuthGuard({ children, requiredPermission }: AuthGuardProps) {
  const { user, isLoading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // User is not logged in, redirect to login
        router.push('/login');
        return;
      }

      if (requiredPermission && !hasPermission(requiredPermission)) {
        // User doesn't have required permission, redirect to dashboard
        router.push('/dashboard');
        return;
      }
    }
  }, [user, isLoading, requiredPermission, hasPermission, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if user is not authenticated or doesn't have permission
  if (!user || (requiredPermission && !hasPermission(requiredPermission))) {
    return null;
  }

  return <>{children}</>;
}
