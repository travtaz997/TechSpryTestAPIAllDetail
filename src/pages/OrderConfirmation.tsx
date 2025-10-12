import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle, Package, MapPin, CreditCard, Calendar, Truck, DollarSign } from 'lucide-react';

interface Address {
  name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

interface OrderLine {
  id: string;
  sku: string;
  qty: number;
  unit_price: number;
  currency: string;
  product_id?: string | null;
}

interface OrderRecord {
  id: string;
  status: string;
  payment_status: string;
  total: number;
  shipping_cost: number;
  shipping_method: string | null;
  currency: string;
  po_number: string | null;
  placed_at: string;
  billing_address: Address | null;
  shipping_address: Address | null;
  order_lines: OrderLine[];
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

function getOrderIdFromPath(): string {
  const match = window.location.pathname.match(/\/order-confirmation\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getFriendlyPaymentStatus(status: string) {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'Payment Completed';
    case 'pending':
      return 'Payment Pending';
    case 'terms':
      return 'Payment on Account Terms';
    case 'failed':
      return 'Payment Failed';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function getStatusBadgeColor(status: string) {
  switch (status.toLowerCase()) {
    case 'confirmed':
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'processing':
      return 'bg-blue-100 text-blue-800';
    case 'cancelled':
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function AddressBlock({ title, address }: { title: string; address: Address | null }) {
  if (!address) {
    return null;
  }

  const {
    name,
    company,
    address1,
    address2,
    city,
    state,
    zip,
    country,
    phone,
  } = address;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
      <div className="text-sm text-gray-600 space-y-1">
        {name && <div>{name}</div>}
        {company && <div>{company}</div>}
        {address1 && <div>{address1}</div>}
        {address2 && <div>{address2}</div>}
        {(city || state || zip) && (
          <div>
            {[city, state, zip].filter(Boolean).join(', ')}
          </div>
        )}
        {country && <div>{country}</div>}
        {phone && <div>Phone: {phone}</div>}
      </div>
    </div>
  );
}

export default function OrderConfirmation() {
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const orderId = useMemo(getOrderIdFromPath, []);
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const method = searchParams.get('method');

  useEffect(() => {
    if (!orderId) {
      setError('We could not determine which order to display.');
      setLoading(false);
      return;
    }

    async function loadOrder() {
      try {
        setLoading(true);
        setError('');

        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            payment_status,
            total,
            shipping_cost,
            shipping_method,
            currency,
            po_number,
            placed_at,
            billing_address,
            shipping_address,
            order_lines (
              id,
              sku,
              qty,
              unit_price,
              currency,
              product_id
            )
          `)
          .eq('id', orderId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Order not found.');
        }

        setOrder(data as OrderRecord);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load your order details.';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  const paymentMessage = useMemo(() => {
    if (!method) {
      return null;
    }

    if (method === 'card') {
      return 'Your payment was processed successfully.';
    }

    if (method === 'terms') {
      return 'Your order has been placed on account terms.';
    }

    return null;
  }, [method]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Confirmation</h1>
          <p className="text-gray-600 mb-6">{error || 'Order details are unavailable.'}</p>
          <a
            href="/catalog"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Continue Shopping
          </a>
        </div>
      </div>
    );
  }

  const orderSubtotal = order.order_lines.reduce((sum, line) => sum + line.unit_price * line.qty, 0);
  const paymentStatusLabel = getFriendlyPaymentStatus(order.payment_status);
  const orderStatusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <h1 className="text-3xl font-bold text-gray-800">Thank you for your order!</h1>
              </div>
              <p className="text-gray-600">
                Order ID: <span className="font-mono font-semibold">{order.id.slice(0, 8).toUpperCase()}</span>
              </p>
              <p className="text-gray-500 text-sm">
                Placed on {new Date(order.placed_at).toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(order.payment_status)}`}>
                <CreditCard className="w-4 h-4" />
                {paymentStatusLabel}
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(order.status)}`}>
                <Package className="w-4 h-4" />
                {orderStatusLabel}
              </div>
            </div>
          </div>

          {paymentMessage && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              {paymentMessage}
            </div>
          )}

          {order.po_number && (
            <div className="mt-4 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">PO Number:</span> {order.po_number}
            </div>
          )}
        </div>

        <div className="px-6 py-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Summary</h2>
            <div className="space-y-4">
              {order.order_lines.map((line) => (
                <div key={line.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-gray-800">SKU: {line.sku}</div>
                    <div className="text-sm text-gray-600">Quantity: {line.qty}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-800">{formatCurrency(line.unit_price, line.currency)}</div>
                    <div className="text-sm text-gray-600">
                      Line total: {formatCurrency(line.unit_price * line.qty, line.currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Totals</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  Subtotal
                </span>
                <span className="font-semibold">{formatCurrency(orderSubtotal, order.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-gray-500" />
                  Shipping ({order.shipping_method ? order.shipping_method.replace(/_/g, ' ') : 'Standard'})
                </span>
                <span className="font-semibold">{formatCurrency(order.shipping_cost, order.currency)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-base">
                <span className="font-semibold text-gray-800">Order Total</span>
                <span className="font-semibold text-gray-900">{formatCurrency(order.total, order.currency)}</span>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">Addresses</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <AddressBlock title="Billing Address" address={order.billing_address} />
                <AddressBlock title="Shipping Address" address={order.shipping_address} />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">Next Steps</h2>
              </div>
              <p className="text-sm text-gray-600">
                We'll email you updates as your order progresses. You can also check the status anytime from your account orders page.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/orders"
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  View Orders
                </a>
                <a
                  href="/catalog"
                  className="inline-flex items-center justify-center px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition font-semibold"
                >
                  Continue Shopping
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
