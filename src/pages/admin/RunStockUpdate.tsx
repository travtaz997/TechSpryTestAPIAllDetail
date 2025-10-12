import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database, CheckCircle, AlertCircle } from 'lucide-react';

export default function RunStockUpdate() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult({ success: false, message: 'You must be signed in.' });
        setLoading(false);
        return;
      }

const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-products-stock-update`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,              // required
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,     // required
    'Content-Type': 'application/json',
  },
});


      const json = await res.json();
      if (!res.ok) {
        setResult({ success: false, message: json?.error || JSON.stringify(json) });
      } else {
        const updated = json?.details?.backfill_updated ?? 'n/a';
        setResult({ success: true, message: `Stock column ensured. Backfilled rows: ${updated}.` });
      }
    } catch (e: any) {
      setResult({ success: false, message: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center mb-6">
          <Database className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Update Product Stock</h1>
          <p className="text-gray-600 text-sm">
            Adds the <code>stock_available</code> column to <code>products</code> (if missing) and backfills from ScanSource.
          </p>
        </div>

        {result && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              result.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm whitespace-pre-line">{result.message}</div>
            </div>
          </div>
        )}

        <button
          onClick={run}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Running…' : 'Run Stock Update'}
        </button>

        <div className="mt-4 text-center">
          <a href="/admin" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
            ← Back to Admin
          </a>
        </div>
      </div>
    </div>
  );
}
