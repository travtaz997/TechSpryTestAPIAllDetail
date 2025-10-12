import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { CreditCard, Building2, Package, AlertCircle, Truck, MapPin } from 'lucide-react';
import StripePayment from '../components/StripePayment';

type AuthContextValue = ReturnType<typeof useAuth>;
type UserProfileRecord = NonNullable<AuthContextValue['profile']>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

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

const PENDING_PAYMENT_STORAGE_KEY = 'checkout_pending_stripe_payment';

interface PendingPaymentDetails {
  orderId: string;
  amount: number;
  email?: string;
}

export default function Checkout() {
  const { user, profile } = useAuth();
  const { items, total, clearCart } = useCart();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
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
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentDetails | null>(null);

  function persistPendingPayment(details: PendingPaymentDetails) {
    setPendingPayment(details);

    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, JSON.stringify(details));
    } catch (storageError) {
      console.warn('Failed to persist pending payment details', storageError);
    }
  }

  function clearPendingPaymentStorage() {
    setPendingPayment(null);

    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    } catch (storageError) {
      console.warn('Failed to clear pending payment details', storageError);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = window.sessionStorage.getItem(PENDING_PAYMENT_STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PendingPaymentDetails;

      if (!parsed || typeof parsed.orderId !== 'string' || typeof parsed.amount !== 'number') {
        window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
        return;
      }

      setPendingPayment(parsed);
      setTempOrderId(parsed.orderId);
      setShowPayment(true);
      setPaymentMethod('card');

      if (!user && parsed.email) {
        setGuestEmail((current) => current || parsed.email || '');
      }
    } catch (parseError) {
      console.warn('Failed to restore pending payment details', parseError);
      window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    }
  }, [user]);

  async function resolveActiveProfile(): Promise<UserProfileRecord | null> {
    if (!user) {
      return null;
    }

    if (profile?.id && profile.auth_user_id) {
      return profile as UserProfileRecord;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, auth_user_id, customer_id, role, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(getErrorMessage(error, 'Failed to load user profile.'));
    }

    if (!data) {
      throw new Error('User profile not found. Please contact support.');
    }

    return data as UserProfileRecord;
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntentId = urlParams.get('payment_intent');
    const redirectStatus = urlParams.get('redirect_status');
    const paymentSuccess = urlParams.get('success');

    if (paymentIntentId && redirectStatus === 'succeeded') {
      handlePaymentReturn(paymentIntentId);
      return;
    }

    if (paymentIntentId && redirectStatus) {
      let redirectError = '';

      switch (redirectStatus) {
        case 'requires_payment_method':
          redirectError = 'Your payment could not be completed. Please try a different payment method or card.';
          break;
        case 'canceled':
          redirectError = 'Your payment was canceled before it could be completed. Please try again if you still wish to place this order.';
          break;
        case 'processing':
          redirectError = 'Your payment is still processing. We will update your order once the payment is confirmed.';
          break;
        default:
          redirectError = 'We could not confirm your payment. Please try again or contact support if the issue persists.';
          break;
      }

      if (redirectError) {
        setError(redirectError);
      }

      setProcessing(false);
      setLoading(false);
      setPaymentMethod('card');

      if (pendingPayment) {
        setTempOrderId(pendingPayment.orderId);
        setShowPayment(true);
      }

      window.history.replaceState({}, '', '/checkout');
      return;
    }

    if (paymentSuccess === 'true' && paymentIntentId) {
      handlePaymentReturn(paymentIntentId);
    }
  }, [pendingPayment]);

  useEffect(() => {
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
      const customerId = profile?.customer_id;

      if (!customerId) {
        setCustomer(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();

      if (error) throw error;
      const customerRecord = (data ?? null) as Customer | null;
      setCustomer(customerRecord);

      if (customerRecord?.billing_address && Object.keys(customerRecord.billing_address).length > 0) {
        setBillingAddress({ ...emptyAddress, ...customerRecord.billing_address });
      }

      if (customerRecord?.shipping_address && Object.keys(customerRecord.shipping_address).length > 0) {
        setShippingAddress({ ...emptyAddress, ...customerRecord.shipping_address });
        setSameAsBilling(false);
      }
    } catch (err) {
      console.error('Failed to load customer details:', err);
      setError(getErrorMessage(err, 'Failed to load customer details'));
    } finally {
      setLoading(false);
    }
  }

  const selectedShipping = shippingMethods.find(m => m.id === shippingMethod) || shippingMethods[0];
  const subtotal = total;
  const shippingCost = selectedShipping.cost;
  const orderTotal = subtotal + shippingCost;
  const activeOrderId = pendingPayment?.orderId || tempOrderId;
  const paymentAmount = pendingPayment?.amount ?? orderTotal;
  const paymentContactEmailSource = user?.email || pendingPayment?.email || guestEmail;
  const paymentContactEmail = paymentContactEmailSource ? paymentContactEmailSource.trim() : undefined;

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setError('');

    const normalizedGuestEmail = guestEmail.trim();

    try {
      if (items.length === 0) {
        throw new Error('Cart is empty');
      }

      if (!user && !normalizedGuestEmail) {
        throw new Error('Please provide an email address');
      }

      if (!user && normalizedGuestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedGuestEmail)) {
        throw new Error('Please provide a valid email address');
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

      const activeProfile = user ? await resolveActiveProfile() : null;

      if (paymentMethod === 'terms' && !customer?.terms_allowed) {
        throw new Error('Net payment terms are not available for your account');
      }

      if (paymentMethod === 'terms' && !activeProfile?.customer_id) {
        throw new Error('Payment terms require a linked customer account. Please contact support.');
      }

      const orderData: Record<string, unknown> = {
        customer_id: activeProfile?.customer_id ?? profile?.customer_id ?? null,
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

      if (user) {
        if (!activeProfile?.id) {
          throw new Error('Unable to determine your user profile. Please sign out and try again.');
        }

        orderData.created_by = activeProfile.id;
      }

      if (!user && normalizedGuestEmail) {
        orderData.notes = orderData.notes
          ? `${orderData.notes}\n\nGuest Email: ${normalizedGuestEmail}`
          : `Guest Email: ${normalizedGuestEmail}`;
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        throw new Error(getErrorMessage(orderError, 'Failed to create order.'));
      }

      if (!order) {
        throw new Error('Failed to create order. Please try again.');
      }

      const createdOrderId = typeof order.id === 'string' ? order.id : '';

      if (!createdOrderId) {
        throw new Error('Failed to create order. Please try again.');
      }

      const orderLines = items.map((item) => ({
        order_id: createdOrderId,
        product_id: item.productId,
        sku: item.sku,
        qty: item.quantity,
        unit_price: item.price,
        currency: 'USD',
      }));

      const { error: linesError } = await supabase
        .from('order_lines')
        .insert(orderLines);

      if (linesError) {
        throw new Error(getErrorMessage(linesError, 'Failed to save order items.'));
      }

      if (paymentMethod === 'card') {
        setTempOrderId(createdOrderId);
        setShowPayment(true);
        persistPendingPayment({
          orderId: createdOrderId,
          amount: orderTotal,
          email: user?.email || normalizedGuestEmail || undefined,
        });
      } else {
        const { error: statusError } = await supabase
          .from('orders')
          .update({ status: 'Confirmed', payment_status: 'terms' })
          .eq('id', createdOrderId);

        if (statusError) {
          throw new Error(getErrorMessage(statusError, 'Failed to confirm order.'));
        }

        clearCart();
        redirectToConfirmation(createdOrderId, 'terms');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(getErrorMessage(err, 'Failed to process order'));
    } finally {
      setProcessing(false);
    }
  }

  function redirectToConfirmation(orderId: string, method: 'card' | 'terms') {
    const params = new URLSearchParams({ method });
    window.location.href = `/order-confirmation/${orderId}?${params.toString()}`;
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

      setShowPayment(false);
      setTempOrderId('');
      clearPendingPaymentStorage();
      clearCart();
      return data.orderId as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment was processed but we could not confirm the order. Please contact support.');
    } finally {
      if (fromReturn) {
        setLoading(false);
      } else {
        setProcessing(false);
      }
    }

    return null;
  }

  async function handlePaymentReturn(paymentIntentId: string) {
    const confirmedOrderId = await finalizeStripePayment(paymentIntentId, { fromReturn: true });
    if (confirmedOrderId) {
      redirectToConfirmation(confirmedOrderId, 'card');
    } else {
      window.history.replaceState({}, '', '/checkout');
    }
  }

  async function handlePaymentSuccess(paymentIntentId: string) {
    const confirmedOrderId = await finalizeStripePayment(paymentIntentId);
    if (confirmedOrderId) {
      redirectToConfirmation(confirmedOrderId, 'card');
    }
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


  if (items.length === 0 && !showPayment) {
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

            {showPayment && activeOrderId && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-800">Complete Payment</h2>
                </div>
                <StripePayment
                  amount={paymentAmount}
                  orderId={activeOrderId}
                  customerEmail={paymentContactEmail}
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
