import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/admin/AdminLayout';
import { UserCog, CheckCircle, XCircle } from 'lucide-react';

interface User {
  id: string;
  email: string;
  role: string;
  active: boolean;
  customer_id: string | null;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  }

  async function toggleActive(id: string, currentValue: boolean) {
    await supabase
      .from('users')
      .update({ active: !currentValue })
      .eq('id', id);
    loadUsers();
  }

  async function updateRole(id: string, role: string) {
    await supabase
      .from('users')
      .update({ role })
      .eq('id', id);
    loadUsers();
  }

  function getRoleBadgeColor(role: string) {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      buyer: 'bg-blue-100 text-blue-800',
      viewer: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Users</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <UserCog className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{user.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <select
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-semibold ${getRoleBadgeColor(user.role)}`}
                      >
                        <option value="admin">Admin</option>
                        <option value="buyer">Buyer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => toggleActive(user.id, user.active)}
                        className="flex items-center gap-1"
                      >
                        {user.active ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 text-xs">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500 text-xs">Inactive</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs text-gray-500">
                        {user.customer_id ? 'Linked' : 'No customer'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Showing {users.length} user{users.length !== 1 ? 's' : ''}
        </div>
      </div>
    </AdminLayout>
  );
}
