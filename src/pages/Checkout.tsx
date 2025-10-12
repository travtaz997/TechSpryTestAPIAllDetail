import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { CreditCard, Building2, Package, CheckCircle, AlertCircle, Truck, MapPin } from 'lucide-react';
import StripePayment from '../components/StripePayment';

interface Customer {
  id: string;
  company: string;
  email: string;
  terms_allowed: boolean;
  billing_address: any;
  shipping_address: any;
}

interface Address {
  name: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
}

const emptyAddress: Address = {
  name: '',
  company: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  phone: '',
};

const shippingMethods = [
  { id: 'standard', name: 'Standard Shipping', cost: 0, days: '5-7 business days' },
  { id: 'expedited', name: 'Expedited Shipping', cost: 25, days: '2-3 business days' },
  { id: 'overnight', name: 'Overnight Shipping', cost: 50, days: '1 business day' },
];

export default function Checkout() {
  const { user, profile } = useAuth();
  const { items, total, clearCart } = useCart();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'terms'>('card');
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [billingAddress, setBillingAddress] = useState<Address>(emptyAddress);
  const [shippingAddress, setShippingAddress] = useState<Address>(emptyAddress);
  const [showPayment, setShowPayment] = useState(false);
  const [tempOrderId, setTempOrderId] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('success');
    const paymentIntentId = urlParams.get('payment_intent');

    if (paymentSuccess === 'true' && paymentIntentId) {
      handlePaymentReturn(paymentIntentId);
      return;
    }

    if (user && profile?.customer_id) {
      loadCustomer();
    } else {
      setLoading(false);
      if (user) {
        setBillingAddress({ ...emptyAddress, name: user.email || '' });
        setShippingAddress({ ...emptyAddress, name: user.email || '' });
      }
    }
  }, [user, profile]);

  async function loadCustomer() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', profile?.customer_id)
        .maybeSingle();

      if (error) throw error;
      setCustomer(data);

      if (data?.billing_address && Object.keys(data.billing_address).length > 0) {
        setBillingAddress({ ...emptyAddress, ...data.billing_address });
      }

      if (data?.shipping_address && Object.keys(data.shipping_address).length > 0) {
        setShippingAddress({ ...emptyAddress, ...data.shipping_address });
        setSameAsBilling(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer details');
    } finally {
      setLoading(false);
    }
  }

  const selectedShipping = shippingMethods.find(m => m.id === shippingMethod) || shippingMethods[0];
  const subtotal = total;
  const shippingCost = selectedShipping.cost;
  const orderTotal = subtotal + shippingCost;

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setError('');

    try {
      if (items.length === 0) {
        throw new Error('Cart is empty');
      }

      if (!user && !guestEmail) {
        throw new Error('Please provide an email address');
      }

      if (!user && guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
        throw new Error('Please provide a valid email address');
      }

      if (user && (!profile?.id || !profile?.auth_user_id)) {
        throw new Error('User profile not loaded. Please refresh the page and try again.');
      }

      if (!billingAddress.name || !billingAddress.address1 || !billingAddress.city ||
          !billingAddress.state || !billingAddress.zip) {
        throw new Error('Please complete all required billing address fields');
      }

      const finalShippingAddress = sameAsBilling ? billingAddress : shippingAddress;

      if (!sameAsBilling && (!finalShippingAddress.name || !finalShippingAddress.address1 ||
          !finalShippingAddress.city || !finalShippingAddress.state || !finalShippingAddress.zip)) {
        throw new Error('Please complete all required shipping address fields');
      }

      if (paymentMethod === 'terms' && !customer?.terms_allowed) {
        throw new Error('Net payment terms are not available for your account');
      }

      if (paymentMethod === 'terms' && !profile?.customer_id) {
        throw new Error('Payment terms require a linked customer account. Please contact support.');
      }

      const orderData: any = {
        customer_id: profile?.customer_id || null,
        status: paymentMethod === 'card' ? 'Pending' : 'Pending',
        currency: 'USD',
        total: orderTotal,
        shipping_cost: shippingCost,
        shipping_method: shippingMethod,
        billing_address: billingAddress,
        shipping_address: finalShippingAddress,
        po_number: poNumber || null,
        notes: orderNotes || null,
        placed_at: new Date().toISOString(),
        payment_status: paymentMethod === 'card' ? 'pending' : 'terms',
      };

      if (user && profile?.auth_user_id) {
        orderData.created_by = profile.auth_user_id;
      }

      if (!user && guestEmail) {
        orderData.notes = orderData.notes ? `${orderData.notes}\n\nGuest Email: ${guestEmail}` : `Guest Email: ${guestEmail}`;
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderLines = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        sku: item.sku,
        qty: item.quantity,
        unit_price: item.price,
        currency: 'USD',
      }));

      const { error: linesError } = await supabase
        .from('order_lines')
        .insert(orderLines);

      if (linesError) throw linesError;

      if (paymentMethod === 'card') {
        setTempOrderId(order.id);
        setShowPayment(true);
      } else {
        const { error: statusError } = await supabase
          .from('orders')
          .update({ status: 'Confirmed', payment_status: 'terms' })
          .eq('id', order.id);

        if (statusError) throw statusError;

        setOrderId(order.id);
        setOrderComplete(true);
        clearCart();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process order');
    } finally {
      setProcessing(false);
    }
  }

  async function finalizeStripePayment(paymentIntentId: string, options: { fromReturn?: boolean } = {}) {
    const { fromReturn = false } = options;

    try {
      setError('');
      if (fromReturn) {
        setLoading(true);
      } else {
        setProcessing(true);
      }

      const { data: { session } } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-payment`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'finalize',
            paymentIntentId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to finalize payment.');
      }

      if (!data.orderId) {
        throw new Error('Payment succeeded but we could not locate the related order. Please contact support.');
      }

      setOrderId(data.orderId);
      setShowPayment(false);
      setOrderComplete(true);
      clearCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment was processed but we could not confirm the order. Please contact support.');
    } finally {
      if (fromReturn) {
        setLoading(false);
      } else {
        setProcessing(false);
      }
    }
  }

  async function handlePaymentReturn(paymentIntentId: string) {
    await finalizeStripePayment(paymentIntentId, { fromReturn: true });
    window.history.replaceState({}, '', '/checkout');
  }

  async function handlePaymentSuccess(paymentIntentId: string) {
    await finalizeStripePayment(paymentIntentId);
  }

  function handlePaymentError(errorMessage: string) {
    setError(errorMessage);
  }

  function updateBillingAddress(field: keyof Address, value: string) {
    setBillingAddress({ ...billingAddress, [field]: value });
  }

  function updateShippingAddress(field: keyof Address, value: string) {
    setShippingAddress({ ...shippingAddress, [field]: value });
  }


  if (items.length === 0 && !orderComplete) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Your Cart is Empty</h1>
          <p className="text-gray-600 mb-6">Add items to your cart before checking out.</p>
          <a
            href="/catalog"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Browse Catalog
          </a>
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Order Placed Successfully!</h1>
          <p className="text-gray-600 mb-2">Thank you for your order.</p>
          <p className="text-sm text-gray-500 mb-6">
            Order ID: <span className="font-mono font-semibold">{orderId.slice(0, 8).toUpperCase()}</span>
          </p>
          {(user?.email || guestEmail) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                A confirmation email will be sent to {user?.email || guestEmail}
              </p>
            </div>
          )}
          <div className="flex gap-4 justify-center">
            {user && (
              <a
                href="/orders"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                View Orders
              </a>
            )}
            <a
              href="/catalog"
              className="bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition font-semibold"
            >
              Continue Shopping
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Checkout</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCheckout}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {!user && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Contact Information</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll send your order confirmation to this email
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <a href="/login" className="text-blue-600 hover:underline font-semibold">
                      Sign in
                    </a>
                  </p>
                </div>
              </div>
            )}

            {user && !profile?.customer_id && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Your account is not yet linked to a company. You can still place orders, but payment terms may not be available.
                </p>
              </div>
            )}

            {customer && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-800">Company Information</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Company:</span>{' '}
                    <span className="font-semibold text-gray-800">{customer.company}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>{' '}
                    <span className="font-semibold text-gray-800">{customer.email}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Billing Address</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.name}
                    onChange={(e) => updateBillingAddress('name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={billingAddress.company}
                    onChange={(e) => updateBillingAddress('company', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.address1}
                    onChange={(e) => updateBillingAddress('address1', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={billingAddress.address2}
                    onChange={(e) => updateBillingAddress('address2', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.city}
                    onChange={(e) => updateBillingAddress('city', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.state}
                    onChange={(e) => updateBillingAddress('state', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="CA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.zip}
                    onChange={(e) => updateBillingAddress('zip', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={billingAddress.phone}
                    onChange={(e) => updateBillingAddress('phone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Truck className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Shipping Address</h2>
              </div>

              <label className="flex items-center gap-2 mb-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Same as billing address</span>
              </label>

              {!sameAsBilling && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.name}
                      onChange={(e) => updateShippingAddress('name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.company}
                      onChange={(e) => updateShippingAddress('company', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 1 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.address1}
                      onChange={(e) => updateShippingAddress('address1', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.address2}
                      onChange={(e) => updateShippingAddress('address2', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.city}
                      onChange={(e) => updateShippingAddress('city', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.state}
                      onChange={(e) => updateShippingAddress('state', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="CA"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.zip}
                      onChange={(e) => updateShippingAddress('zip', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={shippingAddress.phone}
                      onChange={(e) => updateShippingAddress('phone', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Truck className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Shipping Method</h2>
              </div>

              <div className="space-y-3">
                {shippingMethods.map((method) => (
                  <label
                    key={method.id}
                    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping"
                        value={method.id}
                        checked={shippingMethod === method.id}
                        onChange={() => setShippingMethod(method.id)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div>
                        <div className="font-semibold text-gray-800">{method.name}</div>
                        <div className="text-sm text-gray-600">{method.days}</div>
                      </div>
                    </div>
                    <div className="font-semibold text-gray-800">
                      {method.cost === 0 ? 'Free' : `$${method.cost.toFixed(2)}`}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Payment Method</h2>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 mb-1">Credit/Debit Card</div>
                    <div className="text-sm text-gray-600">Pay securely with your card</div>
                  </div>
                </label>

                {customer?.terms_allowed && (
                  <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                    <input
                      type="radio"
                      name="payment"
                      value="terms"
                      checked={paymentMethod === 'terms'}
                      onChange={() => setPaymentMethod('terms')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800 mb-1">Net Payment Terms</div>
                      <div className="text-sm text-gray-600">Pay later according to your account terms</div>
                    </div>
                  </label>
                )}

                <div>
                  <label htmlFor="poNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    PO Number (Optional)
                  </label>
                  <input
                    id="poNumber"
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your purchase order number"
                  />
                </div>

                <div>
                  <label htmlFor="orderNotes" className="block text-sm font-medium text-gray-700 mb-2">
                    Order Notes (Optional)
                  </label>
                  <textarea
                    id="orderNotes"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any special instructions for this order?"
                  />
                </div>
              </div>
            </div>

            {showPayment && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-800">Complete Payment</h2>
                </div>
                <StripePayment
                  amount={orderTotal}
                  orderId={tempOrderId}
                  customerEmail={user?.email || guestEmail}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{item.title}</div>
                      <div className="text-gray-600">Qty: {item.quantity}</div>
                    </div>
                    <div className="font-semibold text-gray-800">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Shipping ({selectedShipping.name})</span>
                  <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>${orderTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={processing || loading}
                className="w-full mt-6 bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed text-lg"
              >
                {processing ? 'Processing...' : `Place Order - $${orderTotal.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
