import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, Download, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
}

interface Product {
  id: string;
  sku: string;
  title: string;
  short_desc: string;
  images: string[];
  msrp: number;
  map_price: number;
  sale_price: number | null;
  reseller_price: number | null;
  brand_id: string;
}

export default function Home() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadBrands();
    loadFeaturedProducts();
  }, []);

  async function loadBrands() {
    const { data } = await supabase
      .from('brands')
      .select('*')
      .limit(12);

    if (data) setBrands(data);
  }

  async function loadFeaturedProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('published', true)
      .limit(8);

    if (data) setFeaturedProducts(data);
  }

  const categories = [
    { name: 'POS Systems', icon: '🖥️', slug: 'pos-systems' },
    { name: 'Receipt Printers', icon: '🖨️', slug: 'receipt-printers' },
    { name: 'Barcode Scanners', icon: '📱', slug: 'barcode-scanners' },
    { name: 'Mobile Computers', icon: '📲', slug: 'mobile-computers' },
    { name: 'Label Printers', icon: '🏷️', slug: 'label-printers' },
    { name: 'Card Readers', icon: '💳', slug: 'card-readers-and-payments' },
    { name: 'Touch Displays', icon: '📺', slug: 'touch-displays' },
    { name: 'RFID & Supplies', icon: '📡', slug: 'rfid-and-supplies' },
    { name: 'WiFi Devices', icon: '📡', slug: 'wifi-devices'}
  ];

  const solutions = [
    {
      title: 'Retail POS',
      description: 'Complete point-of-sale solutions for modern retail environments',
      href: '/solutions/retail-pos',
    },
    {
      title: 'Quick Service Restaurant',
      description: 'Fast, reliable technology for high-volume food service',
      href: '/solutions/qsr',
    },
    {
      title: 'Warehouse Management',
      description: 'Rugged mobile computers and scanning solutions for logistics',
      href: '/solutions/warehouse',
    },
    {
      title: 'Healthcare',
      description: 'Medical-grade hardware for patient care and inventory tracking',
      href: '/solutions/healthcare',
    },
  ];

  return (
    <div>
      <section className="bg-gradient-to-br from-slate-800 to-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-6">
              Enterprise Hardware Solutions for Your Business
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Trusted by nationwide. Shop from the industry's leading brands with competitive pricing and expert support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/catalog"
                className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                Shop Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3 bg-white text-slate-800 font-semibold rounded-lg hover:bg-gray-100 transition"
              >
                Request a Quote
              </a>
            </div>
            <div className="flex flex-wrap gap-6 mt-8 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Authorized Reseller</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Secure Checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Net Terms Available</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-gray-800 mb-8">
            Authorized Partner of Leading Brands
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {brands.map((brand) => (
              <a
                key={brand.id}
                href={`/brands/${brand.slug}`}
                className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-lg transition flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{brand.name}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Shop by Category</h2>
          <p className="text-gray-600 mb-8">Find the right technology for your business needs</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {categories.map((category) => (
              <a
                key={category.slug}
                href={`/catalog?category=${category.slug}`}
                className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">{category.icon}</div>
                <h3 className="font-semibold text-gray-800">{category.name}</h3>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Featured Products</h2>
              <p className="text-gray-600">Popular items from our catalog</p>
            </div>
            <a href="/catalog" className="text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-2">
              View All
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  <div className="text-6xl">📦</div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">{product.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.short_desc}</p>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      {(product.sale_price ?? product.map_price ?? 0) > 0 ? (
                        <div className="text-lg font-bold text-gray-800">
                          ${(product.sale_price ?? product.map_price ?? 0).toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-sm font-semibold text-blue-600">Call for price</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition text-sm font-semibold flex items-center justify-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      {(product.sale_price ?? product.map_price ?? 0) > 0 ? 'Add to Cart' : 'Contact for Price'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Industry Solutions</h2>
          <p className="text-gray-600 mb-8">Tailored technology packages for your specific business needs</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {solutions.map((solution) => (
              <a
                key={solution.title}
                href={solution.href}
                className="bg-white p-8 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-lg transition group"
              >
                <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition">
                  {solution.title}
                </h3>
                <p className="text-gray-600 mb-4">{solution.description}</p>
                <span className="text-blue-600 font-semibold flex items-center gap-2">
                  Learn More
                  <ArrowRight className="h-5 w-5" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Resources & Support</h2>
            <p className="text-gray-600 mb-8">
              Access product datasheets, integration guides, and expert recommendations
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/resources"
                className="inline-flex items-center justify-center px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition"
              >
                <Download className="mr-2 h-5 w-5" />
                Browse Resources
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                Contact an Expert
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Request a custom quote for your project or speak with our sales team
          </p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Request a Quote
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
        </div>
      </section>
    </div>
  );
}
