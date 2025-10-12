import AdminLayout from '../../components/admin/AdminLayout';
import { Construction } from 'lucide-react';

interface AdminPlaceholderProps {
  title: string;
  description?: string;
}

export default function AdminPlaceholder({ title, description }: AdminPlaceholderProps) {
  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">{title}</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Construction className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            {description || `The ${title} management interface is under development.`}
          </p>
          <a
            href="/admin"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}
