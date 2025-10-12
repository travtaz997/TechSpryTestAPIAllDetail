import { useEffect, useMemo, useState } from 'react';
import { useAuth, NetTermsApplication, NetTermsStatus } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  User as UserIcon,
  Building2,
  Mail,
  Phone,
  MapPin,
  Save,
  LogOut,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Clock,
  FileText,
  Briefcase,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

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

interface CustomerRecord {
  id: string;
  company: string;
  email: string;
  phone: string | null;
  billing_address: Partial<Address> | null;
  shipping_address: Partial<Address> | null;
  terms_allowed: boolean;
}

interface ProfileFormState {
  firstName: string;
  lastName: string;
  phone: string;
  businessName: string;
  jobTitle: string;
  website: string;
}

interface NetTermsFormState {
  accountsPayableEmail: string;
  estimatedMonthlySpend: string;
  taxId: string;
  notes: string;
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

const initialProfileForm: ProfileFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  businessName: '',
  jobTitle: '',
  website: '',
};

const initialNetTermsForm: NetTermsFormState = {
  accountsPayableEmail: '',
  estimatedMonthlySpend: '',
  taxId: '',
  notes: '',
};

function mergeAddress(address: Partial<Address> | null | undefined): Address {
  if (!address) {
    return { ...emptyAddress };
  }
  return { ...emptyAddress, ...address };
}

function formatStatus(status: NetTermsStatus): {
  label: string;
  badgeClass: string;
  description: string;
  icon: JSX.Element;
  panelClass: string;
} {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        badgeClass: 'bg-green-100 text-green-700 border-green-200',
        description: 'NET terms are active on your account. You can place orders on terms during checkout.',
        icon: <ShieldCheck className="w-5 h-5 text-green-600" />,
        panelClass: 'border-green-200 bg-green-50 text-green-800',
      };
    case 'pending':
      return {
        label: 'In Review',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
        description: 'Our credit team is reviewing your application. You can continue to pay by card while we finalize approval.',
        icon: <Clock className="w-5 h-5 text-blue-600" />,
        panelClass: 'border-blue-200 bg-blue-50 text-blue-800',
      };
    case 'declined':
      return {
        label: 'Declined',
        badgeClass: 'bg-red-100 text-red-700 border-red-200',
        description: 'Your NET terms application was declined. You may reapply with updated information at any time.',
        icon: <XCircle className="w-5 h-5 text-red-500" />,
        panelClass: 'border-red-200 bg-red-50 text-red-800',
      };
    default:
      return {
        label: 'Not Requested',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
        description: 'Apply to pay by invoice with 30-day NET terms. Approval typically takes 1-2 business days.',
        icon: <CreditCard className="w-5 h-5 text-gray-500" />,
        panelClass: 'border-gray-200 bg-gray-50 text-gray-700',
      };
  }
}

function addressesMatch(a: Address, b: Address) {
  const fields: (keyof Address)[] = ['name', 'company', 'address1', 'address2', 'city', 'state', 'zip', 'country', 'phone'];
  return fields.every((field) => (a[field] || '').toLowerCase().trim() === (b[field] || '').toLowerCase().trim());
}

export default function Account() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(initialProfileForm);
  const [billingAddress, setBillingAddress] = useState<Address>({ ...emptyAddress });
  const [shippingAddress, setShippingAddress] = useState<Address>({ ...emptyAddress });
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [netTermsForm, setNetTermsForm] = useState<NetTermsFormState>(initialNetTermsForm);
  const [netTermsMessage, setNetTermsMessage] = useState('');
  const [netTermsError, setNetTermsError] = useState('');
  const [submittingNetTerms, setSubmittingNetTerms] = useState(false);
  const [statusSynced, setStatusSynced] = useState(false);

  const accountType: 'consumer' | 'business' = (profile?.account_type as 'consumer' | 'business' | undefined) || 'consumer';
  const isBusiness = accountType === 'business';

  const derivedNetTermsStatus: NetTermsStatus = useMemo(() => {
    if (customer?.terms_allowed) {
      return 'approved';
    }
    return profile?.net_terms_status || 'not_requested';
  }, [customer?.terms_allowed, profile?.net_terms_status]);

  const statusMeta = formatStatus(derivedNetTermsStatus);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadCustomerRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.customer_id]);

  useEffect(() => {
    setProfileForm((prev) => ({
      ...prev,
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      phone: profile?.phone || customer?.phone || '',
      businessName: customer?.company || prev.businessName || '',
      jobTitle: profile?.business_profile?.jobTitle || '',
      website: profile?.business_profile?.website || '',
    }));

    if (profile?.net_terms_application) {
      const application = profile.net_terms_application as NetTermsApplication;
      setNetTermsForm({
        accountsPayableEmail: application.accountsPayableEmail || '',
        estimatedMonthlySpend: application.estimatedMonthlySpend || '',
        taxId: application.taxId || profile.business_profile?.taxId || '',
        notes: application.notes || '',
      });
    } else {
      setNetTermsForm({
        ...initialNetTermsForm,
        taxId: profile?.business_profile?.taxId || '',
      });
    }
  }, [profile, customer]);

  useEffect(() => {
    async function syncApprovedStatus() {
      if (!profile?.id) return;
      if (statusSynced) return;
      if (derivedNetTermsStatus !== 'approved') return;
      if (profile.net_terms_status === 'approved') {
        setStatusSynced(true);
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          net_terms_status: 'approved',
          net_terms_reviewed_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (!updateError) {
        setStatusSynced(true);
        refreshProfile();
      }
    }

    syncApprovedStatus();
  }, [derivedNetTermsStatus, profile, refreshProfile, statusSynced]);

  async function loadCustomerRecord() {
    try {
      setLoading(true);

      if (!profile?.customer_id) {
        hydrateAddresses(null);
        setCustomer(null);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', profile.customer_id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      const customerRecord = (data || null) as CustomerRecord | null;
      setCustomer(customerRecord);
      hydrateAddresses(customerRecord);
    } catch (err) {
      console.error('Failed to load customer account', err);
      setError('We were unable to load your saved account details. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  function hydrateAddresses(customerRecord: CustomerRecord | null) {
    const billing = mergeAddress(customerRecord?.billing_address);
    const shipping = mergeAddress(customerRecord?.shipping_address);

    setBillingAddress(billing);

    if (customerRecord?.shipping_address && !addressesMatch(billing, shipping)) {
      setSameAsBilling(false);
      setShippingAddress(shipping);
    } else {
      setSameAsBilling(true);
      setShippingAddress(billing);
    }
  }

  function updateBilling(field: keyof Address, value: string) {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
  }

  function updateShipping(field: keyof Address, value: string) {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
  }

  function updateProfileField<Field extends keyof ProfileFormState>(field: Field, value: ProfileFormState[Field]) {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateNetTermsField<Field extends keyof NetTermsFormState>(field: Field, value: NetTermsFormState[Field]) {
    setNetTermsForm((prev) => ({ ...prev, [field]: value }));
  }

  async function ensureCustomerRecord(company: string, phone: string | null, email: string) {
    if (profile?.customer_id) {
      return profile.customer_id;
    }

    const { data, error: insertError } = await supabase
      .from('customers')
      .insert({
        company,
        email,
        phone,
        terms_allowed: false,
        billing_address: null,
        shipping_address: null,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    const newCustomerId = data?.id as string | undefined;
    if (!newCustomerId) {
      throw new Error('Failed to create customer account record.');
    }

    await supabase
      .from('users')
      .update({ customer_id: newCustomerId })
      .eq('id', profile?.id || '');

    return newCustomerId;
  }

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || !user) return;

    setError('');
    setFeedback('');
    setSaving(true);

    try {
      const companyName = isBusiness
        ? profileForm.businessName.trim() || customer?.company || ''
        : profileForm.businessName.trim() || `${profileForm.firstName} ${profileForm.lastName}`.trim() || user.email || 'Customer';

      if (!companyName.trim()) {
        throw new Error('Please provide your business or contact name.');
      }

      const normalizedBilling = { ...billingAddress };
      const normalizedShipping = sameAsBilling ? { ...billingAddress } : { ...shippingAddress };

      const customerId = await ensureCustomerRecord(companyName, profileForm.phone.trim() || null, user.email || customer?.email || '');

      const { error: customerError } = await supabase
        .from('customers')
        .update({
          company: companyName,
          phone: profileForm.phone.trim() || null,
          email: user.email || customer?.email,
          billing_address: normalizedBilling,
          shipping_address: normalizedShipping,
        })
        .eq('id', customerId);

      if (customerError) {
        throw customerError;
      }

      const { error: userError } = await supabase
        .from('users')
        .update({
          first_name: profileForm.firstName.trim() || null,
          last_name: profileForm.lastName.trim() || null,
          phone: profileForm.phone.trim() || null,
          business_profile: isBusiness
            ? {
                jobTitle: profileForm.jobTitle.trim() || undefined,
                website: profileForm.website.trim() || undefined,
                taxId: netTermsForm.taxId.trim() || profile?.business_profile?.taxId || undefined,
              }
            : null,
        })
        .eq('id', profile.id);

      if (userError) {
        throw userError;
      }

      setFeedback('Account details saved successfully.');
      await Promise.all([refreshProfile(), loadCustomerRecord()]);
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not save your updates. Please try again.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleNetTermsSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || !user) return;

    setNetTermsError('');
    setNetTermsMessage('');

    if (derivedNetTermsStatus === 'approved') {
      setNetTermsMessage('Your NET terms are already active. No additional action is needed.');
      return;
    }

    if (!netTermsForm.accountsPayableEmail.trim()) {
      setNetTermsError('Please provide an accounts payable email.');
      return;
    }

    if (!netTermsForm.estimatedMonthlySpend.trim()) {
      setNetTermsError('Please provide your estimated monthly spend.');
      return;
    }

    if (!netTermsForm.taxId.trim()) {
      setNetTermsError('Please provide a tax ID or EIN.');
      return;
    }

    setSubmittingNetTerms(true);

    try {
      const companyName = profileForm.businessName.trim() || customer?.company || '';
      const application: NetTermsApplication = {
        legalBusinessName: companyName,
        contactName: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
        contactEmail: user.email || customer?.email || undefined,
        contactPhone: profileForm.phone.trim() || customer?.phone || undefined,
        accountsPayableEmail: netTermsForm.accountsPayableEmail.trim(),
        estimatedMonthlySpend: netTermsForm.estimatedMonthlySpend.trim(),
        taxId: netTermsForm.taxId.trim(),
        notes: netTermsForm.notes.trim() || undefined,
        billingAddress: billingAddress,
        shippingAddress: sameAsBilling ? billingAddress : shippingAddress,
      };

      const { error: updateError } = await supabase
        .from('users')
        .update({
          net_terms_status: 'pending',
          net_terms_requested_at: new Date().toISOString(),
          net_terms_application: application,
        })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      await supabase
        .from('customers')
        .update({ terms_allowed: false })
        .eq('id', profile.customer_id || customer?.id || '');

      setNetTermsMessage('Your application has been submitted. We will notify you as soon as it is reviewed.');
      await refreshProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We were unable to submit your application. Please try again later.';
      setNetTermsError(message);
    } finally {
      setSubmittingNetTerms(false);
    }
  }

  async function handleWithdrawApplication() {
    if (!profile) return;
    setSubmittingNetTerms(true);
    setNetTermsMessage('');
    setNetTermsError('');

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          net_terms_status: 'not_requested',
          net_terms_requested_at: null,
          net_terms_application: null,
        })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      setNetTermsForm(initialNetTermsForm);
      setNetTermsMessage('Your NET terms request has been withdrawn. You can apply again at any time.');
      await refreshProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to withdraw your application. Please contact support.';
      setNetTermsError(message);
    } finally {
      setSubmittingNetTerms(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Sign In Required</h1>
        <p className="text-gray-600 mb-6">Create an account or sign in to manage your orders, addresses, and payment options.</p>
        <a
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
          <p className="text-gray-600">
            Manage your personal details, business information, addresses, and NET terms preferences in one place.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <UserIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Account Snapshot</h2>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500">Account Type</p>
              <p className="mt-2 text-sm font-semibold text-gray-900 capitalize">{accountType}</p>
              <p className="mt-1 text-xs text-gray-500">
                {isBusiness
                  ? 'Business accounts can save company info, manage PO numbers, and apply for NET terms.'
                  : 'Consumers can securely store addresses and view order history.'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500">NET Terms</p>
              <span className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
                {statusMeta.icon}
                {statusMeta.label}
              </span>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{statusMeta.description}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs uppercase text-gray-500">Order History</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">View all orders</p>
              <p className="mt-1 text-xs text-gray-500">Track shipment status, invoices, and reorder from your order history.</p>
              <a href="/orders" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">
                Manage Orders
                <FileText className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Need a quick checkout?</h3>
          <p className="text-sm text-gray-600">
            Guests can check out with a credit card, but creating an account lets you track orders and save addresses for future purchases.
          </p>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
            <p className="font-semibold">Tip</p>
            <p>Update your default billing and shipping addresses below to speed up checkout.</p>
          </div>
          <a
            href="/checkout"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Start Checkout
            <CreditCard className="w-4 h-4" />
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-start gap-2">
          <CheckCircle className="w-5 h-5 mt-0.5" />
          <span>{feedback}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Profile & Contact Information</h2>
            <p className="text-sm text-gray-600">
              Keep your contact and company details up to date to ensure accurate invoices and shipping information.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-gray-500" />
              First Name
            </label>
            <input
              type="text"
              value={profileForm.firstName}
              onChange={(event) => updateProfileField('firstName', event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-gray-500" />
              Last Name
            </label>
            <input
              type="text"
              value={profileForm.lastName}
              onChange={(event) => updateProfileField('lastName', event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500" />
              Phone Number
            </label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(event) => updateProfileField('phone', event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              Email
            </label>
            <input
              type="email"
              value={user.email || ''}
              disabled
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gray-500" />
              {isBusiness ? 'Business Name' : 'Company / Organization (optional)'}
            </label>
            <input
              type="text"
              value={profileForm.businessName}
              onChange={(event) => updateProfileField('businessName', event.target.value)}
              required={isBusiness}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder={isBusiness ? 'Registered business name' : 'Add if you shop on behalf of a company'}
            />
          </div>
          {isBusiness && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">Job Title</label>
                <input
                  type="text"
                  value={profileForm.jobTitle}
                  onChange={(event) => updateProfileField('jobTitle', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Website</label>
                <input
                  type="url"
                  value={profileForm.website}
                  onChange={(event) => updateProfileField('website', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="https://"
                />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Billing Address</h3>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={billingAddress.name}
                onChange={(event) => updateBilling('name', event.target.value)}
                placeholder="Full Name"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={billingAddress.company}
                onChange={(event) => updateBilling('company', event.target.value)}
                placeholder="Company"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={billingAddress.address1}
                onChange={(event) => updateBilling('address1', event.target.value)}
                placeholder="Address Line 1"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={billingAddress.address2}
                onChange={(event) => updateBilling('address2', event.target.value)}
                placeholder="Address Line 2"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={billingAddress.city}
                  onChange={(event) => updateBilling('city', event.target.value)}
                  placeholder="City"
                  required
                  className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={billingAddress.state}
                  onChange={(event) => updateBilling('state', event.target.value)}
                  placeholder="State"
                  required
                  className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={billingAddress.zip}
                  onChange={(event) => updateBilling('zip', event.target.value)}
                  placeholder="ZIP"
                  required
                  className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={billingAddress.country}
                  onChange={(event) => updateBilling('country', event.target.value)}
                  placeholder="Country"
                  className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  value={billingAddress.phone}
                  onChange={(event) => updateBilling('phone', event.target.value)}
                  placeholder="Phone"
                  className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Shipping Address</h3>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(event) => setSameAsBilling(event.target.checked)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
                Same as billing
              </label>
            </div>

            {!sameAsBilling && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={shippingAddress.name}
                  onChange={(event) => updateShipping('name', event.target.value)}
                  placeholder="Full Name"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={shippingAddress.company}
                  onChange={(event) => updateShipping('company', event.target.value)}
                  placeholder="Company"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={shippingAddress.address1}
                  onChange={(event) => updateShipping('address1', event.target.value)}
                  placeholder="Address Line 1"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={shippingAddress.address2}
                  onChange={(event) => updateShipping('address2', event.target.value)}
                  placeholder="Address Line 2"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input
                    type="text"
                    value={shippingAddress.city}
                    onChange={(event) => updateShipping('city', event.target.value)}
                    placeholder="City"
                    required
                    className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={shippingAddress.state}
                    onChange={(event) => updateShipping('state', event.target.value)}
                    placeholder="State"
                    required
                    className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={shippingAddress.zip}
                    onChange={(event) => updateShipping('zip', event.target.value)}
                    placeholder="ZIP"
                    required
                    className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={shippingAddress.country}
                    onChange={(event) => updateShipping('country', event.target.value)}
                    placeholder="Country"
                    className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="tel"
                    value={shippingAddress.phone}
                    onChange={(event) => updateShipping('phone', event.target.value)}
                    placeholder="Phone"
                    className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {sameAsBilling && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                We will use your billing address for shipping until you specify a different location.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Changes affect future orders immediately.
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>

      {isBusiness && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Business Credit & NET Terms</h2>
              <p className="text-sm text-gray-600">
                Apply for NET payment terms to place orders now and pay by invoice later. Approval usually takes 1-2 business days.
              </p>
            </div>
          </div>

          <div className={`rounded-lg border ${statusMeta.panelClass} p-4`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {statusMeta.icon}
              {statusMeta.label}
            </div>
            <p className="mt-2 text-sm text-gray-700">{statusMeta.description}</p>
          </div>

          {derivedNetTermsStatus === 'approved' ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-start gap-2">
              <CheckCircle className="w-5 h-5 mt-0.5" />
              <span>
                Your NET terms are active. Select “Invoice / NET Terms” during checkout to place orders using your available credit.
              </span>
            </div>
          ) : (
            <form onSubmit={handleNetTermsSubmit} className="space-y-4">
              {netTermsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{netTermsError}</span>
                </div>
              )}

              {netTermsMessage && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5" />
                  <span>{netTermsMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Accounts Payable Email</label>
                  <input
                    type="email"
                    value={netTermsForm.accountsPayableEmail}
                    onChange={(event) => updateNetTermsField('accountsPayableEmail', event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="ap@company.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Estimated Monthly Spend</label>
                  <input
                    type="text"
                    value={netTermsForm.estimatedMonthlySpend}
                    onChange={(event) => updateNetTermsField('estimatedMonthlySpend', event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="$2,500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Tax ID / EIN</label>
                  <input
                    type="text"
                    value={netTermsForm.taxId}
                    onChange={(event) => updateNetTermsField('taxId', event.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Notes for Credit Team (optional)</label>
                  <textarea
                    value={netTermsForm.notes}
                    onChange={(event) => updateNetTermsField('notes', event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Share trade references or additional context to help expedite approval."
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={submittingNetTerms}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {submittingNetTerms ? 'Submitting…' : derivedNetTermsStatus === 'pending' ? 'Update Application' : 'Apply for NET Terms'}
                </button>
                {derivedNetTermsStatus === 'pending' && (
                  <button
                    type="button"
                    onClick={handleWithdrawApplication}
                    disabled={submittingNetTerms}
                    className="text-sm font-semibold text-gray-600 hover:text-gray-800"
                  >
                    Withdraw Application
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded-lg shadow flex items-center gap-3 text-gray-700">
            <Clock className="w-5 h-5 animate-spin" />
            Loading account details…
          </div>
        </div>
      )}
    </div>
  );
}
