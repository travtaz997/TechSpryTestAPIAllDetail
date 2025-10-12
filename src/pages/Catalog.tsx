import { useEffect, useState } from 'react';
import { Filter, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';

interface Product {
  id: string;
  sku: string;
  title: string;
  short_desc: string;
  images: string[];
  msrp: number;
  map_price: number;
  brand_id: string;
  stock_status: string;
  tags: string[];
  categories: string[];
  specs: Record<string, any>;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
}

export default function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    brand: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    loadBrands();

    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');

    console.log('URL category param:', categoryParam);

    if (categoryParam) {
      setFilters(prev => ({ ...prev, category: categoryParam }));
    }
  }, []);

  useEffect(() => {
    if (brands.length > 0) {
      loadProducts();
    }
  }, [filters, brands]);

  async function loadBrands() {
    const { data } = await supabase
      .from('brands')
      .select('id, name, slug')
      .order('name');

    if (data) setBrands(data);
  }

  async function loadProducts() {
    setLoading(true);
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('published', true);

      if (filters.brand) {
        const brand = brands.find(b => b.slug === filters.brand);
        if (brand) {
          query = query.eq('brand_id', brand.id);
        }
      }

      if (filters.category) {
        console.log('Filtering by category:', filters.category);
        query = query.overlaps('categories', [filters.category]);
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,model.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.order('title').limit(50);

      if (error) {
        console.error('Error loading products:', error);
      }

      console.log('Query returned data:', data?.length, 'items');
      console.log('Error:', error);

      if (data) {
        let filtered = data;

        if (filters.minPrice) {
          filtered = filtered.filter(p => p.map_price >= parseFloat(filters.minPrice));
        }
        if (filters.maxPrice) {
          filtered = filtered.filter(p => p.map_price <= parseFloat(filters.maxPrice));
        }

        console.log('Loaded products:', filtered.length, 'with filters:', filters);
        setProducts(filtered);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('Exception loading products:', err);
      setProducts([]);
    }
    setLoading(false);
  }

  function handleAddToCart(product: Product) {
    const brand = brands.find(b => b.id === product.brand_id);
    addItem({
      productId: product.id,
      sku: product.sku,
      title: product.title,
      brand: brand?.name || '',
      image: '',
      price: product.map_price,
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Product Catalog</h1>
          <p className="text-gray-600 mt-2">
            {products.length} {products.length === 1 ? 'product' : 'products'} available
            {filters.category && <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Category: {filters.category}</span>}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Filter className="h-5 w-5" />
          Filters
        </button>
      </div>

      <div className="flex gap-8">
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-64 space-y-6`}>
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">Search</h3>
            <input
              type="text"
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">Brand</h3>
            <select
              value={filters.brand}
              onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Brands</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.slug}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">Price Range</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Min price"
                value={filters.minPrice}
                onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max price"
                value={filters.maxPrice}
                onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={() => setFilters({ brand: '', category: '', minPrice: '', maxPrice: '', search: '' })}
            className="w-full px-4 py-2 text-blue-600 font-semibold hover:text-blue-700"
          >
            Clear Filters
          </button>
        </aside>

        <div className="flex-1">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading products...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-600">No products found. Try adjusting your filters.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition">
                  <a href={`/product/${product.sku}`} className="block">
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      <div className="text-6xl">📦</div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 hover:text-blue-600">
                        {product.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.short_desc}</p>
                      <div className="flex items-center justify-between mb-3">
                        {product.map_price > 0 ? (
                          <div className="text-lg font-bold text-gray-800">${product.map_price.toFixed(2)}</div>
                        ) : (
                          <div className="text-sm font-semibold text-blue-600">Call for price</div>
                        )}
                        <span className={`text-xs px-2 py-1 rounded ${
                          product.stock_status === 'In Stock'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {product.stock_status}
                        </span>
                      </div>
                    </div>
                  </a>
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={product.map_price === 0}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition text-sm font-semibold flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {product.map_price > 0 ? 'Add to Cart' : 'Contact for Price'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
