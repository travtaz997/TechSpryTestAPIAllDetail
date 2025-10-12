import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/admin/AdminLayout';
import { Users, Search, Eye, CheckCircle, XCircle } from 'lucide-react';

interface Customer {
  id: string;
  company: string;
  email: string;
  phone: string;
  terms_allowed: boolean;
  groups: string[];
  created_at: string;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [search]);

  async function loadCustomers() {
    let query = supabase.from('customers').select('*').order('company');

    if (search) {
      query = query.or(`company.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data } = await query.limit(100);
    if (data) setCustomers(data);
    setLoading(false);
  }

  async function toggleTerms(id: string, currentValue: boolean) {
    await supabase
      .from('customers')
      .update({ terms_allowed: !currentValue })
      .eq('id', id);
    loadCustomers();
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Customers</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by company or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No customers found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Terms</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Groups</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{customer.company}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{customer.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => toggleTerms(customer.id, customer.terms_allowed)}
                        className="flex items-center gap-1"
                      >
                        {customer.terms_allowed ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 text-xs">Allowed</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500 text-xs">No</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {customer.groups?.length > 0 ? customer.groups.join(', ') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Showing {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </div>
      </div>
    </AdminLayout>
  );
}
