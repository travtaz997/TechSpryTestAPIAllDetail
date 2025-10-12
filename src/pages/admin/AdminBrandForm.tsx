import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/admin/AdminLayout';
import { Save, ArrowLeft, AlertCircle } from 'lucide-react';

interface BrandFormData {
  name: string;
  slug: string;
  logo_url: string;
  blurb: string;
}

export default function AdminBrandForm() {
  const brandId = window.location.pathname.split('/')[3];
  const isEdit = brandId && brandId !== 'new';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<BrandFormData>({
    name: '',
    slug: '',
    logo_url: '',
    blurb: '',
  });

  useEffect(() => {
    if (isEdit) {
      loadBrand();
    }
  }, []);

  async function loadBrand() {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name,
          slug: data.slug,
          logo_url: data.logo_url || '',
          blurb: data.blurb || '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand');
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
      const brandData = {
        name: formData.name,
        slug: formData.slug,
        logo_url: formData.logo_url,
        blurb: formData.blurb,
      };

      if (isEdit) {
        const { error } = await supabase
          .from('brands')
          .update(brandData)
          .eq('id', brandId);

        if (error) throw error;
        setSuccess('Brand updated successfully!');
      } else {
        const { error } = await supabase
          .from('brands')
          .insert(brandData);

        if (error) throw error;
        setSuccess('Brand created successfully!');

        setTimeout(() => {
          window.location.href = '/admin/brands';
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: keyof BrandFormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'name' && !isEdit) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
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
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <a
            href="/admin/brands"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </a>
          <h1 className="text-3xl font-bold text-gray-800">
            {isEdit ? 'Edit Brand' : 'New Brand'}
          </h1>
        </div>

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
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Acme Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="acme-corporation"
                />
                <p className="mt-1 text-xs text-gray-500">
                  URL-friendly identifier (auto-generated from name)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={formData.logo_url}
                  onChange={(e) => handleChange('logo_url', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.blurb}
                  onChange={(e) => handleChange('blurb', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description about the brand"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : isEdit ? 'Update Brand' : 'Create Brand'}
            </button>
            <a
              href="/admin/brands"
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
