import { ShoppingCart, User, Search, Menu, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { catalogCategories } from '../utils/catalogCategories';
import { useNavigationMenu } from '../contexts/NavigationContext';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('search') ?? '');
  const { user, signOut } = useAuth();
  const { itemCount } = useCart();
  const { items: navigationMenu } = useNavigationMenu();

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMegaMenuMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setCategoryMenuOpen(true);
  };

  const handleMegaMenuMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setCategoryMenuOpen(false);
      hoverTimeoutRef.current = null;
    }, 200);
  };

  const toggleMegaMenu = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setCategoryMenuOpen(open => !open);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    const params = new URLSearchParams();
    if (trimmed) {
      params.set('search', trimmed);
    }

    const nextUrl = `/catalog${params.toString() ? `?${params.toString()}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.location.href = nextUrl;
    } else {
      window.location.reload();
    }

    setMobileMenuOpen(false);
    setCategoryMenuOpen(false);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    const params = new URLSearchParams();
    if (trimmed) {
      params.set('search', trimmed);
    }

    const nextUrl = `/catalog${params.toString() ? `?${params.toString()}` : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.location.href = nextUrl;
    } else {
      window.location.reload();
    }

    setMobileMenuOpen(false);
    setCategoryMenuOpen(false);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="bg-slate-900 text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>Enterprise POS hardware experts</span>
            <span>Fast shipping across North America</span>
            <span>Net terms available for approved accounts</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <a href="/orders" className="hover:text-slate-300">
                  Orders
                </a>
                <a href="/account" className="hover:text-slate-300">
                  My Account
                </a>
                <button onClick={signOut} className="hover:text-slate-300">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="hover:text-slate-300">
                  Sign In
                </a>
                <a href="/register" className="hover:text-slate-300">
                  Register
                </a>
              </>
            )}
            <a href="/contact" className="hidden sm:inline hover:text-slate-300">
              Talk to a specialist
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-6">
          <a href="/" className="text-2xl font-bold text-slate-800">
            TechSpry
          </a>

          <div className="hidden lg:flex flex-1 max-w-2xl mx-8">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <label htmlFor="site-search-desktop" className="sr-only">
                Search the TechSpry catalog
              </label>
              <input
                id="site-search-desktop"
                type="text"
                placeholder="Search products, SKUs, manufacturers, or use-cases"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
            </form>
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
              aria-label="Toggle navigation"
            >
              <Menu className="h-6 w-6 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="lg:hidden mt-4">
          <form onSubmit={handleSearchSubmit} className="relative">
            <label htmlFor="site-search-mobile" className="sr-only">
              Search the TechSpry catalog
            </label>
            <input
              id="site-search-mobile"
              type="text"
              placeholder="Search products, brands, or keywords"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>

      <nav className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden lg:flex items-center justify-between py-3">
            <div className="flex items-center gap-6">
              <div
                className="relative"
                onMouseEnter={handleMegaMenuMouseEnter}
                onMouseLeave={handleMegaMenuMouseLeave}
              >
                <button
                  type="button"
                  onClick={toggleMegaMenu}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Shop products
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${categoryMenuOpen ? 'rotate-180 text-blue-600' : 'text-gray-500'}`}
                  />
                </button>
                {categoryMenuOpen && (
                  <div
                    className="absolute left-0 top-full mt-3 w-screen max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-xl"
                    onMouseEnter={handleMegaMenuMouseEnter}
                    onMouseLeave={handleMegaMenuMouseLeave}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
                      {catalogCategories.map(category => (
                        <a
                          key={category.slug}
                          href={`/catalog?category=${category.slug}`}
                          onClick={() => setCategoryMenuOpen(false)}
                          className="group rounded-xl border border-transparent p-4 transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          <div className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">
                            {category.label}
                          </div>
                          <p className="mt-2 text-sm leading-snug text-gray-600">{category.description}</p>
                          {category.highlights && (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                              {category.highlights.map(highlight => (
                                <span key={highlight} className="rounded-full bg-white px-2 py-1 font-medium">
                                  {highlight}
                                </span>
                              ))}
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden xl:flex items-center gap-6">
                {catalogCategories.slice(0, 3).map(category => (
                  <a
                    key={category.slug}
                    href={`/catalog?category=${category.slug}`}
                    className="text-sm font-medium text-gray-700 hover:text-blue-600"
                  >
                    {category.label}
                  </a>
                ))}
                <a href="/catalog" className="text-sm font-medium text-gray-700 hover:text-blue-600">
                  View all products
                </a>
              </div>
            </div>

            <div className="flex gap-6">
              {navigationMenu.map(item => (
                <a
                  key={item.id}
                  href={item.href}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden py-4 space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2">Shop by category</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catalogCategories.map(category => (
                    <a
                      key={category.slug}
                      href={`/catalog?category=${category.slug}`}
                      onClick={closeMobileMenu}
                      className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-600"
                    >
                      <div>{category.label}</div>
                      <p className="mt-1 text-xs text-gray-500">{category.description}</p>
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2">Quick links</h3>
                <div className="space-y-2">
                  {navigationMenu.map(item => (
                    <a
                      key={item.id}
                      href={item.href}
                      onClick={closeMobileMenu}
                      className="block py-2 text-sm font-medium text-gray-700 hover:text-blue-600"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
