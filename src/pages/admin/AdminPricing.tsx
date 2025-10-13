import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { supabase } from '../../lib/supabase';

type AdjustmentType = 'fixed' | 'percent';

interface PricingProduct {
  id: string;
  sku: string;
  title: string;
  manufacturer: string | null;
  msrp: number | null;
  map_price: number | null;
  reseller_price: number | null;
  sale_price: number | null;
  price_adjustment_type: AdjustmentType | null;
  price_adjustment_value: number | null;
  updated_at: string | null;
  published: boolean | null;
}

interface PricingFormState {
  resellerPrice: string;
  salePrice: string;
  adjustmentType: AdjustmentType;
  adjustmentValue: string;
}

const CARD_RATE = 0.029;
const CARD_FIXED_FEE = 0.3;

function safeParse(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatInputNumber(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
}

function computeSalePrice(reseller: number, type: AdjustmentType, adjustment: number): number {
  if (!Number.isFinite(reseller)) reseller = 0;
  if (!Number.isFinite(adjustment)) adjustment = 0;
  if (type === 'percent') {
    return reseller * (1 + adjustment / 100);
  }
  return reseller + adjustment;
}

function computeAdjustmentValue(sale: number, reseller: number, type: AdjustmentType): number {
  if (!Number.isFinite(sale)) sale = 0;
  if (!Number.isFinite(reseller)) reseller = 0;
  if (type === 'percent') {
    if (reseller === 0) return 0;
    return ((sale - reseller) / reseller) * 100;
  }
  return sale - reseller;
}

function formatAdjustment(value: number, type: AdjustmentType): string {
  if (!Number.isFinite(value)) return '0.00';
  return type === 'percent' ? value.toFixed(2) : value.toFixed(2);
}

export default function AdminPricing() {
  const [products, setProducts] = useState<PricingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PricingProduct | null>(null);
  const [formState, setFormState] = useState<PricingFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('products')
        .select(
          'id, sku, title, manufacturer, msrp, map_price, sale_price, reseller_price, price_adjustment_type, price_adjustment_value, updated_at, published'
        )
        .order('updated_at', { ascending: false })
        .limit(200);

      if (queryError) throw queryError;

      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load pricing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      return (
        product.title?.toLowerCase().includes(term) ||
        product.sku?.toLowerCase().includes(term)
      );
    });
  }, [products, search]);

  function initializeForm(product: PricingProduct): PricingFormState {
    const reseller = Number.isFinite(product.reseller_price ?? undefined)
      ? Number(product.reseller_price)
      : Number(product.map_price ?? 0);
    const sale = Number.isFinite(product.sale_price ?? undefined)
      ? Number(product.sale_price)
      : Number(product.map_price ?? 0);
    const type: AdjustmentType = product.price_adjustment_type === 'percent' ? 'percent' : 'fixed';
    const adjustment = Number.isFinite(product.price_adjustment_value ?? undefined)
      ? Number(product.price_adjustment_value)
      : computeAdjustmentValue(sale, reseller, type);

    return {
      resellerPrice: formatInputNumber(reseller),
      salePrice: formatInputNumber(sale),
      adjustmentType: type,
      adjustmentValue: formatAdjustment(adjustment, type),
    };
  }

  function handleSelectProduct(product: PricingProduct) {
    setSelectedProduct(product);
    setFormState(initializeForm(product));
    setSuccessMessage('');
    setError('');
  }

  function handleAdjustmentTypeChange(type: AdjustmentType) {
    if (!formState) return;
    const reseller = safeParse(formState.resellerPrice);
    const sale = safeParse(formState.salePrice);
    const adjustment = computeAdjustmentValue(sale, reseller, type);
    setFormState({
      ...formState,
      adjustmentType: type,
      adjustmentValue: formatAdjustment(adjustment, type),
    });
  }

  function handleResellerPriceChange(value: string) {
    if (!formState) return;
    const reseller = safeParse(value);
    const sale = safeParse(formState.salePrice);
    const adjustment = computeAdjustmentValue(sale, reseller, formState.adjustmentType);
    setFormState({
      ...formState,
      resellerPrice: value,
      adjustmentValue: formatAdjustment(adjustment, formState.adjustmentType),
    });
  }

  function handleAdjustmentValueChange(value: string) {
    if (!formState) return;
    const adjustment = Number(value);
    const reseller = safeParse(formState.resellerPrice);
    const sale = computeSalePrice(reseller, formState.adjustmentType, adjustment);
    setFormState({
      ...formState,
      adjustmentValue: value,
      salePrice: formatInputNumber(sale),
    });
  }

  function handleSalePriceChange(value: string) {
    if (!formState) return;
    const sale = safeParse(value);
    const reseller = safeParse(formState.resellerPrice);
    const adjustment = computeAdjustmentValue(sale, reseller, formState.adjustmentType);
    setFormState({
      ...formState,
      salePrice: value,
      adjustmentValue: formatAdjustment(adjustment, formState.adjustmentType),
    });
  }

  async function handleSave() {
    if (!selectedProduct || !formState) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');

    const resellerPrice = safeParse(formState.resellerPrice);
    const salePrice = safeParse(formState.salePrice);
    const adjustmentValue = Number(formState.adjustmentValue);

    if (salePrice < resellerPrice) {
      const confirmBelowCost = window.confirm(
        'The customer sale price is below your reseller price. Are you sure you want to continue?'
      );
      if (!confirmBelowCost) {
        setSaving(false);
        return;
      }
    }

    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          reseller_price: resellerPrice,
          sale_price: salePrice,
          map_price: salePrice,
          price_adjustment_type: formState.adjustmentType,
          price_adjustment_value: adjustmentValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedProduct.id);

      if (updateError) throw updateError;

      setProducts((current) =>
        current.map((product) =>
          product.id === selectedProduct.id
            ? {
                ...product,
                reseller_price: resellerPrice,
                sale_price: salePrice,
                map_price: salePrice,
                price_adjustment_type: formState.adjustmentType,
                price_adjustment_value: adjustmentValue,
                updated_at: new Date().toISOString(),
              }
            : product
        )
      );

      setSelectedProduct((current) =>
        current
          ? {
              ...current,
              reseller_price: resellerPrice,
              sale_price: salePrice,
              map_price: salePrice,
              price_adjustment_type: formState.adjustmentType,
              price_adjustment_value: adjustmentValue,
              updated_at: new Date().toISOString(),
            }
          : current
      );

      setFormState((current) =>
        current
          ? {
              ...current,
              resellerPrice: formatInputNumber(resellerPrice),
              salePrice: formatInputNumber(salePrice),
              adjustmentValue: formatAdjustment(adjustmentValue, current.adjustmentType),
            }
          : current
      );

      setSuccessMessage('Pricing updated successfully.');
    } catch (err) {
      console.error('Failed to save pricing:', err);
      setError(err instanceof Error ? err.message : 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  }

  const pricingSummary = useMemo(() => {
    if (!formState) {
      return {
        reseller: 0,
        sale: 0,
        markup: 0,
        fees: 0,
        profit: 0,
      };
    }

    const reseller = safeParse(formState.resellerPrice);
    const sale = safeParse(formState.salePrice);
    const markup = sale - reseller;
    const fees = sale > 0 ? sale * CARD_RATE + CARD_FIXED_FEE : 0;
    const profit = sale - reseller - fees;

    return { reseller, sale, markup, fees, profit };
  }, [formState]);

  function getManufacturerName(product: PricingProduct): string {
    if (product.manufacturer && product.manufacturer.trim()) {
      return product.manufacturer;
    }
    return 'Unknown';
  }

  function escapeCell(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildExcelRow(columns: string[]): string {
    return `<tr>${columns.map((column) => `<td>${column}</td>`).join('')}</tr>`;
  }

  function buildExcelHeader(columns: string[]): string {
    return `<tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>`;
  }

  function formatCurrencyCell(value: number): string {
    return escapeCell(formatCurrency(value));
  }

  function handleExportPricing() {
    if (filteredProducts.length === 0) {
      return;
    }

    setExporting(true);

    try {
      const header = [
        'SKU',
        'Item Name',
        'Manufacturer',
        'Reseller Price',
        'Customer Sale Price',
        'Markup / Loss',
        'Card Processing Fee',
        'Projected Profit / Loss',
      ];

      const rows = filteredProducts.map((product) => {
        const reseller = Number(product.reseller_price ?? product.map_price ?? 0);
        const sale = Number(product.sale_price ?? product.map_price ?? 0);
        const markup = sale - reseller;
        const fees = sale > 0 ? sale * CARD_RATE + CARD_FIXED_FEE : 0;
        const profit = sale - reseller - fees;

        return buildExcelRow([
          escapeCell(product.sku || ''),
          escapeCell(product.title || ''),
          escapeCell(getManufacturerName(product)),
          formatCurrencyCell(reseller),
          formatCurrencyCell(sale),
          formatCurrencyCell(markup),
          formatCurrencyCell(fees),
          formatCurrencyCell(profit),
        ]);
      });

      const table = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><table>${buildExcelHeader(
        header.map((column) => escapeCell(column))
      )}${rows.join('')}</table></body></html>`;

      const blob = new Blob([`\ufeff${table}`], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `pricing-export-${timestamp}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <BadgeDollarSign className="w-8 h-8 text-blue-600" />
              Product Pricing
            </h1>
            <p className="text-gray-600 mt-1">
              Manage customer sale pricing, markups, and profitability safeguards.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportPricing}
              disabled={exporting || filteredProducts.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-blue-600" />
                  Export Pricing
                </>
              )}
            </button>
            <button
              type="button"
              onClick={loadProducts}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by SKU or title"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Products</h2>
                <span className="text-sm text-gray-500">{filteredProducts.length} items</span>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center gap-3 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Loading pricing data...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-12 text-center text-gray-500">No products found.</div>
              ) : (
                <div className="max-h-[28rem] overflow-y-auto divide-y divide-gray-100">
                  {filteredProducts.map((product) => {
                    const reseller = Number(product.reseller_price ?? product.map_price ?? 0);
                    const sale = Number(product.sale_price ?? product.map_price ?? 0);
                    const belowCost = sale < reseller;
                    const markup = sale - reseller;

                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className={`w-full text-left px-4 py-3 transition ${
                          selectedProduct?.id === product.id
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-gray-800 line-clamp-2">{product.title}</div>
                            <div className="text-xs text-gray-500 mt-1">SKU: {product.sku}</div>
                            {!product.published && (
                              <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded">
                                Unpublished
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Customer Price</div>
                            <div className="font-semibold text-gray-800">{formatCurrency(sale)}</div>
                            <div className="text-xs mt-1">
                              <span className="text-gray-500 mr-1">Margin:</span>
                              <span className={belowCost ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                {formatCurrency(markup)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              {!selectedProduct || !formState ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                    <BadgeDollarSign className="w-8 h-8 text-blue-500" />
                  </div>
                  <p>Select a product to configure pricing.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{selectedProduct.title}</h2>
                    <div className="text-sm text-gray-500 mt-1">SKU: {selectedProduct.sku}</div>
                    {selectedProduct.msrp && selectedProduct.msrp > 0 && (
                      <div className="text-sm text-gray-500 mt-2">
                        MSRP: {formatCurrency(Number(selectedProduct.msrp))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 border border-red-200 bg-red-50 text-red-700 rounded-lg">
                      <AlertTriangle className="w-4 h-4 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="flex items-start gap-2 p-3 border border-green-200 bg-green-50 text-green-700 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 mt-0.5" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reseller Price (Cost)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formState.resellerPrice}
                        onChange={(event) => handleResellerPriceChange(event.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Adjustment Type
                      </label>
                      <select
                        value={formState.adjustmentType}
                        onChange={(event) => handleAdjustmentTypeChange(event.target.value as AdjustmentType)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="fixed">Fixed Dollar Amount</option>
                        <option value="percent">Percentage Markup</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Adjustment Value
                        <span className="ml-2 text-xs text-gray-500">
                          {formState.adjustmentType === 'percent' ? '% over cost' : 'USD added to cost'}
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formState.adjustmentValue}
                        onChange={(event) => handleAdjustmentValueChange(event.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Customer Sale Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formState.salePrice}
                        onChange={(event) => handleSalePriceChange(event.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Profit & Fee Projection</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reseller Price</span>
                        <span className="font-semibold text-gray-800">{formatCurrency(pricingSummary.reseller)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Customer Price</span>
                        <span className="font-semibold text-gray-800">{formatCurrency(pricingSummary.sale)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Markup / Loss</span>
                        <span
                          className={`font-semibold ${
                            pricingSummary.markup >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(pricingSummary.markup)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Card Processing Fees</span>
                        <span className="font-semibold text-gray-800">{formatCurrency(pricingSummary.fees)}</span>
                      </div>
                      <div className="flex justify-between md:col-span-2">
                        <span className="text-gray-600">Projected Profit / Loss</span>
                        <span
                          className={`font-semibold ${
                            pricingSummary.profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(pricingSummary.profit)}
                        </span>
                      </div>
                    </div>
                    {pricingSummary.sale < pricingSummary.reseller && (
                      <div className="mt-3 text-sm text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Sale price is below reseller cost. Confirmation required to save.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Pricing'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedProduct) {
                          setFormState(initializeForm(selectedProduct));
                          setSuccessMessage('');
                          setError('');
                        }
                      }}
                      className="px-6 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
