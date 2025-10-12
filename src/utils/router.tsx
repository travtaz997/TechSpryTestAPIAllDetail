import { ReactNode } from 'react';
import Home from '../pages/Home';
import Catalog from '../pages/Catalog';
import ProductDetail from '../pages/ProductDetail';
import Cart from '../pages/Cart';
import Login from '../pages/Login';
import Register from '../pages/Register';
import SeedData from '../pages/SeedData';
import Orders from '../pages/Orders';
import Account from '../pages/Account';
import Checkout from '../pages/Checkout';
import About from '../pages/About';
import Contact from '../pages/Contact';
import SeedAdmin from '../pages/admin/SeedAdmin';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminProducts from '../pages/admin/AdminProducts';
import AdminBrands from '../pages/admin/AdminBrands';
import AdminBrandForm from '../pages/admin/AdminBrandForm';
import AdminOrders from '../pages/admin/AdminOrders';
import AdminProductForm from '../pages/admin/AdminProductForm';
import AdminCategories from '../pages/admin/AdminCategories';
import AdminCustomers from '../pages/admin/AdminCustomers';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminSettings from '../pages/admin/AdminSettings';
import AdminPlaceholder from '../pages/admin/AdminPlaceholder';
import AdminScanSource from '../pages/admin/AdminScanSource';
import { AdminGuard } from './adminGuard';

interface Route {
  path: string;
  component: () => JSX.Element;
  exact?: boolean;
}

const routes: Route[] = [
  { path: '/', component: Home, exact: true },
  { path: '/catalog', component: Catalog },
  { path: '/product/:sku', component: ProductDetail },
  { path: '/cart', component: Cart },
  { path: '/checkout', component: Checkout },
  { path: '/orders', component: Orders },
  { path: '/account', component: Account },
  { path: '/about', component: About },
  { path: '/contact', component: Contact },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/seed', component: SeedData },
  { path: '/seed-admin', component: SeedAdmin },
  { path: '/admin', component: () => <AdminGuard><AdminDashboard /></AdminGuard>, exact: true },
  { path: '/admin/products/:id', component: () => <AdminGuard><AdminProductForm /></AdminGuard> },
  { path: '/admin/products', component: () => <AdminGuard><AdminProducts /></AdminGuard>, exact: true },
  { path: '/admin/brands/:id', component: () => <AdminGuard><AdminBrandForm /></AdminGuard> },
  { path: '/admin/brands', component: () => <AdminGuard><AdminBrands /></AdminGuard>, exact: true },
  { path: '/admin/categories', component: () => <AdminGuard><AdminCategories /></AdminGuard>, exact: true },
  { path: '/admin/variants', component: () => <AdminGuard><AdminPlaceholder title="Product Variants" /></AdminGuard>, exact: true },
  { path: '/admin/bundles', component: () => <AdminGuard><AdminPlaceholder title="Bundles" /></AdminGuard>, exact: true },
  { path: '/admin/customers', component: () => <AdminGuard><AdminCustomers /></AdminGuard>, exact: true },
  { path: '/admin/orders', component: () => <AdminGuard><AdminOrders /></AdminGuard>, exact: true },
  { path: '/admin/quotes', component: () => <AdminGuard><AdminPlaceholder title="Quotes" /></AdminGuard>, exact: true },
  { path: '/admin/price-rules', component: () => <AdminGuard><AdminPlaceholder title="Price Rules" /></AdminGuard>, exact: true },
  { path: '/admin/inventory', component: () => <AdminGuard><AdminPlaceholder title="Inventory" /></AdminGuard>, exact: true },
  { path: '/admin/media', component: () => <AdminGuard><AdminPlaceholder title="Media Library" /></AdminGuard>, exact: true },
  { path: '/admin/promotions', component: () => <AdminGuard><AdminPlaceholder title="Promotions" /></AdminGuard>, exact: true },
  { path: '/admin/content-blocks', component: () => <AdminGuard><AdminPlaceholder title="Content Blocks" /></AdminGuard>, exact: true },
  { path: '/admin/users', component: () => <AdminGuard><AdminUsers /></AdminGuard>, exact: true },
  { path: '/admin/activity-logs', component: () => <AdminGuard><AdminPlaceholder title="Activity Logs" /></AdminGuard>, exact: true },
  { path: '/admin/jobs', component: () => <AdminGuard><AdminPlaceholder title="Jobs" /></AdminGuard>, exact: true },
  { path: '/admin/scansource', component: () => <AdminGuard><AdminScanSource /></AdminGuard>, exact: true },
  { path: '/admin/settings', component: () => <AdminGuard><AdminSettings /></AdminGuard>, exact: true },
];

export function Router(): ReactNode {
  const path = window.location.pathname;

  for (const route of routes) {
    if (route.exact && path === route.path) {
      const Component = route.component;
      return <Component />;
    }

    if (!route.exact) {
      const pattern = route.path.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(path)) {
        const Component = route.component;
        return <Component />;
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">404 - Page Not Found</h1>
      <p className="text-gray-600 mb-6">The page you're looking for doesn't exist.</p>
      <a href="/" className="text-blue-600 hover:text-blue-700 font-semibold">
        Return to Home
      </a>
    </div>
  );
}
