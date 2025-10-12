import { ReactNode, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  Layers,
  Tag,
  FolderTree,
  Grid3x3,
  Users,
  ShoppingCart,
  FileText,
  DollarSign,
  BadgeDollarSign,
  Warehouse,
  Image,
  Megaphone,
  FileCode,
  UserCog,
  Activity,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
  Download,
  CreditCard,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Products', path: '/admin/products', icon: Package },
  { name: 'Variants', path: '/admin/variants', icon: Layers },
  { name: 'Brands', path: '/admin/brands', icon: Tag },
  { name: 'Categories', path: '/admin/categories', icon: FolderTree },
  { name: 'Bundles', path: '/admin/bundles', icon: Grid3x3 },
  { name: 'Customers', path: '/admin/customers', icon: Users },
  { name: 'Net Terms', path: '/admin/net-terms', icon: CreditCard },
  { name: 'Orders', path: '/admin/orders', icon: ShoppingCart },
  { name: 'Quotes', path: '/admin/quotes', icon: FileText },
  { name: 'Pricing', path: '/admin/pricing', icon: BadgeDollarSign },
  { name: 'Price Rules', path: '/admin/price-rules', icon: DollarSign },
  { name: 'Inventory', path: '/admin/inventory', icon: Warehouse },
  { name: 'Media', path: '/admin/media', icon: Image },
  { name: 'Promotions', path: '/admin/promotions', icon: Megaphone },
  { name: 'Content Blocks', path: '/admin/content-blocks', icon: FileCode },
  { name: 'Users', path: '/admin/users', icon: UserCog },
  { name: 'Activity Logs', path: '/admin/activity-logs', icon: Activity },
  { name: 'Jobs', path: '/admin/jobs', icon: Briefcase },
  { name: 'ScanSource Import', path: '/admin/scansource', icon: Download },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentPath = window.location.pathname;

  async function handleLogout() {
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-20">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-xl font-bold text-gray-800">TechSpry Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-gray-800">{user?.email}</div>
              <div className="text-xs text-gray-500">{profile?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto z-10 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="pt-16 lg:pl-64">
        <main className="p-6">{children}</main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-0 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
