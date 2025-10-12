import { useState } from 'react';
import { seedDatabase } from '../utils/seedDatabase';

export default function SeedData() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSeed() {
    setLoading(true);
    setMessage('');
    try {
      await seedDatabase();
      setMessage('Database seeded successfully! You can now browse the catalog.');
    } catch (error) {
      setMessage('Error seeding database: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white p-8 rounded-lg border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Seed Sample Data</h1>
        <p className="text-gray-600 mb-6">
          Click the button below to populate the database with sample brands and products.
          This will create 12 brands and 12 products for demonstration purposes.
        </p>

        <button
          onClick={handleSeed}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Seeding Database...' : 'Seed Database'}
        </button>

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${
            message.includes('Error')
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        {message && !message.includes('Error') && (
          <div className="mt-6">
            <a
              href="/catalog"
              className="block w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition text-center font-semibold"
            >
              Browse Catalog
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
