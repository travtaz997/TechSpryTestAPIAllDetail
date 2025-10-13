import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/admin/AdminLayout';
import { Save, ArrowLeft, AlertCircle } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
}

interface ProductFormData {
  sku: string;
  title: string;
  brand_id: string;
  model: string;
  upc: string;
  short_desc: string;
  long_desc: string;
  images: string;
  datasheet_url: string;
  categories: string;
  tags: string;
  specs: string;
  msrp: string;
  map_price: string;
  reseller_price: string;
  price_adjustment_type: 'fixed' | 'percent';
  stock_status: string;
  lead_time_days: string;
  weight: string;
  dimensions: string;
  warranty: string;
  country_of_origin: string;
  published: boolean;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export default function AdminProductForm() {
  const productId = window.location.pathname.split('/')[3];
  const isEdit = productId && productId !== 'new';

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<ProductFormData>({
    sku: '',
    title: '',
    brand_id: '',
    model: '',
    upc: '',
    short_desc: '',
    long_desc: '',
    images: '',
    datasheet_url: '',
    categories: '',
    tags: '',
    specs: '',
    msrp: '0',
    map_price: '0',
    reseller_price: '0',
    price_adjustment_type: 'fixed',
    stock_status: 'In Stock',
    lead_time_days: '0',
    weight: '0',
    dimensions: '',
    warranty: '',
    country_of_origin: '',
    published: true,
  });

  useEffect(() => {
    loadBrands();
    if (isEdit) {
      loadProduct();
    }
  }, []);

  async function loadBrands() {
    const { data } = await supabase.from('brands').select('id, name').order('name');
    if (data) setBrands(data);
  }

  async function loadProduct() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          sku: data.sku,
          title: data.title,
          brand_id: data.brand_id || '',
          model: data.model || '',
          upc: data.upc || '',
          short_desc: data.short_desc || '',
          long_desc: data.long_desc || '',
          images: data.images ? JSON.stringify(data.images, null, 2) : '',
          datasheet_url: data.datasheet_url || '',
          categories: data.categories ? JSON.stringify(data.categories) : '',
          tags: data.tags ? JSON.stringify(data.tags) : '',
          specs: data.specs ? JSON.stringify(data.specs, null, 2) : '',
          msrp: String(data.msrp || 0),
          map_price: String(data.sale_price ?? data.map_price ?? 0),
          reseller_price: String(data.reseller_price ?? 0),
          price_adjustment_type: (data.price_adjustment_type as 'fixed' | 'percent') ?? 'fixed',
          stock_status: data.stock_status || 'In Stock',
          lead_time_days: String(data.lead_time_days || 0),
          weight: String(data.weight || 0),
          dimensions: data.dimensions ? JSON.stringify(data.dimensions, null, 2) : '',
          warranty: data.warranty || '',
          country_of_origin: data.country_of_origin || '',
          published: data.published ?? true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
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
      const msrp = parseFloat(formData.msrp);
      const mapPrice = parseFloat(formData.map_price);
      const resellerPrice = parseFloat(formData.reseller_price);
      const adjustmentType = formData.price_adjustment_type;
      const adjustmentValue = adjustmentType === 'percent'
        ? resellerPrice > 0
          ? ((mapPrice - resellerPrice) / resellerPrice) * 100
          : 0
        : mapPrice - resellerPrice;

      if (mapPrice > msrp) {
        throw new Error('MAP price cannot exceed MSRP');
      }

      let images = null;
      let categories: string[] | null = null;
      let categorySlugs: string[] | null = null;
      let tags = null;
      let specs = null;
      let dimensions = null;

      if (formData.images.trim()) {
        try {
          images = JSON.parse(formData.images);
        } catch {
          throw new Error('Invalid JSON format for images');
        }
      }

      if (formData.categories.trim()) {
        try {
          const parsed = JSON.parse(formData.categories);
          if (!Array.isArray(parsed)) {
            throw new Error('Categories must be an array');
          }

          const sanitizedCategories = parsed
            .map((category) => (typeof category === 'string' ? category.trim() : ''))
            .filter((category): category is string => category.length > 0);

          categories = sanitizedCategories.length > 0 ? sanitizedCategories : null;

          if (sanitizedCategories.length > 0) {
            const normalizedSlugs = Array.from(
              new Set(sanitizedCategories.map(category => slugify(category)).filter(Boolean)),
            );
            categorySlugs = normalizedSlugs.length > 0 ? normalizedSlugs : null;
          }
        } catch {
          throw new Error('Invalid JSON format for categories');
        }
      }

      if (formData.tags.trim()) {
        try {
          tags = JSON.parse(formData.tags);
          if (!Array.isArray(tags)) {
            throw new Error('Tags must be an array');
          }
        } catch {
          throw new Error('Invalid JSON format for tags');
        }
      }

      if (formData.specs.trim()) {
        try {
          specs = JSON.parse(formData.specs);
        } catch {
          throw new Error('Invalid JSON format for specs');
        }
      }

      if (formData.dimensions.trim()) {
        try {
          dimensions = JSON.parse(formData.dimensions);
        } catch {
          throw new Error('Invalid JSON format for dimensions');
        }
      }

      const productData = {
        sku: formData.sku,
        title: formData.title,
        brand_id: formData.brand_id || null,
        model: formData.model || null,
        upc: formData.upc || null,
        short_desc: formData.short_desc || null,
        long_desc: formData.long_desc || null,
        images,
        datasheet_url: formData.datasheet_url || null,
        categories,
        category_slugs: categorySlugs ?? [],
        tags,
        specs,
        msrp: parseFloat(formData.msrp),
        map_price: mapPrice,
        sale_price: mapPrice,
        reseller_price: resellerPrice,
        price_adjustment_type: adjustmentType,
        price_adjustment_value: adjustmentValue,
        stock_status: formData.stock_status,
        lead_time_days: parseInt(formData.lead_time_days) || 0,
        weight: parseFloat(formData.weight),
        dimensions,
        warranty: formData.warranty || null,
        country_of_origin: formData.country_of_origin || null,
        published: formData.published,
      };

      if (isEdit) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', productId);

        if (error) throw error;
        setSuccess('Product updated successfully!');
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) throw error;
        setSuccess('Product created successfully!');

        setTimeout(() => {
          window.location.href = '/admin/products';
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: keyof ProductFormData, value: string | boolean) {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        <div className="flex items-center gap-4 mb-6">
          <a
            href="/admin/products"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </a>
          <h1 className="text-3xl font-bold text-gray-800">
            {isEdit ? 'Edit Product' : 'New Product'}
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
            <h2 className="text-xl font-bold text-gray-800 mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SKU <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => handleChange('sku', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="PROD-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand
                </label>
                <select
                  value={formData.brand_id}
                  onChange={(e) => handleChange('brand_id', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Brand</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Product Title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Model Number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">UPC</label>
                <input
                  type="text"
                  value={formData.upc}
                  onChange={(e) => handleChange('upc', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123456789012"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Description
                </label>
                <textarea
                  value={formData.short_desc}
                  onChange={(e) => handleChange('short_desc', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief product description"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Long Description
                </label>
                <textarea
                  value={formData.long_desc}
                  onChange={(e) => handleChange('long_desc', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Detailed product description"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Datasheet URL
                </label>
                <input
                  type="url"
                  value={formData.datasheet_url}
                  onChange={(e) => handleChange('datasheet_url', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/datasheet.pdf"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categories
                  <span className="text-gray-500 text-xs ml-2">Enter as JSON array: ["item1", "item2"]</span>
                </label>
                <textarea
                  value={formData.categories}
                  onChange={(e) => handleChange('categories', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='["Networking", "Switches"]'
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                  <span className="text-gray-500 text-xs ml-2">Enter as JSON array: ["tag1", "tag2"]</span>
                </label>
                <textarea
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='["featured", "bestseller"]'
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Images
                  <span className="text-gray-500 text-xs ml-2">Enter as JSON object or array</span>
                </label>
                <textarea
                  value={formData.images}
                  onChange={(e) => handleChange('images', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='{"main": "url", "thumbnails": ["url1", "url2"]}'
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specs
                  <span className="text-gray-500 text-xs ml-2">Enter as JSON object</span>
                </label>
                <textarea
                  value={formData.specs}
                  onChange={(e) => handleChange('specs', e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='{"processor": "Intel i7", "memory": "16GB"}'
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Pricing & Inventory</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">MSRP</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.msrp}
                  onChange={(e) => handleChange('msrp', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Sale Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.map_price}
                  onChange={(e) => handleChange('map_price', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reseller Price (Cost)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.reseller_price}
                  onChange={(e) => handleChange('reseller_price', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Status
                </label>
                <select
                  value={formData.stock_status}
                  onChange={(e) => handleChange('stock_status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="In Stock">In Stock</option>
                  <option value="Backorder">Backorder</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.lead_time_days}
                  onChange={(e) => handleChange('lead_time_days', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Shipping & Other</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country of Origin
                </label>
                <input
                  type="text"
                  value={formData.country_of_origin}
                  onChange={(e) => handleChange('country_of_origin', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="USA"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Warranty
                </label>
                <input
                  type="text"
                  value={formData.warranty}
                  onChange={(e) => handleChange('warranty', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="1 Year Manufacturer Warranty"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dimensions
                  <span className="text-gray-500 text-xs ml-2">Enter as JSON object</span>
                </label>
                <textarea
                  value={formData.dimensions}
                  onChange={(e) => handleChange('dimensions', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='{"length": 10, "width": 5, "height": 3, "unit": "inches"}'
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.published}
                onChange={(e) => handleChange('published', e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Published (visible to customers)
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
            </button>
            <a
              href="/admin/products"
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
