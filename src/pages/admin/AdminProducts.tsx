import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/admin/AdminLayout';
import { Package, Plus, Search, CreditCard as Edit, Trash2, X } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  title: string;
  brand_id: string | null;
  manufacturer: string | null;
  published: boolean;
  stock_status: string;
  map_price: number;
  sale_price: number | null;
  reseller_price: number | null;
  price_adjustment_type: string | null;
  price_adjustment_value: number | null;
  updated_at: string;
  categories: string[] | null;
}

interface Brand {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [publishedFilter, setPublishedFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [isApplyingCategories, setIsApplyingCategories] = useState(false);

  const pageSize = 25;

  const visibleProductIds = useMemo(() => products.map((product) => product.id), [products]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = totalCount === 0 ? 0 : Math.min(totalCount, (page - 1) * pageSize + products.length);

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(query));
  }, [categories, categorySearch]);

  useEffect(() => {
    loadData();
  }, [search, brandFilter, publishedFilter, page]);

  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase.from('categories').select('id, name').order('name');
      if (error) {
        console.error('Error loading categories:', error);
        return;
      }
      setCategories(data ?? []);
    }

    loadCategories();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, brandFilter, publishedFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [brandsResult, productsQuery] = await Promise.all([
        supabase.from('brands').select('id, name').order('name'),
        buildProductsQuery(),
      ]);

      if (brandsResult.data) setBrands(brandsResult.data);
      if (productsQuery.data) setProducts(productsQuery.data);
      if (typeof productsQuery.count === 'number') setTotalCount(productsQuery.count);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildProductsQuery() {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`title.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (brandFilter) {
      query = query.eq('brand_id', brandFilter);
    }

    if (publishedFilter !== 'all') {
      query = query.eq('published', publishedFilter === 'published');
    }

    return query;
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
    const allVisibleSelected =
      visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedProducts.includes(id));

    if (allVisibleSelected) {
      setSelectedProducts((current) => current.filter((id) => !visibleProductIds.includes(id)));
    } else {
      setSelectedProducts((current) => Array.from(new Set([...current, ...visibleProductIds])));
    }
  }

  function getBrandName(brandId: string | null | undefined) {
    if (!brandId) return '';
    return brands.find((b) => b.id === brandId)?.name || '';
  }

  function getManufacturerDisplay(product: Product) {
    return product.manufacturer || getBrandName(product.brand_id) || 'Unknown';
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  }

  function toggleCategorySelection(id: string) {
    setSelectedCategoryIds((current) =>
      current.includes(id) ? current.filter((categoryId) => categoryId !== id) : [...current, id]
    );
  }

  function openCategoryModal() {
    setSelectedCategoryIds([]);
    setCategorySearch('');
    setIsCategoryModalOpen(true);
  }

  async function handleApplyCategories() {
    if (selectedCategoryIds.length === 0) return;

    setIsApplyingCategories(true);
    const errors: string[] = [];

    for (const productId of selectedProducts) {
      let existingCategories: string[] = [];
      const product = products.find((p) => p.id === productId);

      if (product && Array.isArray(product.categories)) {
        existingCategories = product.categories;
      } else {
        const { data, error } = await supabase
          .from('products')
          .select('categories')
          .eq('id', productId)
          .maybeSingle();

        if (error) {
          errors.push(`Error loading product ${productId}: ${error.message}`);
          continue;
        }

        existingCategories = (data?.categories as string[] | null) ?? [];
      }

      const updatedCategories = Array.from(new Set([...existingCategories, ...selectedCategoryIds]));

      const { error: updateError } = await supabase
        .from('products')
        .update({ categories: updatedCategories })
        .eq('id', productId);

      if (updateError) {
        errors.push(`Error updating product ${productId}: ${updateError.message}`);
      }
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    } else {
      setIsCategoryModalOpen(false);
      setSelectedCategoryIds([]);
      setSelectedProducts([]);
      await loadData();
    }

    setIsApplyingCategories(false);
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openCategoryModal}
              disabled={selectedProducts.length === 0 || loading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition font-semibold ${
                selectedProducts.length === 0 || loading
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
              }`}
            >
              Add Category
              {selectedProducts.length > 0 && (
                <span className="ml-1 text-sm font-normal">({selectedProducts.length})</span>
              )}
            </button>
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
                        checked={
                          visibleProductIds.length > 0 &&
                          visibleProductIds.every((id) => selectedProducts.includes(id))
                        }
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
                    Manufacturer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Pricing
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
                {products.map((product) => {
                  const salePrice = Number(product.sale_price ?? product.map_price ?? 0);
                  const resellerPrice = Number(product.reseller_price ?? 0);
                  const margin = salePrice - resellerPrice;
                  const belowCost = salePrice < resellerPrice;

                  return (
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
                        {getManufacturerDisplay(product)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                        <div className="font-semibold text-gray-800">
                          ${salePrice.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Cost: ${resellerPrice.toFixed(2)}
                        </div>
                        <div className={`text-xs font-semibold ${belowCost ? 'text-red-600' : 'text-green-600'}`}>
                          {belowCost ? 'Margin' : 'Profit'}: ${margin.toFixed(2)}
                        </div>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <div>
            Showing
            <span className="font-semibold mx-1">
              {totalCount === 0 ? 0 : `${startItem}-${endItem}`}
            </span>
            of <span className="font-semibold">{totalCount}</span> product{totalCount === 1 ? '' : 's'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className={`px-3 py-1 rounded border ${
                page === 1 || loading
                  ? 'text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed'
                  : 'text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            <span>
              Page <span className="font-semibold">{page}</span> of{' '}
              <span className="font-semibold">{isFinite(totalPages) ? totalPages : 1}</span>
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className={`px-3 py-1 rounded border ${
                page >= totalPages || loading
                  ? 'text-gray-400 border-gray-200 bg-gray-100 cursor-not-allowed'
                  : 'text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        </div>

        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
            <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-800">Add Categories</h2>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-4">
                <p className="mb-4 text-sm text-gray-600">
                  Select categories to add to {selectedProducts.length} product
                  {selectedProducts.length === 1 ? '' : 's'}.
                </p>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder="Search categories..."
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
                  {filteredCategories.length === 0 ? (
                    <div className="text-sm text-gray-500">No categories found.</div>
                  ) : (
                    filteredCategories.map((category) => (
                      <label key={category.id} className="flex items-center gap-3 rounded border border-gray-200 px-3 py-2 hover:border-blue-200">
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.includes(category.id)}
                          onChange={() => toggleCategorySelection(category.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{category.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setSelectedCategoryIds([]);
                    setCategorySearch('');
                  }}
                >
                  Clear selection
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCategories}
                    disabled={selectedCategoryIds.length === 0 || isApplyingCategories}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                      selectedCategoryIds.length === 0 || isApplyingCategories
                        ? 'bg-blue-200 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isApplyingCategories ? 'Applying...' : 'Apply Categories'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
