import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Package,
  ShoppingCart,
  FileText,
  TrendingUp,
  Plus,
  Upload,
  AlertCircle,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';

interface KPIStats {
  publishedProducts: number;
  pendingOrders: number;
  confirmedOrders: number;
  shippedOrders: number;
  quotesAwaiting: number;
  recentInventoryCount: number;
}

interface ActivityItem {
  id: string;
  event: string;
  created_at: string;
  meta: any;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<KPIStats>({
    publishedProducts: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    shippedOrders: 0,
    quotesAwaiting: 0,
    recentInventoryCount: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [
        productsResult,
        ordersResult,
        quotesResult,
        inventoryResult,
        activityResult,
      ] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('published', true),
        supabase.from('orders').select('id, status', { count: 'exact' }),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'Sent'),
        supabase
          .from('inventory_snapshots')
          .select('id', { count: 'exact', head: true })
          .gte('captured_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const ordersCounts = {
        pending: 0,
        confirmed: 0,
        shipped: 0,
      };

      if (ordersResult.data) {
        ordersResult.data.forEach((order) => {
          if (order.status === 'Pending') ordersCounts.pending++;
          else if (order.status === 'Confirmed') ordersCounts.confirmed++;
          else if (order.status === 'Shipped') ordersCounts.shipped++;
        });
      }

      setStats({
        publishedProducts: productsResult.count || 0,
        pendingOrders: ordersCounts.pending,
        confirmedOrders: ordersCounts.confirmed,
        shippedOrders: ordersCounts.shipped,
        quotesAwaiting: quotesResult.count || 0,
        recentInventoryCount: inventoryResult.count || 0,
      });

      if (activityResult.data) {
        setActivities(activityResult.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <div className="flex gap-3">
            <a
              href="/admin/products/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
            >
              <Plus className="w-4 h-4" />
              New Product
            </a>
            <a
              href="/admin/quotes/new"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm"
            >
              <Plus className="w-4 h-4" />
              New Quote
            </a>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold text-sm">
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Published Products</div>
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-800">{stats.publishedProducts}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Pending Orders</div>
              <ShoppingCart className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-gray-800">{stats.pendingOrders}</div>
            <div className="mt-2 text-xs text-gray-500">
              {stats.confirmedOrders} confirmed, {stats.shippedOrders} shipped
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Quotes Awaiting</div>
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-800">{stats.quotesAwaiting}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Inventory Snapshots (24h)</div>
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-800">{stats.recentInventoryCount}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
            {activities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">{activity.event}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(activity.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/admin/products/new"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition text-center"
              >
                <Package className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-sm font-semibold text-gray-800">New Product</div>
              </a>
              <a
                href="/admin/orders"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-yellow-600 hover:bg-yellow-50 transition text-center"
              >
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                <div className="text-sm font-semibold text-gray-800">View Orders</div>
              </a>
              <a
                href="/admin/quotes/new"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-600 hover:bg-green-50 transition text-center"
              >
                <FileText className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="text-sm font-semibold text-gray-800">New Quote</div>
              </a>
              <a
                href="/admin/inventory"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition text-center"
              >
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="text-sm font-semibold text-gray-800">Inventory</div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
