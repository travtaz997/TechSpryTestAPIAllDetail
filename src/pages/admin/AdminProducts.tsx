import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/admin/AdminLayout';
import { Package, Plus, Search, CreditCard as Edit, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  title: string;
  brand_id: string;
  published: boolean;
  stock_status: string;
  map_price: number;
  updated_at: string;
}

interface Brand {
  id: string;
  name: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [publishedFilter, setPublishedFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const visibleProductIds = useMemo(() => products.map((product) => product.id), [products]);

  useEffect(() => {
    loadData();
  }, [search, brandFilter, publishedFilter]);

  useEffect(() => {
    setSelectedProducts((current) => current.filter((id) => visibleProductIds.includes(id)));
  }, [visibleProductIds]);

  async function loadData() {
    setLoading(true);
    try {
      const [brandsResult, productsQuery] = await Promise.all([
        supabase.from('brands').select('id, name').order('name'),
        buildProductsQuery(),
      ]);

      if (brandsResult.data) setBrands(brandsResult.data);
      if (productsQuery.data) setProducts(productsQuery.data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildProductsQuery() {
    let query = supabase.from('products').select('*').order('updated_at', { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (brandFilter) {
      query = query.eq('brand_id', brandFilter);
    }

    if (publishedFilter !== 'all') {
      query = query.eq('published', publishedFilter === 'published');
    }

    return query.limit(100);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      alert('Error deleting product: ' + error.message);
    } else {
      loadData();
    }
  }

  async function handleBulkDelete() {
    if (selectedProducts.length === 0) return;

    const confirmationMessage =
      selectedProducts.length === 1
        ? 'Are you sure you want to delete the selected product?'
        : `Are you sure you want to delete ${selectedProducts.length} products? This cannot be undone.`;

    if (!confirm(confirmationMessage)) return;

    const { error } = await supabase.from('products').delete().in('id', selectedProducts);

    if (error) {
      alert('Error deleting products: ' + error.message);
    } else {
      setSelectedProducts([]);
      loadData();
    }
  }

  function toggleProductSelection(id: string) {
    setSelectedProducts((current) =>
      current.includes(id) ? current.filter((productId) => productId !== id) : [...current, id]
    );
  }

  function toggleAllProducts() {
    if (selectedProducts.length === visibleProductIds.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(visibleProductIds);
    }
  }

  function getBrandName(brandId: string) {
    return brands.find((b) => b.id === brandId)?.name || 'Unknown';
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedProducts.length === 0 || loading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition font-semibold ${
                selectedProducts.length === 0 || loading
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
              }`}
            >
              <Trash2 className="w-5 h-5" />
              Delete Selected
              {selectedProducts.length > 0 && (
                <span className="ml-1 text-sm font-normal">({selectedProducts.length})</span>
              )}
            </button>
            <a
              href="/admin/products/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              <Plus className="w-5 h-5" />
              New Product
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by title or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Brands</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            <select
              value={publishedFilter}
              onChange={(e) => setPublishedFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No products found</p>
            <a
              href="/admin/products/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              <Plus className="w-5 h-5" />
              Create First Product
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      onChange={toggleAllProducts}
                      checked={visibleProductIds.length > 0 && selectedProducts.length === visibleProductIds.length}
                      aria-label="Select all products"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Brand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        aria-label={`Select product ${product.title}`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                      {product.sku}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">{product.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {getBrandName(product.brand_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                      ${Number(product.map_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          product.stock_status === 'In Stock'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {product.stock_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          product.published
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <a
                          href={`/admin/products/${product.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Showing {products.length} product{products.length !== 1 ? 's' : ''}
        </div>
      </div>
    </AdminLayout>
  );
}
