import { useEffect, useState } from 'react';
import { ShoppingCart, Download, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import type { Database } from '../lib/database.types';

type ProductRow = Database['public']['Tables']['products']['Row'];
type BrandRow = Database['public']['Tables']['brands']['Row'];
type Brand = Pick<BrandRow, 'name' | 'slug'>;
type ProductMedia = { MediaType?: string | null; URL?: string | null; [key: string]: any };

type Attribute = {
  label: string;
  value: unknown;
  formatter?: (value: unknown) => string | null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatNumeric = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, ...options }).format(value);

const formatNumberValue = (options?: Intl.NumberFormatOptions) => (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatNumeric(value, options);
  }
  return null;
};

const formatCategoryPath = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return normalized
    .split('//')
    .map(segment => segment.trim())
    .filter(Boolean)
    .join(' › ');
};

const formatDimensions = (value: unknown): string | null => {
  if (!Array.isArray(value)) return null;
  const dimensions = (value as unknown[]).slice(0, 3).map(entry =>
    typeof entry === 'number' && Number.isFinite(entry) ? entry : null,
  );
  if (dimensions.every(entry => entry === null)) return null;
  return dimensions
    .map(entry => (entry === null ? '—' : formatNumeric(entry)))
    .join(' × ');
};

const getDisplayValue = (attribute: Attribute): string | null => {
  if (attribute.formatter) {
    return attribute.formatter(attribute.value);
  }

  if (attribute.value === null || attribute.value === undefined) {
    return null;
  }

  if (typeof attribute.value === 'string') {
    return normalizeString(attribute.value);
  }

  if (typeof attribute.value === 'number') {
    if (!Number.isFinite(attribute.value)) return null;
    return formatNumeric(attribute.value);
  }

  if (typeof attribute.value === 'boolean') {
    return attribute.value ? 'Yes' : 'No';
  }

  return null;
};

const normalizeMedia = (media: ProductRow['product_media']): ProductMedia[] => {
  if (!media || !Array.isArray(media)) return [];
  return media
    .filter((item): item is ProductMedia => !!item && typeof item === 'object')
    .map(item => item as ProductMedia);
};

const normalizeImages = (images: ProductRow['images']): string[] => {
  if (!images || !Array.isArray(images)) return [];
  return images.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const getHeroImage = (product: ProductRow, mediaList: ProductMedia[]): string | null => {
  for (const media of mediaList) {
    const type = normalizeString(media.MediaType)?.toLowerCase();
    const url = normalizeString(media.URL);
    if (url && type && type.includes('image')) {
      return url;
    }
  }

  for (const media of mediaList) {
    const url = normalizeString(media.URL);
    if (url) return url;
  }

  const fallbackFields = [product.item_image_url, product.product_family_image_url];
  for (const candidate of fallbackFields) {
    const normalized = normalizeString(candidate);
    if (normalized) return normalized;
  }

  const imageArray = normalizeImages(product.images);
  if (imageArray.length > 0) return imageArray[0];

  return null;
};

export default function ProductDetail() {
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  const sku = window.location.pathname.split('/').pop();

  useEffect(() => {
    if (sku) loadProduct(sku);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku]);

  async function loadProduct(productSku: string) {
    setLoading(true);
    const { data: productData } = await supabase
      .from('products')
      .select('*')
      .eq('sku', productSku)
      .eq('published', true)
      .maybeSingle();

    if (productData) {
      setProduct(productData);
      if (productData.brand_id) {
        const { data: brandData } = await supabase
          .from('brands')
          .select('name, slug')
          .eq('id', productData.brand_id)
          .maybeSingle();

        setBrand(brandData || null);
      } else {
        setBrand(null);
      }
    } else {
      setProduct(null);
      setBrand(null);
    }
    setLoading(false);
  }

  function handleAddToCart() {
    if (!product) return;

    const mediaList = normalizeMedia(product.product_media);
    const heroImage = getHeroImage(product, mediaList);
    const brandName = brand?.name || product.manufacturer || 'TechSpry';

    addItem(
      {
        productId: product.id,
        sku: product.sku,
        title: product.title,
        brand: brandName,
        image: heroImage || '',
        price: product.sale_price ?? product.map_price,
      },
      quantity,
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Product Not Found</h1>
          <a href="/catalog" className="text-blue-600 hover:text-blue-700">
            Return to Catalog
          </a>
        </div>
      </div>
    );
  }

  const mediaList = normalizeMedia(product.product_media);
  const heroImage = getHeroImage(product, mediaList);
  const additionalMedia = mediaList.filter(media => normalizeString(media.URL) && normalizeString(media.URL) !== heroImage);
  const manufacturerName = brand?.name || normalizeString(product.manufacturer);
  const descriptionText =
    normalizeString(product.long_desc) ||
    normalizeString(product.item_description) ||
    normalizeString(product.product_family_description) ||
    normalizeString(product.short_desc);
  const categoryPath = formatCategoryPath(product.category_path);
  const availableQuantity =
    typeof product.stock_available === 'number' && Number.isFinite(product.stock_available)
      ? product.stock_available
      : null;

  const attributeSections: { title: string; attributes: Attribute[] }[] = [
    {
      title: 'Catalog & Classification',
      attributes: [
        { label: 'Manufacturer', value: manufacturerName || product.manufacturer },
        { label: 'Manufacturer Item #', value: product.manufacturer_item_number || product.model },
        { label: 'Category Path', value: product.category_path, formatter: formatCategoryPath },
        { label: 'Product Family', value: product.product_family },
        { label: 'Family Description', value: product.product_family_description },
        { label: 'UNSPSC', value: product.unspsc },
      ],
    },
    {
      title: 'Logistics & Compliance',
      attributes: [
        { label: 'Gross Weight', value: product.gross_weight ?? product.weight, formatter: formatNumberValue() },
        {
          label: 'Packaged Dimensions (L × W × H)',
          value: [product.packaged_length, product.packaged_width, product.packaged_height],
          formatter: formatDimensions,
        },
        { label: 'Battery Indicator', value: product.battery_indicator },
        { label: 'RoHS Compliance', value: product.rohs_compliance_indicator },
        { label: 'Country of Origin', value: product.country_of_origin },
      ],
    },
  ];

  const visibleSections = attributeSections
    .map(section => ({
      ...section,
      attributes: section.attributes
        .map(attribute => {
          const display = getDisplayValue(attribute);
          if (!display) return null;
          return { ...attribute, display };
        })
        .filter((attribute): attribute is Attribute & { display: string } => attribute !== null),
    }))
    .filter(section => section.attributes.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="text-sm text-gray-600 mb-4">
        <a href="/" className="hover:text-blue-600">
          Home
        </a>
        <span className="mx-2">/</span>
        <a href="/catalog" className="hover:text-blue-600">
          Catalog
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-800">{product.title}</span>
      </nav>

      {categoryPath && (
        <div className="text-sm text-gray-500 mb-6">Category: {categoryPath}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
        <div>
          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden mb-4">
            {heroImage ? (
              <img src={heroImage} alt={product.title} className="object-contain h-full w-full" />
            ) : (
              <div className="text-9xl">📦</div>
            )}
          </div>

          {additionalMedia.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {additionalMedia.map((media, index) => {
                const url = normalizeString(media.URL);
                if (!url) return null;
                const type = normalizeString(media.MediaType);
                const isImage = type?.toLowerCase().includes('image');
                return (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-gray-200 rounded-lg p-2 hover:border-blue-400 transition flex items-center gap-2 text-sm text-gray-600"
                  >
                    {isImage ? (
                      <img src={url} alt={type || 'Product media'} className="w-12 h-12 object-contain rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                        <ExternalLink className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-gray-700 truncate">{type || 'Media Asset'}</div>
                      <div className="text-xs text-blue-600 truncate">Open asset</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div>
          {manufacturerName && (
            <div className="text-sm uppercase tracking-wide text-blue-600 font-semibold mb-2">{manufacturerName}</div>
          )}
          <h1 className="text-3xl font-bold text-gray-800 mb-3">{product.title}</h1>
          {product.manufacturer_item_number && (
            <div className="text-sm text-gray-500 mb-4">Manufacturer Item #: {product.manufacturer_item_number}</div>
          )}
          {descriptionText && <p className="text-gray-600 mb-6">{descriptionText}</p>}

          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <div className="flex items-baseline gap-3 mb-4">
              {(product.sale_price ?? product.map_price ?? 0) > 0 ? (
                <>
                  <div className="text-4xl font-bold text-gray-800">
                    ${(product.sale_price ?? product.map_price ?? 0).toFixed(2)}
                  </div>
                  {product.msrp > (product.sale_price ?? product.map_price ?? 0) && (
                    <div className="text-xl text-gray-500 line-through">${product.msrp.toFixed(2)}</div>
                  )}
                </>
              ) : (
                <div className="text-2xl font-bold text-blue-600">Call for price</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              {(product.item_status || product.stock_status) && (
                <span
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    (product.item_status || product.stock_status || '').toLowerCase().includes('active')
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  Status: {product.item_status || product.stock_status}
                </span>
              )}
              {availableQuantity !== null && (
                <span className="px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                  {availableQuantity.toLocaleString()} units available
                </span>
              )}
              {product.minimum_order_quantity !== null && product.minimum_order_quantity > 1 && (
                <span className="px-3 py-1 rounded text-sm font-medium bg-purple-100 text-purple-800">
                  MOQ: {product.minimum_order_quantity.toLocaleString()} units
                </span>
              )}
              {product.sell_via_edi && (
                <span className="px-3 py-1 rounded text-sm font-medium bg-teal-100 text-teal-800">EDI Orderable</span>
              )}
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 hover:bg-gray-100"
                >
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 text-center border-x border-gray-300 py-2"
                  min={1}
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAddToCart}
                disabled={(product.sale_price ?? product.map_price ?? 0) === 0}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="h-5 w-5" />
                {(product.sale_price ?? product.map_price ?? 0) > 0 ? 'Add to Cart' : 'Contact for Price'}
              </button>
              <button className="w-full bg-white border-2 border-blue-600 text-blue-600 py-3 px-6 rounded-lg hover:bg-blue-50 transition font-semibold flex items-center justify-center gap-2">
                <FileText className="h-5 w-5" />
                Request a Quote
              </button>
              {product.datasheet_url && (
                <a
                  href={product.datasheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition font-semibold flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download Spec Sheet
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600 mt-6">
              {product.base_unit_of_measure && (
                <div>
                  <span className="font-semibold text-gray-700 block">Base Unit</span>
                  {product.base_unit_of_measure}
                </div>
              )}
              {product.country_of_origin && (
                <div>
                  <span className="font-semibold text-gray-700 block">Country of Origin</span>
                  {product.country_of_origin}
                </div>
              )}
              {product.unspsc && (
                <div>
                  <span className="font-semibold text-gray-700 block">UNSPSC</span>
                  {product.unspsc}
                </div>
              )}
              {product.serial_number_profile && (
                <div>
                  <span className="font-semibold text-gray-700 block">Serialization</span>
                  {product.serial_number_profile}
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            {product.model && (
              <div>
                <span className="font-semibold">Model:</span> {product.model}
              </div>
            )}
            {product.upc && (
              <div>
                <span className="font-semibold">UPC:</span> {product.upc}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Product Description</h2>
            <div className="prose max-w-none text-gray-600 mb-8">
              <p>{descriptionText || 'Detailed description coming soon.'}</p>
            </div>

            {visibleSections.length > 0 && (
              <div className="space-y-8">
                {visibleSections.map(section => (
                  <div key={section.title}>
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">{section.title}</h3>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <tbody>
                          {section.attributes.map((attribute, index) => (
                            <tr key={`${section.title}-${attribute.label}`} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                              <td className="px-6 py-3 font-semibold text-gray-800 w-1/3">{attribute.label}</td>
                              <td className="px-6 py-3 text-gray-600 whitespace-pre-wrap">{attribute.display}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          <div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-4">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Our team of experts is here to help you find the right solution for your business.
              </p>
              <a
                href="/contact"
                className="block w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition text-center font-semibold"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
