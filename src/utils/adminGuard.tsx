import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, profile, loading } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!loading) {
      setChecking(false);
    }
  }, [loading]);

  if (checking || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Authentication Required</h1>
          <p className="text-gray-600 mb-6">You must be signed in to access the admin portal.</p>
          <a
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You do not have administrator privileges required to access this portal.
          </p>
          <a
            href="/"
            className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition font-semibold"
          >
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useAdminCheck() {
  const { profile } = useAuth();
  return {
    isAdmin: profile?.role === 'admin',
    canManage: (requiredRole: 'admin' | 'buyer' | 'viewer') => {
      if (!profile) return false;
      if (profile.role === 'admin') return true;
      if (requiredRole === 'buyer') return profile.role === 'buyer';
      if (requiredRole === 'viewer') return true;
      return false;
    },
  };
}
