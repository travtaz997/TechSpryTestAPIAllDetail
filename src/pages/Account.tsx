import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Building2, Mail, Phone, MapPin, Save, LogOut, CheckCircle, AlertCircle } from 'lucide-react';

interface Customer {
  id: string;
  company: string;
  email: string;
  phone: string | null;
  billing_address: any;
  shipping_address: any;
  terms_allowed: boolean;
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

export default function Account() {
  const { user, profile, signOut } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState<Address>(emptyAddress);
  const [shippingAddress, setShippingAddress] = useState<Address>(emptyAddress);
  const [sameAsBilling, setSameAsBilling] = useState(true);

  useEffect(() => {
    if (user && profile?.customer_id) {
      loadCustomer();
    } else {
      setLoading(false);
      if (user?.email) {
        setCompanyEmail(user.email);
        setBillingAddress({ ...emptyAddress, name: user.email });
        setShippingAddress({ ...emptyAddress, name: user.email });
      }
    }
  }, [user, profile]);

  async function loadCustomer() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', profile?.customer_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCustomer(data);
        setCompanyName(data.company || '');
        setCompanyEmail(data.email || '');
        setCompanyPhone(data.phone || '');

        if (data.billing_address && Object.keys(data.billing_address).length > 0) {
          setBillingAddress({ ...emptyAddress, ...data.billing_address });
        }

        if (data.shipping_address && Object.keys(data.shipping_address).length > 0) {
          setShippingAddress({ ...emptyAddress, ...data.shipping_address });
          setSameAsBilling(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account details');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setCreatingCompany(true);
    setError('');
    setSuccess('');

    try {
      if (!profile?.id) {
        throw new Error('User profile not found');
      }

      if (!companyName || !companyEmail) {
        throw new Error('Company name and email are required');
      }

      const finalShippingAddress = sameAsBilling ? billingAddress : shippingAddress;

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          company: companyName,
          email: companyEmail,
          phone: companyPhone || null,
          billing_address: billingAddress,
          shipping_address: finalShippingAddress,
          terms_allowed: false,
        })
        .select()
        .single();

      if (customerError) throw customerError;

      const { error: updateError } = await supabase
        .from('users')
        .update({ customer_id: newCustomer.id })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setSuccess('Company profile created successfully!');

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company profile');
    } finally {
      setCreatingCompany(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!profile?.customer_id) {
        throw new Error('No customer account linked');
      }

      const finalShippingAddress = sameAsBilling ? billingAddress : shippingAddress;

      const { error } = await supabase
        .from('customers')
        .update({
          company: companyName,
          email: companyEmail,
          phone: companyPhone || null,
          billing_address: billingAddress,
          shipping_address: finalShippingAddress,
        })
        .eq('id', profile.customer_id);

      if (error) throw error;

      setSuccess('Account updated successfully!');
      await loadCustomer();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  function updateBillingAddress(field: keyof Address, value: string) {
    setBillingAddress({ ...billingAddress, [field]: value });
  }

  function updateShippingAddress(field: keyof Address, value: string) {
    setShippingAddress({ ...shippingAddress, [field]: value });
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Sign In Required</h1>
          <p className="text-gray-600 mb-6">Please sign in to view your account.</p>
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Account Settings</h1>
          <p className="text-gray-600">Manage your profile and company information</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition font-semibold"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-start gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">User Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 capitalize">
                  {profile?.role || 'buyer'}
                </div>
              </div>
            </div>
          </div>

          {profile?.customer_id && customer ? (
            <form onSubmit={handleSave}>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-800">Company Information</h2>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="company"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your Company Name"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Company Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="company@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline mr-1" />
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  {customer.terms_allowed && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-700 font-semibold">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Net Payment Terms: Approved
                      </p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <MapPin className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-800">Billing Address</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contact Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingAddress.name}
                            onChange={(e) => updateBillingAddress('name', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="John Doe"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company
                          </label>
                          <input
                            type="text"
                            value={billingAddress.company}
                            onChange={(e) => updateBillingAddress('company', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Company Name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Line 1 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={billingAddress.address1}
                          onChange={(e) => updateBillingAddress('address1', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="123 Main Street"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Line 2
                        </label>
                        <input
                          type="text"
                          value={billingAddress.address2}
                          onChange={(e) => updateBillingAddress('address2', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Apt, Suite, Unit, Building (optional)"
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            City <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingAddress.city}
                            onChange={(e) => updateBillingAddress('city', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="City"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            State <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingAddress.state}
                            onChange={(e) => updateBillingAddress('state', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="CA"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ZIP <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingAddress.zip}
                            onChange={(e) => updateBillingAddress('zip', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="12345"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Country
                          </label>
                          <input
                            type="text"
                            value={billingAddress.country}
                            onChange={(e) => updateBillingAddress('country', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="US"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={billingAddress.phone}
                            onChange={(e) => updateBillingAddress('phone', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="(555) 123-4567"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <MapPin className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-800">Shipping Address</h3>
                    </div>

                    <div className="mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sameAsBilling}
                          onChange={(e) => setSameAsBilling(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Same as billing address</span>
                      </label>
                    </div>

                    {!sameAsBilling && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Contact Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.name}
                              onChange={(e) => updateShippingAddress('name', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="John Doe"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Company
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.company}
                              onChange={(e) => updateShippingAddress('company', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Company Name"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Address Line 1 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={shippingAddress.address1}
                            onChange={(e) => updateShippingAddress('address1', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="123 Main Street"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Address Line 2
                          </label>
                          <input
                            type="text"
                            value={shippingAddress.address2}
                            onChange={(e) => updateShippingAddress('address2', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Apt, Suite, Unit, Building (optional)"
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              City <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.city}
                              onChange={(e) => updateShippingAddress('city', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="City"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              State <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.state}
                              onChange={(e) => updateShippingAddress('state', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="CA"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              ZIP <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.zip}
                              onChange={(e) => updateShippingAddress('zip', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="12345"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Country
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.country}
                              onChange={(e) => updateShippingAddress('country', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="US"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Phone
                            </label>
                            <input
                              type="tel"
                              value={shippingAddress.phone}
                              onChange={(e) => updateShippingAddress('phone', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="(555) 123-4567"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateCompany}>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Building2 className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-800">Create Company Profile</h2>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    Set up your company profile to enable checkout and order management features.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="newCompany" className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="newCompany"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Your Company Name"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-1">
                        Company Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="newEmail"
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="company@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="newPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline mr-1" />
                      Phone Number
                    </label>
                    <input
                      id="newPhone"
                      type="tel"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <MapPin className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-800">Billing Address</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contact Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingAddress.name}
                            onChange={(e) => updateBillingAddress('name', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="John Doe"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company
                          </label>
                          <input
                            type="text"
                            value={billingAddress.company}
                            onChange={(e) => updateBillingAddress('company', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Company Name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Line 1 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={billingAddress.address1}
                          onChange={(e) => updateBillingAddress('address1', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="123 Main Street"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address Line 2
                        </label>
                        <input
                          type="text"
                          value={billingAddress.address2}
                          onChange={(e) => updateBillingAddress('address2', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Apt, Suite, Unit, Building (optional)"
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            City <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingAddress.city}
                            onChange={(e) => updateBillingAddress('city', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="City"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            State <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingAddress.state}
                            onChange={(e) => updateBillingAddress('state', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="CA"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ZIP <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingAddress.zip}
                            onChange={(e) => updateBillingAddress('zip', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="12345"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Country
                          </label>
                          <input
                            type="text"
                            value={billingAddress.country}
                            onChange={(e) => updateBillingAddress('country', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="US"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={billingAddress.phone}
                            onChange={(e) => updateBillingAddress('phone', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="(555) 123-4567"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <MapPin className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-800">Shipping Address</h3>
                    </div>

                    <div className="mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sameAsBilling}
                          onChange={(e) => setSameAsBilling(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Same as billing address</span>
                      </label>
                    </div>

                    {!sameAsBilling && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Contact Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.name}
                              onChange={(e) => updateShippingAddress('name', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="John Doe"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Company
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.company}
                              onChange={(e) => updateShippingAddress('company', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Company Name"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Address Line 1 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={shippingAddress.address1}
                            onChange={(e) => updateShippingAddress('address1', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="123 Main Street"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Address Line 2
                          </label>
                          <input
                            type="text"
                            value={shippingAddress.address2}
                            onChange={(e) => updateShippingAddress('address2', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Apt, Suite, Unit, Building (optional)"
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              City <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.city}
                              onChange={(e) => updateShippingAddress('city', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="City"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              State <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.state}
                              onChange={(e) => updateShippingAddress('state', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="CA"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              ZIP <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.zip}
                              onChange={(e) => updateShippingAddress('zip', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="12345"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Country
                            </label>
                            <input
                              type="text"
                              value={shippingAddress.country}
                              onChange={(e) => updateShippingAddress('country', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="US"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Phone
                            </label>
                            <input
                              type="tel"
                              value={shippingAddress.phone}
                              onChange={(e) => updateShippingAddress('phone', e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="(555) 123-4567"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={creatingCompany}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {creatingCompany ? 'Creating...' : 'Create Company Profile'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
