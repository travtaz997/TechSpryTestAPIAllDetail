import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/admin/AdminLayout';
import { Save, AlertCircle } from 'lucide-react';

interface Settings {
  company_name: string;
  support_email: string;
  default_currency: string;
  map_enforcement: string;
  po_enabled: boolean;
  require_2fa_admin: boolean;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [settings, setSettings] = useState<Settings>({
    company_name: 'TechSpry',
    support_email: 'support@techspry.com',
    default_currency: 'USD',
    map_enforcement: 'strict',
    po_enabled: true,
    require_2fa_admin: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          'company_name',
          'support_email',
          'default_currency',
          'map_enforcement',
          'po_enabled',
          'require_2fa_admin',
        ]);

      if (data) {
        const settingsObj: any = {};
        data.forEach((item) => {
          settingsObj[item.key] = item.value;
        });
        setSettings(settingsObj);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
      }));

      for (const update of updates) {
        await supabase
          .from('settings')
          .upsert(update, { onConflict: 'key' });
      }

      setSuccess('Settings updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(key: keyof Settings, value: string | boolean) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Settings</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">General</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={settings.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support Email
                </label>
                <input
                  type="email"
                  value={settings.support_email}
                  onChange={(e) => handleChange('support_email', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Pricing</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Currency
                </label>
                <select
                  value={settings.default_currency}
                  onChange={(e) => handleChange('default_currency', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MAP Enforcement Mode
                </label>
                <select
                  value={settings.map_enforcement}
                  onChange={(e) => handleChange('map_enforcement', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="strict">Strict (Always enforce MAP)</option>
                  <option value="flexible">Flexible (Allow exceptions)</option>
                  <option value="none">None (No enforcement)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Checkout</h2>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.po_enabled}
                onChange={(e) => handleChange('po_enabled', e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable PO number field for customers with terms
              </span>
            </label>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Security</h2>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.require_2fa_admin}
                onChange={(e) => handleChange('require_2fa_admin', e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Require 2FA for admin users (not yet implemented)
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
