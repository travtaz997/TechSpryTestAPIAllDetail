import { useEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Filter, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import type { Database } from '../lib/database.types';
import { getHeroImage } from '../utils/productMedia';
import { useCatalogCategories } from '../contexts/CatalogCategoryContext';

type Product = Database['public']['Tables']['products']['Row'];
type Brand = Database['public']['Tables']['brands']['Row'];

type CatalogFilters = {
  brand: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  search: string;
};

const FALLBACK_PRODUCT_IMAGE = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <rect width="400" height="400" rx="28" fill="#F3F4F6" />
    <path d="M72 128h256c13.255 0 24 10.745 24 24v160c0 13.255-10.745 24-24 24H72c-13.255 0-24-10.745-24-24V152c0-13.255 10.745-24 24-24z" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="12" />
    <path d="M72 192h256" stroke="#D1D5DB" stroke-width="12" stroke-linecap="round" />
    <path d="M160 176l40-48 40 48" stroke="#9CA3AF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <circle cx="200" cy="264" r="36" fill="#E5E7EB" />
    <path d="M200 240l20 35h-40l20-35z" fill="#9CA3AF" />
  </svg>
`)} `;

const formatCurrency = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value.toFixed(2);
};

const toTitleCase = (value: string) =>
  value
    .split(/[-_]/)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const PAGE_SIZE = 24;

export default function Catalog() {
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<CatalogFilters>(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      brand: params.get('brand') ?? '',
      category: params.get('category') ?? '',
      minPrice: params.get('minPrice') ?? '',
      maxPrice: params.get('maxPrice') ?? '',
      search: params.get('search') ?? '',
    };
  });
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = Number.parseInt(params.get('page') ?? '1', 10);
    return Number.isNaN(pageParam) ? 1 : Math.max(1, pageParam);
  });
  const { addItem } = useCart();
  const { items: catalogCategories } = useCatalogCategories();

  const brandMap = useMemo(() => {
    const map = new Map<string, Brand>();
    for (const brand of brands) {
      map.set(brand.id, brand);
    }
    return map;
  }, [brands]);

  const categoryMap = useMemo(
    () => new Map(catalogCategories.map(category => [category.slug, category])),
    [catalogCategories],
  );

  const selectedBrand = useMemo(
    () => (filters.brand ? brands.find(brand => brand.slug === filters.brand) ?? null : null),
    [filters.brand, brands],
  );

  const activeCategory = filters.category ? categoryMap.get(filters.category) : undefined;

  useEffect(() => {
    void loadBrands();
  }, []);

  const brandMap = useMemo(() => {
    const map = new Map<string, Brand>();
    for (const brand of brands) {
      map.set(brand.id, brand);
    }
    return map;
  }, [brands]);

  const categoryMap = useMemo(() => new Map(catalogCategories.map(category => [category.slug, category])), []);

  const selectedBrand = useMemo(
    () => (filters.brand ? brands.find(brand => brand.slug === filters.brand) ?? null : null),
    [filters.brand, brands],
  );

  const activeCategory = filters.category ? categoryMap.get(filters.category) : undefined;

  useEffect(() => {
    void loadBrands();
  }, []);

  useEffect(() => {
    if (brands.length === 0) return;
    void loadProducts();
  }, [brands, filters.brand, filters.category, filters.search]);

  useEffect(() => {
    if (window.location.pathname !== '/catalog') return;

    const params = new URLSearchParams();
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.category) params.set('category', filters.category);
    if (filters.minPrice) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    if (filters.search) params.set('search', filters.search);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const searchString = params.toString();
    const nextUrl = searchString ? `/catalog?${searchString}` : '/catalog';
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [filters, currentPage]);

  const filteredProducts = useMemo(
    () => applyClientFilters(rawProducts),
    [rawProducts, filters, brands, brandMap, categoryMap, selectedBrand],
  );

  useEffect(() => {
    setCurrentPage(prevPage => {
      const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
      return Math.min(prevPage, totalPages);
    });
  }, [filteredProducts.length]);

  const updateFilters = (partial: Partial<CatalogFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ brand: '', category: '', minPrice: '', maxPrice: '', search: '' });
    setCurrentPage(1);
  };

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src !== FALLBACK_PRODUCT_IMAGE) {
      event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
    }
  };

  async function loadBrands() {
    const { data, error } = await supabase.from('brands').select('id, name, slug').order('name');
    if (error) {
      console.error('Error loading brands:', error);
      return;
    }
    setBrands(data ?? []);
  }

  async function loadProducts() {
    setLoading(true);
    try {
      let query = supabase.from('products').select('*').eq('published', true);

      if (filters.brand && selectedBrand) {
        query = query.eq('brand_id', selectedBrand.id);
      }

      if (filters.category) {
        query = query.overlaps('categories', [filters.category]);
      }

      const trimmedSearch = filters.search.trim();
      if (trimmedSearch) {
        const sanitizedSearch = trimmedSearch
          .replace(/[%_]/g, '')
          .replace(/[,']/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (sanitizedSearch) {
          const searchPattern = `%${sanitizedSearch}%`;
          const orFilters = [
            `title.ilike.${searchPattern}`,
            `sku.ilike.${searchPattern}`,
            `model.ilike.${searchPattern}`,
            `manufacturer_item_number.ilike.${searchPattern}`,
            `short_desc.ilike.${searchPattern}`,
            `long_desc.ilike.${searchPattern}`,
          ].join(',');
          query = query.or(orFilters);
        }
      }

      const { data, error } = await query.order('title').limit(120);

      if (error) {
        console.error('Error loading products:', error);
        setRawProducts([]);
      } else {
        setRawProducts(data ?? []);
      }
    } catch (error) {
      console.error('Exception loading products:', error);
      setRawProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function applyClientFilters(data: Product[]): Product[] {
    const min = filters.minPrice ? Number.parseFloat(filters.minPrice) : NaN;
    const hasMin = filters.minPrice !== '' && !Number.isNaN(min);
    const max = filters.maxPrice ? Number.parseFloat(filters.maxPrice) : NaN;
    const hasMax = filters.maxPrice !== '' && !Number.isNaN(max);
    const searchTerm = filters.search.trim().toLowerCase();
    const brandId = selectedBrand?.id ?? null;

    return data.filter(product => {
      const salePrice = product.sale_price ?? product.map_price ?? 0;
      const categories = Array.isArray(product.categories) ? product.categories : [];

      if (brandId && product.brand_id !== brandId) return false;
      if (filters.category && !categories.includes(filters.category)) return false;
      if (hasMin && salePrice < min) return false;
      if (hasMax && salePrice > max) return false;
      if (!searchTerm) return true;

      const brandName = brandMap.get(product.brand_id)?.name ?? product.manufacturer ?? '';
      const categoryLabels = categories.map(slug => categoryMap.get(slug)?.label ?? toTitleCase(slug));
      const tags = Array.isArray(product.tags) ? product.tags : [];
      const specValues =
        product.specs && typeof product.specs === 'object'
          ? Object.values(product.specs).flatMap(value => {
              if (typeof value === 'string') return [value];
              if (typeof value === 'number') return [value.toString()];
              return [];
            })
          : [];

      const candidates: unknown[] = [
        product.title,
        product.short_desc,
        product.long_desc,
        product.sku,
        product.model,
        product.manufacturer_item_number,
        brandName,
        ...tags,
        ...categoryLabels,
        ...specValues,
      ];

      return candidates.some(candidate => {
        if (typeof candidate === 'string') return candidate.toLowerCase().includes(searchTerm);
        if (typeof candidate === 'number') return candidate.toString().toLowerCase().includes(searchTerm);
        return false;
      });
    });
  }

  function handleAddToCart(product: Product) {
    const brand = brandMap.get(product.brand_id);
    const image = getHeroImage(product) ?? '';

    addItem({
      productId: product.id,
      sku: product.sku,
      title: product.title,
      brand: brand?.name || product.manufacturer || 'TechSpry',
      image,
      price: product.sale_price ?? product.map_price,
    });
  }

  const totalProducts = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPageSafe - 1) * PAGE_SIZE;
    return filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredProducts, currentPageSafe]);

  const productCountLabel = `${totalProducts} ${totalProducts === 1 ? 'product' : 'products'} available`;
  const startRange = totalProducts === 0 ? 0 : (currentPageSafe - 1) * PAGE_SIZE + 1;
  const endRange = totalProducts === 0 ? 0 : Math.min(totalProducts, startRange + paginatedProducts.length - 1);
  const selectedBrandName = selectedBrand?.name ?? '';

  const paginationPages = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let page = 1; page <= totalPages; page += 1) {
        pages.push(page);
      }
      return pages;
    }

    pages.push(1);
    const windowStart = Math.max(2, currentPageSafe - 1);
    const windowEnd = Math.min(totalPages - 1, currentPageSafe + 1);

    if (windowStart > 2) {
      pages.push('ellipsis');
    }

    for (let page = windowStart; page <= windowEnd; page += 1) {
      pages.push(page);
    }

    if (windowEnd < totalPages - 1) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  }, [totalPages, currentPageSafe]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Product Catalog</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span>{productCountLabel}</span>
            {totalProducts > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Showing {startRange} - {endRange}
              </span>
            )}
            {activeCategory && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                Category: {activeCategory.label}
              </span>
            )}
            {selectedBrandName && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                Brand: {selectedBrandName}
              </span>
            )}
            {filters.search && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                Search: "{filters.search}"
              </span>
            )}
          </div>
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
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-72 space-y-6`}> 
          <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3">
            <h3 className="font-semibold text-gray-800">Search the catalog</h3>
            <input
              type="text"
              placeholder="Search by keyword, SKU, or category"
              value={filters.search}
              onChange={event => updateFilters({ search: event.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500">
              Try product names, manufacturer part numbers, workflows, or technology terms.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3">
            <h3 className="font-semibold text-gray-800">Shop by category</h3>
            <button
              type="button"
              onClick={() => updateFilters({ category: '' })}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                filters.category === ''
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              All categories
            </button>
            <div className="space-y-2">
              {catalogCategories.map(category => {
                const isActive = filters.category === category.slug;
                return (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => updateFilters({ category: isActive ? '' : category.slug })}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    <div className="font-semibold">{category.label}</div>
                    <p className="mt-1 text-xs text-gray-500">{category.description}</p>
                    {category.highlights && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                        {category.highlights.map(highlight => (
                          <span key={highlight} className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-500">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3">
            <h3 className="font-semibold text-gray-800">Filter by brand</h3>
            <select
              value={filters.brand}
              onChange={event => updateFilters({ brand: event.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All brands</option>
              {brands.map(brand => (
                <option key={brand.id} value={brand.slug}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3">
            <h3 className="font-semibold text-gray-800">Price range</h3>
            <div className="space-y-3">
              <input
                type="number"
                min="0"
                placeholder="Min price"
                value={filters.minPrice}
                onChange={event => updateFilters({ minPrice: event.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                min="0"
                placeholder="Max price"
                value={filters.maxPrice}
                onChange={event => updateFilters({ maxPrice: event.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={clearFilters}
            className="w-full px-4 py-2 text-blue-600 font-semibold hover:text-blue-700"
          >
            Clear all filters
          </button>
        </aside>

        <div className="flex-1">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading products...</div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-lg font-semibold text-gray-800 mb-2">No matching products</div>
              <p className="text-gray-600">Try broadening your search or clearing some filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedProducts.map(product => {
                const brandName = brandMap.get(product.brand_id)?.name ?? product.manufacturer ?? 'TechSpry';
                const productImage = getHeroImage(product) ?? FALLBACK_PRODUCT_IMAGE;
                const formattedPrice = formatCurrency(product.sale_price ?? product.map_price);
                const stockLabel = product.stock_status || product.item_status || 'Check availability';
                const normalizedStatus = stockLabel.toLowerCase();
                const stockClass = normalizedStatus.includes('in')
                  ? 'bg-green-100 text-green-800'
                  : normalizedStatus.includes('out')
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-800';
                const productCategories = (Array.isArray(product.categories) ? product.categories : [])
                  .map(slug => categoryMap.get(slug)?.label ?? toTitleCase(slug))
                  .slice(0, 2);

                return (
                  <div key={product.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition">
                    <a href={`/product/${product.sku}`} className="block">
                      <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        <img
                          src={productImage}
                          alt={product.title}
                          loading="lazy"
                          onError={handleImageError}
                          className="h-full w-full object-contain p-6"
                        />
                      </div>
                      <div className="p-4">
                        <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">{brandName}</div>
                        <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 hover:text-blue-600">{product.title}</h3>
                        {product.short_desc && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.short_desc}</p>
                        )}
                        <div className="flex items-center justify-between mb-3">
                          {formattedPrice ? (
                            <div className="text-lg font-bold text-gray-800">${formattedPrice}</div>
                          ) : (
                            <div className="text-sm font-semibold text-blue-600">Call for price</div>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${stockClass}`}>{stockLabel}</span>
                        </div>
                        {productCategories.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {productCategories.map(category => (
                              <span
                                key={`${product.id}-${category}`}
                                className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </a>
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={!formattedPrice}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition text-sm font-semibold flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        {formattedPrice ? 'Add to cart' : 'Contact for pricing'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filteredProducts.length > 0 && totalPages > 1 && (
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                  disabled={currentPageSafe === 1}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {paginationPages.map((page, index) =>
                    page === 'ellipsis' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-sm text-gray-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[2.5rem] rounded-full px-3 py-2 text-sm font-semibold transition ${
                          page === currentPageSafe
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                  disabled={currentPageSafe === totalPages}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                >
                  Next
                </button>
              </div>
              <div className="text-xs text-gray-500">
                Page {currentPageSafe} of {totalPages}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
