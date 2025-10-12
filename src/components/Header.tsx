import { ShoppingCart, User, Search, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, signOut } = useAuth();
  const { itemCount } = useCart();

  const mainNav = [
    'POS Systems',
    'Receipt Printers',
    'Barcode Scanners',
    'Mobile Computers',
    'Label Printers',
    'WiFi Devices'
  ];

  const secondaryNav = [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="bg-slate-800 text-white py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm">
          <div className="flex gap-6">
            <span>Authorized Reseller</span>
            <span>Secure Checkout</span>
            <span>Net Terms Available</span>
          </div>
          <div className="flex gap-4">
            {user ? (
              <>
                <a href="/orders" className="hover:text-gray-300">Orders</a>
                <a href="/account" className="hover:text-gray-300">My Account</a>
                <button onClick={signOut} className="hover:text-gray-300">Sign Out</button>
              </>
            ) : (
              <>
                <a href="/login" className="hover:text-gray-300">Sign In</a>
                <a href="/register" className="hover:text-gray-300">Register</a>
              </>
            )}
            <a href="/contact" className="hover:text-gray-300">Contact</a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-slate-800">
            TechSpry
          </a>

          <div className="hidden lg:flex flex-1 max-w-2xl mx-8">
            <div className="w-full relative">
              <input
                type="text"
                placeholder="Search products, models, or SKUs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="/account" className="hidden lg:flex items-center gap-2 text-gray-700 hover:text-blue-600">
              <User className="h-5 w-5" />
              <span className="text-sm font-medium">Account</span>
            </a>
            <a href="/cart" className="relative flex items-center gap-2 text-gray-700 hover:text-blue-600">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
              <span className="hidden lg:inline text-sm font-medium">Cart</span>
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden"
            >
              <Menu className="h-6 w-6 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="lg:hidden mt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      <nav className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden lg:flex items-center justify-between py-3">
            <div className="flex flex-wrap gap-6">
              {mainNav.slice(0, 6).map((item) => (
                <a
                  key={item}
                  href={`/catalog?category=${item.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 whitespace-nowrap"
                >
                  {item}
                </a>
              ))}
            </div>
            <div className="flex gap-6">
              {secondaryNav.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden py-4 space-y-2">
              {mainNav.map((item) => (
                <a
                  key={item}
                  href={`/catalog?category=${item.toLowerCase().replace(/\s+/g, '-')}`}
                  className="block py-2 text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  {item}
                </a>
              ))}
              {secondaryNav.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="block py-2 text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
