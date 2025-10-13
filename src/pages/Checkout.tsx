import { useState, useEffect, useMemo } from 'react';
import { useAuth, NetTermsStatus } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import {
  CreditCard,
  Building2,
  Package,
  AlertCircle,
  Truck,
  MapPin,
  ArrowLeft,
} from 'lucide-react';
import StripePayment from '../components/StripePayment';

type AuthContextValue = ReturnType<typeof useAuth>;
type UserProfileRecord = NonNullable<AuthContextValue['profile']>;

type CheckoutStep = 'details' | 'payment';

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

const checkoutSteps: { id: CheckoutStep; label: string; description: string }[] = [
  { id: 'details', label: 'Details', description: 'Billing, shipping, and preferences' },
  { id: 'payment', label: 'Payment', description: 'Securely complete your purchase' },
];

const PENDING_PAYMENT_STORAGE_KEY = 'checkout_pending_stripe_payment';

interface PendingPaymentDetails {
  orderId: string;
  amount: number;
  email?: string;
}

function StepProgress({ currentStep }: { currentStep: CheckoutStep }) {
  return (
    <div className="mb-10">
      <nav aria-label="Checkout steps" className="max-w-3xl mx-auto">
        <ol className="flex items-center justify-center gap-8 text-sm font-medium">
          {checkoutSteps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = checkoutSteps.findIndex((s) => s.id === currentStep) > index;

            return (
              <li key={step.id} className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-base font-semibold transition ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : isCompleted
                      ? 'border-green-500 bg-green-50 text-green-600'
                      : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <div
                    className={`text-sm font-semibold ${
                      isActive ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
                {index < checkoutSteps.length - 1 && (
                  <div className="h-px w-12 bg-gray-200" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
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
  const [guestEmail, setGuestEmail] = useState('');
  const [step, setStep] = useState<CheckoutStep>('details');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentDetails | null>(null);

  const selectedShipping = shippingMethods.find((m) => m.id === shippingMethod) || shippingMethods[0];
  const subtotal = total;
  const shippingCost = selectedShipping.cost;
  const orderTotal = subtotal + shippingCost;

  const accountType: 'consumer' | 'business' = (profile?.account_type as 'consumer' | 'business' | undefined) || 'consumer';
  const isBusinessAccount = accountType === 'business';
  const netTermsStatus = useMemo<NetTermsStatus>(() => {
    if (customer?.terms_allowed) {
      return 'approved';
    }
    return (profile?.net_terms_status as NetTermsStatus | undefined) || 'not_requested';
  }, [customer?.terms_allowed, profile?.net_terms_status]);
  const netTermsApproved = isBusinessAccount && netTermsStatus === 'approved';
  const netTermsPending = isBusinessAccount && netTermsStatus === 'pending';
  const netTermsDeclined = isBusinessAccount && netTermsStatus === 'declined';

  const paymentContactEmail = useMemo(() => {
    const source = user?.email || pendingPayment?.email || guestEmail;
    return source?.trim() || undefined;
  }, [user, guestEmail, pendingPayment]);

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
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as PendingPaymentDetails;

      if (!parsed || typeof parsed.orderId !== 'string' || typeof parsed.amount !== 'number') {
        window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
        setLoading(false);
        return;
      }

      setPendingPayment(parsed);
      setActiveOrderId(parsed.orderId);
      setStep('payment');
      setPaymentMethod('card');

      if (!user && parsed.email) {
        setGuestEmail((current) => current || parsed.email || '');
      }
    } catch (parseError) {
      console.warn('Failed to restore pending payment details', parseError);
      window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    } finally {
      setLoading(false);
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
    if (!user) {
      setLoading(false);
      setBillingAddress({ ...emptyAddress, name: guestEmail || '' });
      setShippingAddress({ ...emptyAddress, name: guestEmail || '' });
      return;
    }

    const authenticatedUser = user;

    async function loadCustomer() {
      try {
        setLoading(true);
        const customerId = profile?.customer_id;

        if (!customerId) {
          setCustomer(null);
          if (authenticatedUser.email) {
            setBillingAddress((prev) => ({ ...prev, name: prev.name || authenticatedUser.email || '' }));
            setShippingAddress((prev) => ({ ...prev, name: prev.name || authenticatedUser.email || '' }));
          }
          return;
        }

        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        const customerRecord = (data ?? null) as Customer | null;
        setCustomer(customerRecord);

        if (customerRecord?.billing_address && Object.keys(customerRecord.billing_address).length > 0) {
          setBillingAddress({ ...emptyAddress, ...customerRecord.billing_address });
        } else if (authenticatedUser.email) {
          setBillingAddress((prev) => ({
            ...prev,
            name: prev.name || authenticatedUser.email || '',
          }));
        }

        if (customerRecord?.shipping_address && Object.keys(customerRecord.shipping_address).length > 0) {
          setShippingAddress({ ...emptyAddress, ...customerRecord.shipping_address });
          setSameAsBilling(false);
        } else if (authenticatedUser.email) {
          setShippingAddress((prev) => ({
            ...prev,
            name: prev.name || authenticatedUser.email || '',
          }));
        }
      } catch (err) {
        console.error('Failed to load customer details:', err);
        setError(getErrorMessage(err, 'Failed to load customer details'));
      } finally {
        setLoading(false);
      }
    }

    loadCustomer();
  }, [user, profile, guestEmail]);

  useEffect(() => {
    if (!netTermsApproved && paymentMethod === 'terms') {
      setPaymentMethod('card');
    }
  }, [netTermsApproved, paymentMethod]);

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
        setStep('payment');
      }

      setProcessing(false);
      setLoading(false);
      setPaymentMethod('card');

      if (pendingPayment) {
        setActiveOrderId(pendingPayment.orderId);
        setStep('payment');
      }

      window.history.replaceState({}, '', '/checkout');
      return;
    }

    if (paymentSuccess === 'true' && paymentIntentId) {
      handlePaymentReturn(paymentIntentId);
    }
  }, [pendingPayment]);

  useEffect(() => {
    if (!activeOrderId || step !== 'payment') {
      return;
    }

    const billingIncomplete = !billingAddress.address1 || !billingAddress.city || !billingAddress.state || !billingAddress.zip;
    const shippingIncomplete = sameAsBilling
      ? false
      : !shippingAddress.address1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip;

    if (!billingIncomplete && !shippingIncomplete) {
      return;
    }

    async function hydrateOrderDetails() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('billing_address, shipping_address, shipping_method')
          .eq('id', activeOrderId)
          .maybeSingle();

        if (error || !data) {
          if (error) {
            console.warn('Failed to hydrate checkout order', error);
          }
          return;
        }

        if (data.billing_address) {
          setBillingAddress({ ...emptyAddress, ...data.billing_address });
        }

        if (data.shipping_address) {
          setShippingAddress({ ...emptyAddress, ...data.shipping_address });

          const fields: (keyof Address)[] = ['name', 'company', 'address1', 'address2', 'city', 'state', 'zip', 'country', 'phone'];
          const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

          const sameAddress = fields.every((field) =>
            normalize((data.billing_address ?? {})[field]) === normalize((data.shipping_address ?? {})[field])
          );

          setSameAsBilling(sameAddress);
        }

        if (typeof data.shipping_method === 'string') {
          setShippingMethod(data.shipping_method);
        }
      } catch (err) {
        console.warn('Failed to hydrate checkout order', err);
      }
    }

    hydrateOrderDetails();
  }, [activeOrderId, step]);

  function updateBillingAddress(field: keyof Address, value: string) {
    setBillingAddress({ ...billingAddress, [field]: value });
  }

  function updateShippingAddress(field: keyof Address, value: string) {
    setShippingAddress({ ...shippingAddress, [field]: value });
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

  async function upsertOrderRecords(orderId: string | null, orderData: Record<string, unknown>) {
    if (orderId) {
      const { error: updateError } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', orderId);

      if (updateError) {
        throw new Error(getErrorMessage(updateError, 'Failed to update order.'));
      }

      const { error: deleteError } = await supabase
        .from('order_lines')
        .delete()
        .eq('order_id', orderId);

      if (deleteError) {
        throw new Error(getErrorMessage(deleteError, 'Failed to refresh order items.'));
      }

      return orderId;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      throw new Error(getErrorMessage(orderError, 'Failed to create order.'));
    }

    if (!order || typeof order.id !== 'string') {
      throw new Error('Failed to create order. Please try again.');
    }

    return order.id as string;
  }

  async function handleDetailsSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setProcessing(true);
    setError('');

    const normalizedGuestEmail = guestEmail.trim();

    try {
      if (!user && !normalizedGuestEmail) {
        throw new Error('Please provide an email address.');
      }

      if (!user && normalizedGuestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedGuestEmail)) {
        throw new Error('Please provide a valid email address.');
      }

      if (!billingAddress.name || !billingAddress.address1 || !billingAddress.city || !billingAddress.state || !billingAddress.zip) {
        throw new Error('Please complete all required billing address fields.');
      }

      const finalShippingAddress = sameAsBilling ? billingAddress : shippingAddress;

      if (
        !sameAsBilling &&
        (!finalShippingAddress.name || !finalShippingAddress.address1 || !finalShippingAddress.city || !finalShippingAddress.state || !finalShippingAddress.zip)
      ) {
        throw new Error('Please complete all required shipping address fields.');
      }

      const activeProfile = user ? await resolveActiveProfile() : null;

      if (paymentMethod === 'terms' && !netTermsApproved) {
        if (netTermsPending) {
          throw new Error('Your NET terms application is still under review. Please choose a credit card to complete this order.');
        }
        if (netTermsDeclined) {
          throw new Error('Your NET terms application is not approved. Please pay by credit card or contact support.');
        }
        throw new Error('NET terms are not currently available for your account.');
      }

      if (paymentMethod === 'terms' && !activeProfile?.customer_id) {
        throw new Error('Payment terms require a linked customer account. Please contact support.');
      }

      const orderData: Record<string, unknown> = {
        customer_id: activeProfile?.customer_id ?? profile?.customer_id ?? null,
        status: 'Pending',
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
        const activeProfileRecord = activeProfile ?? (await resolveActiveProfile());
        if (!activeProfileRecord?.id) {
          throw new Error('Unable to determine your user profile. Please sign out and try again.');
        }
        orderData.created_by = activeProfileRecord.id;
      }

      if (!user && normalizedGuestEmail) {
        orderData.notes = orderData.notes
          ? `${orderData.notes}\n\nGuest Email: ${normalizedGuestEmail}`
          : `Guest Email: ${normalizedGuestEmail}`;
      }

      const orderId = await upsertOrderRecords(activeOrderId, orderData);

      const orderLines = items.map((item) => ({
        order_id: orderId,
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

      setActiveOrderId(orderId);

      if (paymentMethod === 'terms') {
        const { error: statusError } = await supabase
          .from('orders')
          .update({ status: 'Confirmed', payment_status: 'terms' })
          .eq('id', orderId);

        if (statusError) {
          throw new Error(getErrorMessage(statusError, 'Failed to confirm order.'));
        }

        clearCart();
        clearPendingPaymentStorage();
        redirectToConfirmation(orderId, 'terms');
        return;
      }

      persistPendingPayment({
        orderId,
        amount: orderTotal,
        email: user?.email || normalizedGuestEmail || undefined,
      });

      setStep('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Checkout details error:', err);
      setError(getErrorMessage(err, 'Failed to process order details.'));
    } finally {
      setProcessing(false);
    }
  }

  function handleBackToDetails() {
    setStep('details');
  }

  const detailsButtonLabel = paymentMethod === 'card'
    ? `Continue to Payment - $${orderTotal.toFixed(2)}`
    : 'Place Order with Terms';

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Your cart is currently empty</h1>
        <p className="text-gray-600 mb-6">Add some products to begin the checkout process.</p>
        <a
          href="/catalog"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Browse Products
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        <p className="mt-2 text-gray-600">Complete your order securely in just a couple of steps.</p>
      </div>

      <StepProgress currentStep={step} />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">We ran into a problem</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {step === 'details' && (
        <form onSubmit={handleDetailsSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {!user && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-800">Contact Information</h2>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-6 flex items-center gap-3">
                <Building2 className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Billing Address</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.name}
                    onChange={(e) => updateBillingAddress('name', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Company Name</label>
                  <input
                    type="text"
                    value={billingAddress.company}
                    onChange={(e) => updateBillingAddress('company', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Address Line 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.address1}
                    onChange={(e) => updateBillingAddress('address1', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Address Line 2</label>
                  <input
                    type="text"
                    value={billingAddress.address2}
                    onChange={(e) => updateBillingAddress('address2', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.city}
                    onChange={(e) => updateBillingAddress('city', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.state}
                    onChange={(e) => updateBillingAddress('state', e.target.value)}
                    placeholder="CA"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={billingAddress.zip}
                    onChange={(e) => updateBillingAddress('zip', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={billingAddress.phone}
                    onChange={(e) => updateBillingAddress('phone', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-6 flex items-center gap-3">
                <MapPin className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Shipping Address</h2>
              </div>

              <label className="mb-6 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                Same as billing address
              </label>

              {!sameAsBilling && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.name}
                      onChange={(e) => updateShippingAddress('name', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">Company Name</label>
                    <input
                      type="text"
                      value={shippingAddress.company}
                      onChange={(e) => updateShippingAddress('company', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Address Line 1 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.address1}
                      onChange={(e) => updateShippingAddress('address1', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-gray-700">Address Line 2</label>
                    <input
                      type="text"
                      value={shippingAddress.address2}
                      onChange={(e) => updateShippingAddress('address2', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.city}
                      onChange={(e) => updateShippingAddress('city', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.state}
                      onChange={(e) => updateShippingAddress('state', e.target.value)}
                      placeholder="CA"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      ZIP Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.zip}
                      onChange={(e) => updateShippingAddress('zip', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={shippingAddress.phone}
                      onChange={(e) => updateShippingAddress('phone', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-6 flex items-center gap-3">
                <Truck className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Shipping Method</h2>
              </div>

              <div className="space-y-3">
                {shippingMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border-2 p-4 transition ${
                      shippingMethod === method.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping"
                        value={method.id}
                        checked={shippingMethod === method.id}
                        onChange={() => setShippingMethod(method.id)}
                        className="h-4 w-4 text-blue-600"
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

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-6 flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Payment Method</h2>
              </div>

              <div className="space-y-4">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition ${
                    paymentMethod === 'card' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">Credit or Debit Card</div>
                    <div className="text-sm text-gray-600">Pay securely today with Stripe.</div>
                  </div>
                </label>

                {isBusinessAccount && (
                  <div className="space-y-2">
                    <label
                      className={`flex items-start gap-3 rounded-lg border-2 p-4 transition ${
                        paymentMethod === 'terms' && netTermsApproved
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200'
                      } ${netTermsApproved ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60'}`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="terms"
                        checked={paymentMethod === 'terms'}
                        onChange={() => netTermsApproved && setPaymentMethod('terms')}
                        disabled={!netTermsApproved}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">Invoice / NET Terms</div>
                        <div className="text-sm text-gray-600">
                          {netTermsApproved
                            ? 'Place the order now and pay later using your approved account terms.'
                            : 'NET terms will be available once your application is approved.'}
                        </div>
                      </div>
                    </label>
                    {!netTermsApproved && (
                      <p className="ml-9 text-xs text-gray-500">
                        {netTermsPending
                          ? 'Your NET terms application is under review. We will notify you as soon as it is approved.'
                          : netTermsDeclined
                          ? 'Your NET terms request was declined. Contact our credit team or update your application in the account portal.'
                          : 'Apply for NET terms from your account dashboard to enable invoice payments.'}
                        {' '}<a href="/account" className="text-blue-600 hover:text-blue-700 font-semibold">Manage account</a>
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="poNumber" className="mb-2 block text-sm font-medium text-gray-700">
                    PO Number (Optional)
                  </label>
                  <input
                    id="poNumber"
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="Enter your purchase order number"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="orderNotes" className="mb-2 block text-sm font-medium text-gray-700">
                    Order Notes (Optional)
                  </label>
                  <textarea
                    id="orderNotes"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                    placeholder="Any special instructions for this order?"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-6 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-xl font-bold text-gray-800">Order Summary</h2>
              <div className="mt-6 space-y-4">
                {items.map((item) => (
                  <div key={item.sku} className="flex items-start justify-between text-sm">
                    <div className="flex-1 pr-4">
                      <div className="font-medium text-gray-800">{item.title}</div>
                      <div className="text-gray-500">Qty: {item.quantity}</div>
                    </div>
                    <div className="font-semibold text-gray-800">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-2 border-t border-gray-200 pt-4 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping ({selectedShipping.name})</span>
                  <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 text-lg font-semibold text-gray-900">
                <span>Total Due</span>
                <span>${orderTotal.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={processing || loading}
                className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-center text-lg font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {processing ? 'Processing...' : detailsButtonLabel}
              </button>

              <p className="mt-4 text-xs text-gray-500">
                By continuing you agree to our terms of sale and privacy policy.
              </p>
            </div>
          </aside>
        </form>
      )}

      {step === 'payment' && activeOrderId && pendingPayment && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Secure Payment</h2>
                <p className="text-gray-600">Enter your card details below to complete your purchase.</p>
              </div>
              <button
                type="button"
                onClick={handleBackToDetails}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Edit Details
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-6 flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-blue-600" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Pay with card</h3>
                  <p className="text-sm text-gray-500">Transactions are encrypted and processed by Stripe.</p>
                </div>
              </div>

              <StripePayment
                amount={pendingPayment.amount}
                orderId={activeOrderId}
                customerEmail={paymentContactEmail}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-800">Order Summary</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Items</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping ({selectedShipping.name})</span>
                    <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 text-lg font-semibold text-gray-900">
                  <span>Total</span>
                  <span>${orderTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">Shipping to</h3>
                <div className="space-y-1">
                  <p>{(sameAsBilling ? billingAddress : shippingAddress).name}</p>
                  <p>{(sameAsBilling ? billingAddress : shippingAddress).address1}</p>
                  {((sameAsBilling ? billingAddress : shippingAddress).address2) && (
                    <p>{(sameAsBilling ? billingAddress : shippingAddress).address2}</p>
                  )}
                  <p>
                    {[sameAsBilling ? billingAddress.city : shippingAddress.city,
                      sameAsBilling ? billingAddress.state : shippingAddress.state,
                      sameAsBilling ? billingAddress.zip : shippingAddress.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p>{sameAsBilling ? billingAddress.phone : shippingAddress.phone}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
