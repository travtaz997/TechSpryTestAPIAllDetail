import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Package, Calendar, DollarSign, FileText } from 'lucide-react';

interface OrderLine {
  id: string;
  sku: string;
  qty: number;
  unit_price: number;
  currency: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  currency: string;
  po_number: string | null;
  placed_at: string;
  order_lines: OrderLine[];
}

export default function Orders() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && profile) {
      loadOrders();
    }
  }, [user, profile]);

  async function loadOrders() {
    try {
      setLoading(true);

      let query = supabase
        .from('orders')
        .select(`
          id,
          status,
          total,
          currency,
          po_number,
          placed_at,
          order_lines (
            id,
            sku,
            qty,
            unit_price,
            currency
          )
        `)
        .order('placed_at', { ascending: false });

      if (profile?.customer_id && profile?.id) {
        query = query.or(`customer_id.eq.${profile.customer_id},created_by.eq.${profile.id}`);
      } else if (profile?.customer_id) {
        query = query.eq('customer_id', profile.customer_id);
      } else if (profile?.id) {
        query = query.eq('created_by', profile.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Sign In Required</h1>
          <p className="text-gray-600 mb-6">Please sign in to view your order history.</p>
          <a
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Order History</h1>
        <p className="text-gray-600">View and track all your orders</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Orders Yet</h2>
          <p className="text-gray-600 mb-6">
            Start shopping to see your orders here.
          </p>
          <a
            href="/catalog"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Browse Catalog
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-6 bg-gray-50 border-b border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Order ID</div>
                      <div className="font-mono text-sm font-semibold text-gray-800">
                        {order.id.slice(0, 8).toUpperCase()}
                      </div>
                    </div>
                    {order.po_number && (
                      <div>
                        <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          PO Number
                        </div>
                        <div className="font-semibold text-gray-800">{order.po_number}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Placed
                      </div>
                      <div className="font-semibold text-gray-800">
                        {new Date(order.placed_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        Total
                      </div>
                      <div className="font-semibold text-gray-800">
                        ${order.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Order Items</h3>
                <div className="space-y-3">
                  {order.order_lines.map((line) => (
                    <div key={line.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{line.sku}</div>
                        <div className="text-sm text-gray-600">Quantity: {line.qty}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-800">
                          ${line.unit_price.toFixed(2)} each
                        </div>
                        <div className="text-sm text-gray-600">
                          ${(line.unit_price * line.qty).toFixed(2)} total
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
