import { useEffect, useState } from 'react';
import { ShoppingCart, Download, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';

interface Product {
  id: string;
  sku: string;
  title: string;
  short_desc: string;
  long_desc: string;
  images: string[];
  msrp: number;
  map_price: number;
  brand_id: string;
  model: string;
  upc: string;
  stock_status: string;
  lead_time_days: number;
  weight: number;
  warranty: string;
  specs: Record<string, any>;
  datasheet_url: string;
}

interface Brand {
  name: string;
  slug: string;
}

export default function ProductDetail() {
  const [product, setProduct] = useState<Product | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  const sku = window.location.pathname.split('/').pop();

  useEffect(() => {
    if (sku) loadProduct(sku);
  }, [sku]);

  async function loadProduct(sku: string) {
    setLoading(true);
    const { data: productData } = await supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
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

        if (brandData) setBrand(brandData);
      }
    }
    setLoading(false);
  }

  function handleAddToCart() {
    if (!product || !brand) return;
    addItem({
      productId: product.id,
      sku: product.sku,
      title: product.title,
      brand: brand.name,
      image: '',
      price: product.map_price,
    }, quantity);
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
          <a href="/catalog" className="text-blue-600 hover:text-blue-700">Return to Catalog</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="text-sm text-gray-600 mb-6">
        <a href="/" className="hover:text-blue-600">Home</a>
        <span className="mx-2">/</span>
        <a href="/catalog" className="hover:text-blue-600">Catalog</a>
        <span className="mx-2">/</span>
        <span className="text-gray-800">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
        <div>
          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-4">
            <div className="text-9xl">📦</div>
          </div>
        </div>

        <div>
          {brand && (
            <a href={`/brands/${brand.slug}`} className="text-blue-600 font-semibold hover:text-blue-700 mb-2 inline-block">
              {brand.name}
            </a>
          )}
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{product.title}</h1>
          <p className="text-gray-600 mb-6">{product.short_desc}</p>

          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <div className="flex items-baseline gap-3 mb-4">
              {product.map_price > 0 ? (
                <>
                  <div className="text-4xl font-bold text-gray-800">${product.map_price.toFixed(2)}</div>
                  {product.msrp > product.map_price && (
                    <div className="text-xl text-gray-500 line-through">${product.msrp.toFixed(2)}</div>
                  )}
                </>
              ) : (
                <div className="text-2xl font-bold text-blue-600">Call for price</div>
              )}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded text-sm font-medium ${
                product.stock_status === 'In Stock'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {product.stock_status}
              </span>
              {product.lead_time_days > 0 && (
                <span className="text-sm text-gray-600">
                  Lead time: {product.lead_time_days} days
                </span>
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
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-center border-x border-gray-300 py-2"
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
                disabled={product.map_price === 0}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="h-5 w-5" />
                {product.map_price > 0 ? 'Add to Cart' : 'Contact for Price'}
              </button>
              <button className="w-full bg-white border-2 border-blue-600 text-blue-600 py-3 px-6 rounded-lg hover:bg-blue-50 transition font-semibold flex items-center justify-center gap-2">
                <FileText className="h-5 w-5" />
                Request a Quote
              </button>
              {product.datasheet_url && (
                <button className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition font-semibold flex items-center justify-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Spec Sheet
                </button>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <div><span className="font-semibold">SKU:</span> {product.sku}</div>
            {product.model && <div><span className="font-semibold">Model:</span> {product.model}</div>}
            {product.upc && <div><span className="font-semibold">UPC:</span> {product.upc}</div>}
            {product.warranty && <div><span className="font-semibold">Warranty:</span> {product.warranty}</div>}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Product Description</h2>
            <div className="prose max-w-none text-gray-600 mb-8">
              <p>{product.long_desc || product.short_desc}</p>
            </div>

            {Object.keys(product.specs || {}).length > 0 && (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Specifications</h2>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {Object.entries(product.specs || {}).map(([key, value], index) => (
                        <tr key={key} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-6 py-3 font-semibold text-gray-800 w-1/3">{key}</td>
                          <td className="px-6 py-3 text-gray-600">{String(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
