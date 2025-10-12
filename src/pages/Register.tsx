import { useMemo, useState } from 'react';
import { useAuth, BusinessProfile, NetTermsApplication, NetTermsStatus } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type AccountType = 'consumer' | 'business';

interface RegistrationState {
  accountType: AccountType;
  firstName: string;
  lastName: string;
  businessName: string;
  jobTitle: string;
  phone: string;
  website: string;
  email: string;
  password: string;
  confirmPassword: string;
  applyForTerms: boolean;
  accountsPayableEmail: string;
  estimatedMonthlySpend: string;
  taxId: string;
  notes: string;
}

const initialState: RegistrationState = {
  accountType: 'consumer',
  firstName: '',
  lastName: '',
  businessName: '',
  jobTitle: '',
  phone: '',
  website: '',
  email: '',
  password: '',
  confirmPassword: '',
  applyForTerms: false,
  accountsPayableEmail: '',
  estimatedMonthlySpend: '',
  taxId: '',
  notes: '',
};

function getStatusDescription(status: NetTermsStatus | null | undefined) {
  switch (status) {
    case 'pending':
      return 'Your application is in review. Our credit team typically responds within 1-2 business days.';
    case 'approved':
      return 'Your business account has been approved for NET payment terms.';
    case 'declined':
      return 'Your application was declined. You can still place orders using a credit card.';
    default:
      return 'You can apply for NET payment terms during registration or from your account dashboard later.';
  }
}

export default function Register() {
  const [form, setForm] = useState<RegistrationState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { signUp } = useAuth();

  const isBusiness = form.accountType === 'business';

  const netTermsStatusPreview: NetTermsStatus | null = useMemo(() => {
    if (!isBusiness) return null;
    return form.applyForTerms ? 'pending' : 'not_requested';
  }, [form.applyForTerms, isBusiness]);

  function updateField<Key extends keyof RegistrationState>(field: Key, value: RegistrationState[Key]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (loading) return;

    const {
      password,
      confirmPassword,
      email,
      firstName,
      lastName,
      businessName,
      accountType,
      phone,
      jobTitle,
      website,
      applyForTerms,
      accountsPayableEmail,
      estimatedMonthlySpend,
      taxId,
      notes,
    } = form;

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!firstName.trim() || (!lastName.trim() && accountType === 'consumer')) {
      setError('Please provide your name.');
      return;
    }

    if (isBusiness && !businessName.trim()) {
      setError('Please provide your business name.');
      return;
    }

    if (applyForTerms) {
      if (!accountsPayableEmail.trim()) {
        setError('Accounts payable email is required to apply for NET terms.');
        return;
      }

      if (!estimatedMonthlySpend.trim()) {
        setError('Estimated monthly spend is required to apply for NET terms.');
        return;
      }

      if (!taxId.trim()) {
        setError('Tax ID or EIN is required to apply for NET terms.');
        return;
      }
    }

    setLoading(true);

    try {
      const { error: signUpError, data } = await signUp(email.trim(), password);

      if (signUpError) {
        throw signUpError;
      }

      const newUser = data?.user;

      if (!newUser) {
        setSuccessMessage(
          'Your account has been created. Please verify your email address and then sign in to complete your profile.'
        );
        setLoading(false);
        return;
      }

      const application: NetTermsApplication | null = applyForTerms
        ? {
            legalBusinessName: businessName.trim(),
            contactName: `${firstName.trim()} ${lastName.trim()}`.trim(),
            contactEmail: email.trim(),
            contactPhone: phone.trim() || undefined,
            accountsPayableEmail: accountsPayableEmail.trim(),
            estimatedMonthlySpend: estimatedMonthlySpend.trim(),
            taxId: taxId.trim(),
            notes: notes.trim() || undefined,
          }
        : null;

      const businessProfile: BusinessProfile | null = isBusiness
        ? {
            jobTitle: jobTitle.trim() || undefined,
            website: website.trim() || undefined,
            taxId: taxId.trim() || undefined,
          }
        : null;

      const { error: profileError } = await supabase
        .from('users')
        .update({
          account_type: accountType,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          business_profile: businessProfile,
          net_terms_status: applyForTerms ? 'pending' : 'not_requested',
          net_terms_requested_at: applyForTerms ? new Date().toISOString() : null,
          net_terms_application: application,
        })
        .eq('auth_user_id', newUser.id);

      if (profileError) {
        throw profileError;
      }

      const companyName = isBusiness
        ? businessName.trim()
        : `${firstName.trim()} ${lastName.trim()}`.trim() || email.trim();

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          company: companyName,
          email: email.trim(),
          phone: phone.trim() || null,
          billing_address: null,
          shipping_address: null,
          terms_allowed: false,
        })
        .select()
        .maybeSingle();

      if (customerError) {
        throw customerError;
      }

      if (customer?.id) {
        await supabase
          .from('users')
          .update({ customer_id: customer.id })
          .eq('auth_user_id', newUser.id);
      }

      setSuccessMessage(
        applyForTerms
          ? 'Thanks! Your business account has been created and your NET terms application is under review. You can still place orders with a credit card while we review your request.'
          : 'Your account has been created successfully. You can now sign in to start shopping.'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create your account. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (successMessage) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full text-center">
          <div className="bg-white p-10 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-green-600 text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Registration Complete</h1>
            <p className="text-gray-600 mb-6 leading-relaxed">{successMessage}</p>
            <a
              href="/login"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Continue to Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Create Your Account</h1>
          <p className="text-lg text-gray-600">
            Whether you are shopping for yourself or on behalf of a business, we have a checkout flow tailored for you.
          </p>
        </div>

        <div className="bg-white p-10 rounded-xl border border-gray-200 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Account Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label
                  className={`rounded-xl border-2 p-5 transition cursor-pointer ${
                    form.accountType === 'consumer' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="accountType"
                    value="consumer"
                    checked={form.accountType === 'consumer'}
                    onChange={() => updateField('accountType', 'consumer')}
                    className="hidden"
                  />
                  <div className="font-semibold text-gray-900 mb-1">Consumer</div>
                  <p className="text-sm text-gray-600">
                    Perfect for individuals purchasing equipment for personal or small-scale use.
                  </p>
                </label>

                <label
                  className={`rounded-xl border-2 p-5 transition cursor-pointer ${
                    form.accountType === 'business' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="accountType"
                    value="business"
                    checked={form.accountType === 'business'}
                    onChange={() => updateField('accountType', 'business')}
                    className="hidden"
                  />
                  <div className="font-semibold text-gray-900 mb-1">Business</div>
                  <p className="text-sm text-gray-600">
                    Access business pricing, saved company details, and optional NET terms for invoicing.
                  </p>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(event) => updateField('firstName', event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                  required={form.accountType === 'consumer'}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {isBusiness && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(event) => updateField('businessName', event.target.value)}
                    required={isBusiness}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Registered business name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Title (optional)</label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(event) => updateField('jobTitle', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Website (optional)</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={(event) => updateField('website', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="https://"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Create a strong password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {isBusiness && (
              <div className="rounded-xl border border-gray-200 p-6 bg-gray-50">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">NET Payment Terms</h3>
                    <p className="text-sm text-gray-600">
                      Apply now for invoicing and pay-by-check privileges. Applications are usually reviewed within 1-2 business
                      days.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.applyForTerms}
                      onChange={(event) => updateField('applyForTerms', event.target.checked)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    Apply now
                  </label>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  {getStatusDescription(netTermsStatusPreview)}
                </p>

                {form.applyForTerms && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Accounts Payable Email</label>
                      <input
                        type="email"
                        value={form.accountsPayableEmail}
                        onChange={(event) => updateField('accountsPayableEmail', event.target.value)}
                        required={form.applyForTerms}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        placeholder="ap@yourcompany.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Monthly Spend</label>
                      <input
                        type="text"
                        value={form.estimatedMonthlySpend}
                        onChange={(event) => updateField('estimatedMonthlySpend', event.target.value)}
                        required={form.applyForTerms}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        placeholder="$2,500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID / EIN</label>
                      <input
                        type="text"
                        value={form.taxId}
                        onChange={(event) => updateField('taxId', event.target.value)}
                        required={form.applyForTerms}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes for Credit Team (optional)</label>
                      <textarea
                        value={form.notes}
                        onChange={(event) => updateField('notes', event.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        placeholder="Share anything that will help us review your account."
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating your account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-gray-600">Already have an account?</span>{' '}
            <a href="/login" className="text-blue-600 font-semibold hover:text-blue-700">
              Sign In
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
