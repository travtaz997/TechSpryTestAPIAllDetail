import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Play, RefreshCw, Package, AlertCircle, CheckCircle, Database, Upload, Eye, X, Trash2 } from 'lucide-react';

interface ImportStatus {
  startedAt: string;
  finishedAt: string;
  scanned: number;
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface StagingItem {
  item_number: string;
  mfr_item_number: string;
  manufacturer: string;
  title: string;
  description?: string | null;
  item_description?: string | null;
  catalog_name: string;
  category_path: string;
  item_status: string;
  item_image_url: string;
  business_unit?: string | null;
  product_family?: string | null;
  product_family_description?: string | null;
  product_family_headline?: string | null;
  plant_material_status_valid_from?: string | null;
  base_unit_of_measure?: string | null;
  general_item_category_group?: string | null;
  gross_weight?: number | null;
  material_group?: string | null;
  material_type?: string | null;
  battery_indicator?: string | null;
  rohs_compliance_indicator?: string | null;
  manufacturer_division?: string | null;
  commodity_import_code_number?: string | null;
  country_of_origin?: string | null;
  unspsc?: string | null;
  delivering_plant?: string | null;
  material_freight_group?: string | null;
  minimum_order_quantity?: number | null;
  salesperson_intervention_required?: boolean | null;
  sell_via_edi?: boolean | null;
  sell_via_web?: string | null;
  serial_number_profile?: string | null;
  packaged_length?: number | null;
  packaged_width?: number | null;
  packaged_height?: number | null;
  date_added?: string | null;
  rebox_item?: boolean | null;
  b_stock_item?: boolean | null;
  product_media?: { MediaType: string | null; URL: string | null }[] | null;
  stock_available?: number | null;
  pricing_json: any;
  last_synced_at: string;
}

interface DiffItem {
  item_number: string;
  title: string;
  msrp?: number;
  manufacturer?: string;
  category?: string;
  availability?: number | null; // NEW: from server
}

interface DiffResult {
  new: DiffItem[];
  changed: DiffItem[];
  unchanged: string[];
}

export default function AdminScanSource() {
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const [manufacturers, setManufacturers] = useState('');
  const [categories, setCategories] = useState('');
  const [searchText, setSearchText] = useState('');
  const [maxPages, setMaxPages] = useState(5);

  const [mfrItemNumbers, setMfrItemNumbers] = useState(''); // (kept if you use it later)

  const [activeTab, setActiveTab] = useState<'import' | 'staging' | 'diff'>('import');

  const [diffManufacturerFilter, setDiffManufacturerFilter] = useState('');
  const [diffCategoryFilter, setDiffCategoryFilter] = useState('');
  const [diffSearchFilter, setDiffSearchFilter] = useState('');

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scansource-importer`;

  async function callFunction(endpoint: string, method = 'GET', body?: any) {
    const url = `${functionUrl}${endpoint}`;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    };

    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async function handleRunImport() {
    setLoading(true);
    setError('');
    setSuccess('');
    setImportStatus(null);

    try {
      const payload: any = { maxPages };
      if (mfrItemNumbers.trim()) {
        payload.mfrItemNumbers = mfrItemNumbers.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        if (manufacturers.trim()) payload.manufacturers = manufacturers.split(',').map((m) => m.trim());
        if (categories.trim()) payload.categories = categories.split(',').map((c) => c.trim());
        if (searchText.trim()) payload.searchText = searchText.trim();
      }

      const result = await callFunction('/import/run', 'POST', payload);
      if (result.jobId) {
        setCurrentJobId(result.jobId);
        setSuccess('Import job started. Polling for progress.');
        setPolling(true);
        pollJobStatus(result.jobId);
      } else {
        setError('Failed to start import job');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run import');
    } finally {
      setLoading(false);
    }
  }

  async function pollJobStatus(jobId: string) {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setPolling(false);
        setError('Import polling timed out. Check status manually.');
        return;
      }
      try {
        const job = await callFunction(`/import/status?jobId=${jobId}`);
        if (job?.progress) {
          setImportStatus({
            startedAt: job.started_at || job.created_at,
            finishedAt: job.completed_at || '',
            scanned: job.progress.scanned || 0,
            added: job.progress.added || 0,
            updated: job.progress.updated || 0,
            skipped: job.progress.skipped || 0,
            errors: job.progress.errors || [],
          });
        }
        if (job.status === 'completed') {
          setPolling(false);
          setSuccess('Import completed.');
          if (job.progress?.errors?.length > 0) setError(`Import completed with ${job.progress.errors.length} errors`);
          return;
        } else if (job.status === 'failed') {
          setPolling(false);
          setError('Import job failed');
          return;
        }
        attempts++;
        setTimeout(poll, 3000);
      } catch (err: any) {
        setPolling(false);
        setError(err.message || 'Failed to check job status');
      }
    };
    poll();
  }

  async function handleLoadStatus() {
    if (!currentJobId) {
      setError('No active job. Start an import first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const job = await callFunction(`/import/status?jobId=${currentJobId}`);
      if (job?.progress) {
        setImportStatus({
          startedAt: job.started_at || job.created_at,
          finishedAt: job.completed_at || '',
          scanned: job.progress.scanned || 0,
          added: job.progress.added || 0,
          updated: job.progress.updated || 0,
          skipped: job.progress.skipped || 0,
          errors: job.progress.errors || [],
        });
      }
      if (job.status === 'completed') setSuccess('Import completed.');
      else if (job.status === 'failed') setError('Import failed');
      else if (job.status === 'running') setSuccess('Import is running…');
    } catch (err: any) {
      setError(err.message || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadStaging() {
    setLoading(true);
    setError('');
    try {
      const result = await callFunction('/staging/items');
      setStagingItems(result.items || []);
      setSuccess(`Loaded ${result.items?.length || 0} staging items`);
    } catch (err: any) {
      setError(err.message || 'Failed to load staging items');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadDiff() {
    setLoading(true);
    setError('');
    try {
      const result = await callFunction('/import/diff');
      setDiff(result);
      setSuccess(`Found ${result.new.length} new items, ${result.changed.length} changed items`);
    } catch (err: any) {
      setError(err.message || 'Failed to load diff');
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (selectedItems.size === 0) {
      setError('Select items to publish');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await callFunction('/import/publish', 'POST', {
        item_numbers: Array.from(selectedItems),
        upsert: true,
      });
      setSuccess(`Published ${result.results?.length || 0} items`);
      setSelectedItems(new Set());
      await handleLoadDiff();
    } catch (err: any) {
      setError(err.message || 'Failed to publish items');
    } finally {
      setLoading(false);
    }
  }

  async function handleClearStaging() {
    if (!confirm('Delete ALL staging items?')) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const url = `${functionUrl}/staging/clear`;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });
      if (!res.ok) throw new Error(`Failed to clear staging: ${await res.text()}`);
      const result = await res.json();
      setSuccess(`Cleared ${result.count || 0} staging items`);
      setDiff(null);
      await handleLoadDiff();
    } catch (err: any) {
      setError(err.message || 'Failed to clear staging');
    } finally {
      setLoading(false);
    }
  }

  function toggleItemSelection(itemNumber: string) {
    const ns = new Set(selectedItems);
    ns.has(itemNumber) ? ns.delete(itemNumber) : ns.add(itemNumber);
    setSelectedItems(ns);
  }

  function selectAllNew() {
    if (!diff) return;
    const filtered = getFilteredNewItems();
    setSelectedItems(new Set(filtered.map((i) => i.item_number)));
  }

  function clearFilters() {
    setDiffManufacturerFilter('');
    setDiffCategoryFilter('');
    setDiffSearchFilter('');
  }

  function getFilteredNewItems() {
    if (!diff) return [];
    return diff.new.filter((item) => {
      const m = !diffManufacturerFilter || item.manufacturer?.toLowerCase().includes(diffManufacturerFilter.toLowerCase());
      const c = !diffCategoryFilter || item.category?.toLowerCase().includes(diffCategoryFilter.toLowerCase());
      const s = !diffSearchFilter || item.title?.toLowerCase().includes(diffSearchFilter.toLowerCase()) || item.item_number?.toLowerCase().includes(diffSearchFilter.toLowerCase());
      return m && c && s;
    });
  }

  function getFilteredChangedItems() {
    if (!diff) return [];
    return diff.changed.filter((item) => {
      const m = !diffManufacturerFilter || item.manufacturer?.toLowerCase().includes(diffManufacturerFilter.toLowerCase());
      const c = !diffCategoryFilter || item.category?.toLowerCase().includes(diffCategoryFilter.toLowerCase());
      const s = !diffSearchFilter || item.title?.toLowerCase().includes(diffSearchFilter.toLowerCase()) || item.item_number?.toLowerCase().includes(diffSearchFilter.toLowerCase());
      return m && c && s;
    });
  }

  function StockBadge({ qty }: { qty?: number | null }) {
    if (qty == null) {
      return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">Stock: —</span>;
    }
    if (qty > 0) {
      return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">Stock: {qty}</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-red-100 text-red-800">Stock: 0</span>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">ScanSource Importer</h1>
        <p className="text-gray-600">Import and manage products from ScanSource API</p>
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

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-6 py-3 font-semibold border-b-2 transition ${activeTab === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
            >
              <Play className="w-4 h-4 inline mr-2" />
              Import
            </button>
            <button
              onClick={() => { setActiveTab('staging'); handleLoadStaging(); }}
              className={`px-6 py-3 font-semibold border-b-2 transition ${activeTab === 'staging' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
            >
              <Database className="w-4 h-4 inline mr-2" />
              Staging Items
            </button>
            <button
              onClick={() => { setActiveTab('diff'); handleLoadDiff(); }}
              className={`px-6 py-3 font-semibold border-b-2 transition ${activeTab === 'diff' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Review & Publish
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">Import Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Numbers (optional)</label>
                    <input
                      type="text"
                      value={mfrItemNumbers}
                      onChange={(e) => setMfrItemNumbers(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., UAP-AC-PRO, AXC-01490001"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If provided, the server will resolve manufacturer part or ScanSource item automatically.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturers (comma-separated)</label>
                    <input
                      type="text"
                      value={manufacturers}
                      onChange={(e) => setManufacturers(e.target.value)}
                      disabled={!!mfrItemNumbers.trim()}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      placeholder="e.g., Zebra, Honeywell"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categories (comma-separated)</label>
                    <input
                      type="text"
                      value={categories}
                      onChange={(e) => setCategories(e.target.value)}
                      disabled={!!mfrItemNumbers.trim()}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      placeholder="e.g., POS/Scanners, Mobility"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search Text</label>
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      disabled={!!mfrItemNumbers.trim()}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      placeholder="Keyword"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Pages (limit results)</label>
                    <input
                      type="number"
                      value={maxPages}
                      onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={1}
                      max={100}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRunImport}
                  disabled={loading || polling}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5" />
                  {loading ? 'Starting Import…' : polling ? 'Import Running…' : 'Run Import'}
                </button>

                <button
                  onClick={handleLoadStatus}
                  disabled={loading}
                  className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-5 h-5" />
                  Check Status
                </button>
              </div>

              {importStatus && (
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Import Status</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-600">{importStatus.scanned}</div>
                      <div className="text-sm text-blue-800">Scanned</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-600">{importStatus.added}</div>
                      <div className="text-sm text-green-800">Added</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-yellow-600">{importStatus.updated}</div>
                      <div className="text-sm text-yellow-800">Updated</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-gray-600">{importStatus.skipped}</div>
                      <div className="text-sm text-gray-800">Skipped</div>
                    </div>
                  </div>

                  {importStatus.startedAt && (
                    <div className="mt-4 text-sm text-gray-600">
                      <div>Started: {new Date(importStatus.startedAt).toLocaleString()}</div>
                      {importStatus.finishedAt && <div>Finished: {new Date(importStatus.finishedAt).toLocaleString()}</div>}
                    </div>
                  )}

                  {importStatus.errors?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold text-red-600 mb-2">Errors ({importStatus.errors.length})</h4>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                        {importStatus.errors.map((err, idx) => (
                          <div key={idx} className="text-sm text-red-700 mb-1">{err}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'staging' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Staging Items</h3>
                <button
                  onClick={handleLoadStaging}
                  disabled={loading}
                  className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-semibold disabled:bg-gray-400"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {stagingItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No staging items found. Run an import first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stagingItems.slice(0, 50).map((item) => {
                    const displayTitle = item.description || item.title || item.product_family_headline || item.item_number;
                    const availability =
                      typeof item.stock_available === 'number'
                        ? item.stock_available
                        : item.pricing_json?.AvailableQuantity ?? item.pricing_json?.availableQuantity ?? null;
                    const msrpValue = Number(
                      item.pricing_json?.msrp ?? item.pricing_json?.MSRP ?? item.pricing_json?.Msrp ?? NaN
                    );
                    return (
                      <div key={item.item_number} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex gap-4">
                          {item.item_image_url && (
                            <img src={item.item_image_url} alt={displayTitle} className="w-20 h-20 object-cover rounded" />
                          )}
                          <div className="flex-1 space-y-2">
                            <div>
                              <div className="font-semibold text-gray-800 text-lg">{displayTitle}</div>
                              <div className="text-sm text-gray-600">
                                Item: {item.item_number} | MFR: {item.mfr_item_number || '—'}
                              </div>
                              <div className="text-sm text-gray-600 flex flex-wrap gap-2">
                                <span>{item.manufacturer || 'Unknown manufacturer'}</span>
                                {item.product_family && <span>• {item.product_family}</span>}
                                {item.category_path && <span>• {item.category_path}</span>}
                              </div>
                              {item.item_description && (
                                <div className="text-sm text-gray-500 mt-1 line-clamp-3">
                                  {item.item_description}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">{item.item_status || 'Unknown'}</span>
                              {typeof availability === 'number' && (
                                <span className="px-2 py-1 rounded bg-green-100 text-green-700">Stock: {availability}</span>
                              )}
                              {item.business_unit && (
                                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">BU {item.business_unit}</span>
                              )}
                              {item.rebox_item && (
                                <span className="px-2 py-1 rounded bg-orange-100 text-orange-700">Rebox</span>
                              )}
                              {item.b_stock_item && (
                                <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700">B-Stock</span>
                              )}
                              {item.salesperson_intervention_required && (
                                <span className="px-2 py-1 rounded bg-purple-100 text-purple-700">Sales Review</span>
                              )}
                              {item.sell_via_edi === false && (
                                <span className="px-2 py-1 rounded bg-red-100 text-red-700">No EDI</span>
                              )}
                              {item.sell_via_edi === true && (
                                <span className="px-2 py-1 rounded bg-green-100 text-green-700">EDI Enabled</span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 sm:grid-cols-3">
                              {item.base_unit_of_measure && (
                                <div>
                                  <div className="font-semibold text-gray-700">Base UOM</div>
                                  <div>{item.base_unit_of_measure}</div>
                                </div>
                              )}
                              {item.minimum_order_quantity != null && (
                                <div>
                                  <div className="font-semibold text-gray-700">MOQ</div>
                                  <div>{item.minimum_order_quantity}</div>
                                </div>
                              )}
                              {item.gross_weight != null && (
                                <div>
                                  <div className="font-semibold text-gray-700">Gross Weight</div>
                                  <div>{item.gross_weight} lb</div>
                                </div>
                              )}
                              {(item.packaged_length || item.packaged_width || item.packaged_height) && (
                                <div>
                                  <div className="font-semibold text-gray-700">Dimensions (L×W×H)</div>
                                  <div>
                                    {[item.packaged_length, item.packaged_width, item.packaged_height]
                                      .map((v) => (v != null ? v : '—'))
                                      .join(' × ')}
                                  </div>
                                </div>
                              )}
                              {item.country_of_origin && (
                                <div>
                                  <div className="font-semibold text-gray-700">Origin</div>
                                  <div>{item.country_of_origin}</div>
                                </div>
                              )}
                              {item.unspsc && (
                                <div>
                                  <div className="font-semibold text-gray-700">UNSPSC</div>
                                  <div>{item.unspsc}</div>
                                </div>
                              )}
                              {item.serial_number_profile && (
                                <div>
                                  <div className="font-semibold text-gray-700">Serial Profile</div>
                                  <div>{item.serial_number_profile}</div>
                                </div>
                              )}
                              {item.rohs_compliance_indicator && (
                                <div>
                                  <div className="font-semibold text-gray-700">RoHS</div>
                                  <div>{item.rohs_compliance_indicator}</div>
                                </div>
                              )}
                              {item.battery_indicator && (
                                <div>
                                  <div className="font-semibold text-gray-700">Battery</div>
                                  <div>{item.battery_indicator}</div>
                                </div>
                              )}
                            </div>

                            <div className="text-xs text-gray-500 flex flex-wrap gap-4">
                              {item.catalog_name && <div>Catalog: {item.catalog_name}</div>}
                              {item.business_unit && <div>Business Unit: {item.business_unit}</div>}
                              {item.delivering_plant && <div>Plant: {item.delivering_plant}</div>}
                              {item.material_freight_group && <div>Freight: {item.material_freight_group}</div>}
                              {item.material_group && <div>Material Group: {item.material_group}</div>}
                              {item.material_type && <div>Material Type: {item.material_type}</div>}
                              {item.sell_via_web && <div>Sell via Web: {item.sell_via_web}</div>}
                              {item.plant_material_status_valid_from && (
                                <div>
                                  Status Effective: {new Date(item.plant_material_status_valid_from).toLocaleDateString()}
                                </div>
                              )}
                              {item.date_added && <div>Added: {new Date(item.date_added).toLocaleDateString()}</div>}
                            </div>

                            {item.product_media && item.product_media.length > 0 && (
                              <div className="text-xs text-blue-600">
                                Media assets: {item.product_media.length}
                              </div>
                            )}

                            {Number.isFinite(msrpValue) && (
                              <div className="text-sm font-semibold text-green-600">MSRP: ${msrpValue.toFixed(2)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {stagingItems.length > 50 && (
                    <div className="text-center text-gray-500 text-sm py-4">Showing first 50 of {stagingItems.length} items</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'diff' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">Review & Publish</h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllNew}
                    disabled={loading || !diff?.new.length}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold disabled:bg-gray-400"
                  >
                    Select All New
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={loading || selectedItems.size === 0}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400"
                  >
                    <Upload className="w-4 h-4" />
                    Publish Selected ({selectedItems.size})
                  </button>
                  <button
                    onClick={handleClearStaging}
                    disabled={loading}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold disabled:bg-gray-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All
                  </button>
                  <button
                    onClick={handleLoadDiff}
                    disabled={loading}
                    className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-semibold disabled:bg-gray-400"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700">Filters</h4>
                  <button onClick={clearFilters} className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1">
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={diffManufacturerFilter}
                    onChange={(e) => setDiffManufacturerFilter(e.target.value)}
                    placeholder="Filter by manufacturer..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <input
                    type="text"
                    value={diffCategoryFilter}
                    onChange={(e) => setDiffCategoryFilter(e.target.value)}
                    placeholder="Filter by category..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <input
                    type="text"
                    value={diffSearchFilter}
                    onChange={(e) => setDiffSearchFilter(e.target.value)}
                    placeholder="Search title or item number..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {diff && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">{diff.new.length}</div>
                    <div className="text-sm text-green-800">New Items</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-600">{diff.changed.length}</div>
                    <div className="text-sm text-yellow-800">Changed Items</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-2xl font-bold text-gray-600">{diff.unchanged.length}</div>
                    <div className="text-sm text-gray-800">Unchanged Items</div>
                  </div>
                </div>
              )}

              {diff && getFilteredNewItems().length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">
                    New Items (showing {getFilteredNewItems().length} of {diff.new.length})
                  </h4>
                  <div className="space-y-2">
                    {getFilteredNewItems().map((item) => (
                      <div key={item.item_number} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.item_number)}
                            onChange={() => toggleItemSelection(item.item_number)}
                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">{item.title}</div>
                            <div className="text-sm text-gray-600">Item: {item.item_number}</div>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              {typeof item.msrp === 'number' ? (
                                <div className="text-sm font-semibold text-green-600">MSRP: ${item.msrp.toFixed(2)}</div>
                              ) : (
                                <div className="text-sm text-red-600">No pricing data</div>
                              )}
                              {item.manufacturer && <div className="text-sm text-gray-500">{item.manufacturer}</div>}
                              <StockBadge qty={item.availability} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diff && getFilteredChangedItems().length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">
                    Changed Items (showing {getFilteredChangedItems().length} of {diff.changed.length})
                  </h4>
                  <div className="space-y-2">
                    {getFilteredChangedItems().map((item) => (
                      <div key={item.item_number} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.item_number)}
                            onChange={() => toggleItemSelection(item.item_number)}
                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">{item.title}</div>
                            <div className="text-sm text-gray-600">Item: {item.item_number}</div>
                            <div className="flex flex-wrap items-center gap-3 mt-1">
                              {typeof item.msrp === 'number' ? (
                                <div className="text-sm font-semibold text-green-700">MSRP: ${item.msrp.toFixed(2)}</div>
                              ) : (
                                <div className="text-sm text-red-700">No pricing data</div>
                              )}
                              <StockBadge qty={item.availability} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!diff && (
                <div className="text-center py-12 text-gray-500">
                  <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Click "Refresh" to compare staging items with published products</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
