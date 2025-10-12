import { useState } from 'react';
import { seedAdminUser } from '../../utils/seedAdminUser';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';

export default function SeedAdmin() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSeed() {
    setLoading(true);
    setResult(null);
    const res = await seedAdminUser();
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center mb-6">
          <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Bootstrap Admin User</h1>
          <p className="text-gray-600 text-sm">
            This will create the initial admin user for TechSpry. This should only be run once during initial setup.
          </p>
        </div>

        {result && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              result.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm whitespace-pre-line">{result.message}</div>
            </div>
          </div>
        )}

        <button
          onClick={handleSeed}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Seeding...' : 'Seed Admin User'}
        </button>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
          <div className="font-semibold mb-2">Default Credentials:</div>
          <div>Email: travis@ts-enterprises.net</div>
          <div>Password: mypassword123</div>
          <div className="mt-2 text-gray-500">
            (Please change the password after first login)
          </div>
        </div>

        <div className="mt-4 text-center">
          <a href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
            Go to Login →
          </a>
        </div>
      </div>
    </div>
  );
}
