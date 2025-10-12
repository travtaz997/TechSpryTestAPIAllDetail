// index.ts — ScanSource pricing/search test (Edge/Deno)
// - Robust env + query parsing (arrays for BU/WH)
// - Resolve input → ScanSource item (detail ptype 1→2→3)
// - Pricing body: BusinessUnit + Warehouse + Lines[] (+ optional Deal IDs)
// - Accept only real prices (UnitPrice > 0 && !PricingError)
// - Verbose diagnostics

// CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---- Helpers: list parsing ----
function toList(x: unknown): string[] {
  if (Array.isArray(x)) {
    return x.flatMap(v => String(v).split(",")).map(s => s.trim()).filter(Boolean);
  }
  if (x == null) return [];
  return String(x).split(",").map(s => s.trim()).filter(Boolean);
}
function parseListEnv(name: string, fallback: string[]): string[] {
  const raw = Deno.env.get(name);
  if (!raw) return [...fallback];
  try {
    const parsed = JSON.parse(raw);                 // supports JSON array or scalar
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return toList(arr);
  } catch {
    return toList(raw);                             // supports "1700,1750" or "1700"
  }
}

// ---- Env ----
const env = {
  base: Deno.env.get("SCANSOURCE_BASE") || "",      // e.g. https://api.scansource.com
  apiKey: Deno.env.get("SCANSOURCE_API_KEY") || "",
  tokenUrl: Deno.env.get("OAUTH_TOKEN_URL") || "",
  clientId: Deno.env.get("OAUTH_CLIENT_ID") || "",
  clientSecret: Deno.env.get("OAUTH_CLIENT_SECRET") || "",
  scope: Deno.env.get("OAUTH_SCOPE") || "",
  customerNumber: Deno.env.get("CUSTOMER_NUMBER") || "",
  businessUnits: parseListEnv("BUSINESS_UNITS", ["1700"]),
  warehouses: parseListEnv("WAREHOUSES", ["1710"]),
  //defaultDealId: Deno.env.get("DEFAULT_DEAL_ID") || "",
  pageSize: parseInt(Deno.env.get("DEFAULT_PAGE_SIZE") || "50", 10),
  maxBatch: parseInt(Deno.env.get("MAX_BATCH") || "40", 10),
};

// ---- OAuth ----
let tokenCache: { token: string; expMs: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expMs > Date.now() + 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.clientId,
    client_secret: env.clientSecret,
    scope: env.scope,
  });
  const r = await fetch(env.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`OAuth ${r.status}: ${JSON.stringify(j)}`);
  tokenCache = { token: j.access_token, expMs: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

// ---- API caller ----
async function callApi(pathWithQuery: string, init?: RequestInit): Promise<any> {
  const token = await getToken();
  const url = `${env.base}/scsc/product/v2${pathWithQuery}`;
  let attempt = 0;
  while (true) {
    const r = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": env.apiKey,
        ...(init?.headers || {}),
      },
    });
    const text = await r.text();
    if (r.ok) { try { return JSON.parse(text); } catch { return text; } }
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      attempt++;
      await new Promise(res => setTimeout(res, 500 * 2 ** attempt + Math.floor(Math.random() * 250)));
      continue;
    }
    throw new Error(`API ${r.status} ${url}: ${text.slice(0, 800)}`);
  }
}

// ---- Normalizers ----
function normalizeSearch(resp: unknown): any[] {
  if (Array.isArray(resp)) return resp;
  const x = resp as any;
  if (Array.isArray(x?.items)) return x.items;
  return [];
}
function normalizePricing(resp: unknown): any[] {
  if (!resp) return [];
  if (Array.isArray(resp)) {
    if (resp.length && (resp[0] as any)?.Lines) return (resp as any[]).flatMap((r: any) => r.Lines || []);
    return resp;
  }
  const x = resp as any;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.Lines)) return x.Lines;
  return [];
}

// ---- Product endpoints ----
async function searchPage(params: Record<string, string>): Promise<any[]> {
  const qs = new URLSearchParams({
    customerNumber: env.customerNumber,
    includeObsolete: "false",
    pageSize: String(env.pageSize),
    page: params.page || "1",
  });
  if (params.searchText) qs.set("searchText", params.searchText);
  if (params.manufacturer) qs.set("manufacturer", params.manufacturer);
  if (params.categoryPath) qs.set("categoryPath", params.categoryPath);
  const data = await callApi(`/search?${qs.toString()}`, { method: "GET" });
  const items = normalizeSearch(data);
  console.log(`[search] page=${qs.get("page")} items=${items.length}`);
  return items;
}

async function getDetail(itemNumber: string, partNumberType: 1 | 2 | 3): Promise<any> {
  const qs = new URLSearchParams({
    customerNumber: env.customerNumber,
    itemNumber,
    partNumberType: String(partNumberType),
  });
  const data = await callApi(`/detail?${qs.toString()}`, { method: "GET" });
  console.log(`[detail] ptype=${partNumberType} item=${itemNumber} ok=${!!data}`);
  return data;
}

// Resolve input → ScanSource item (ptype 1 → 2 → 3)
async function resolveToScanSourceItem(input: string): Promise<{ ssItem: string; via: 1 | 2 | 3; detail: any }> {
  for (const p of [1, 2, 3] as const) {
    try {
      const d = await getDetail(input, p);
      const ss = d?.ScanSourceItemNumber ?? d?.ItemNumber ?? d?.itemNumber;
      if (ss) return { ssItem: ss, via: p, detail: d };
    } catch { /* next */ }
  }
  throw new Error(`Resolve failed: ${input}`);
}

function parseMOQ(d: any): number | undefined {
  const raw = d?.MinimumOrderQuantity ?? d?.minimumOrderQuantity ?? d?.MOQ ?? d?.moq;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Build Line candidates (SS → SAP → MFR), optional per-line DealIDs
function buildLines(ids: { ss?: string; mfr?: string; sap?: string }, qty: number, dealId?: string) {
  const mk = (ItemNumber: string, PartNumberType: 1 | 2 | 3) => {
    const line: any = { ItemNumber, PartNumberType, Quantity: qty };
    if (dealId) line.DealIDs = [dealId];
    return line;
  };
  const out: any[] = [];
  if (ids.ss)  out.push(mk(ids.ss, 1));
  if (ids.sap) out.push(mk(ids.sap, 3));
  if (ids.mfr) out.push(mk(ids.mfr, 2));
  return out;
}

function validPriceRow(r: any): boolean {
  const v = Number(r?.UnitPrice ?? r?.NetPrice ?? r?.CustomerPrice ?? r?.Price);
  return Number.isFinite(v) && v > 0 && r?.PricingError !== true;
}

// Try contexts in order: BU+WH → BU → WH → NONE. Add top-level DealID if provided.
async function priceWithContexts(lines: any[], opts: { buList: string[]; whList: string[]; dealId?: string }) {
  const qs = new URLSearchParams({ customerNumber: env.customerNumber });
  const attempts: Array<{ tag: string; body: Record<string, unknown> }> = [];

  const addAttempt = (tag: string, body: any) => {
    if (opts.dealId) body.DealID1 = opts.dealId;
    attempts.push({ tag, body });
  };

  for (const bu of opts.buList) for (const wh of opts.whList)
    addAttempt(`BU:${bu}+WH:${wh}`, { CustomerNumber: env.customerNumber, BusinessUnit: bu, Warehouse: wh, Lines: lines });
  for (const bu of opts.buList)
    addAttempt(`BU:${bu}`, { CustomerNumber: env.customerNumber, BusinessUnit: bu, Lines: lines });
  for (const wh of opts.whList)
    addAttempt(`WH:${wh}`, { CustomerNumber: env.customerNumber, Warehouse: wh, Lines: lines });
  addAttempt(`NONE`, { CustomerNumber: env.customerNumber, Lines: lines });

  for (const a of attempts) {
    console.log(`[pricing] attempt=${a.tag} lines=${lines.length}`);
    const data = await callApi(`/pricing?${qs.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(a.body),
    });
    const rows = normalizePricing(data);
    const anyValid = rows.some(validPriceRow);
    console.log(`[pricing] attempt=${a.tag} rows=${rows.length} valid=${anyValid}`);
    rows.slice(0, 5).forEach((r: any) => {
      const unit = r.UnitPrice ?? r.NetPrice ?? r.CustomerPrice ?? r.Price ?? null;
      console.log(anyValid
        ? `[pricing] candidate sku=${r.ItemNumber || r.MaterialNumber} unit=${unit}`
        : `[pricing] no-price sku=${r.ItemNumber || r.MaterialNumber} unit=${unit} auth=${r.DealerAuthorized} err=${r.PricingError} msg=${r.PricingErrorDesc ?? r.ErrorMessage ?? "none"}`);
    });
    if (anyValid) return { tag: a.tag, rows };
  }
  return { tag: "none", rows: [] };
}

// ---- Server ----
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const url = new URL(req.url);

    // Inputs + overrides
    const manufacturer = url.searchParams.get("manufacturer") || undefined;
    const categoryPath = url.searchParams.get("categoryPath") || undefined;
    const searchText = url.searchParams.get("searchText") || undefined;
    const pages = Math.max(1, parseInt(url.searchParams.get("pages") || "1", 10));
    const sku = url.searchParams.get("sku") || undefined;
    const qtyParam = Math.max(1, parseInt(url.searchParams.get("qty") || "1", 10));

    const buParam = url.searchParams.getAll("bu");     // ?bu=1700&bu=1750 or ?bu=1700,1750
    const whParam = url.searchParams.getAll("wh");     // ?wh=1710&wh=1720 or ?wh=1710,1720
    const dealOverride = url.searchParams.get("deal") || undefined;

    const buList = buParam.length ? toList(buParam) : env.businessUnits;
    const whList = whParam.length ? toList(whParam) : env.warehouses;
    const dealId = dealOverride || env.defaultDealId || undefined;

    console.log(`=== Env === base=${env.base} cust=${env.customerNumber} BU=${buList.join(",")} WH=${whList.join(",")} deal=${dealId ?? "none"}`);

    // Build candidate inputs
    let inputs: string[] = [];
    if (sku) {
      inputs = [sku];
      console.log(`[input] sku=${sku} qty=${qtyParam}`);
    } else {
      let page = 1;
      const found: any[] = [];
      while (page <= pages) {
        const items = await searchPage({ page: String(page), manufacturer, categoryPath, searchText });
        found.push(...items);
        if (items.length < env.pageSize) break;
        page++;
      }
      inputs = found.map((it: any) => it.ScanSourceItemNumber || it.itemNumber).filter(Boolean).slice(0, 3 * env.maxBatch);
      console.log(`[search] totalFound=${found.length} inputs=${inputs.length}`);
    }

    // Resolve + price per input
    const results: any[] = [];
    let lastAttempt = "none";

    for (const inp of inputs) {
      const r = await resolveToScanSourceItem(inp).catch(e => ({ error: String(e) }));
      if ((r as any).error) {
        console.log(`[resolve] failed for ${inp}: ${(r as any).error}`);
        results.push({ input: inp, error: (r as any).error });
        continue;
      }
      const { ssItem, via, detail } = r as any;

      // qty: use MOQ if single-SKU test
      let qty = qtyParam;
      const moq = sku ? parseMOQ(detail) : undefined;
      if (sku && moq && moq > qty) { qty = moq; console.log(`[qty] using MOQ=${moq} for ${ssItem}`); }

      // Build lines from detail identifiers
      const lines = buildLines(
        {
          ss:  detail?.ScanSourceItemNumber ?? detail?.ItemNumber ?? detail?.itemNumber,
          mfr: detail?.ManufacturerItemNumber,
          sap: detail?.SAPMaterialNumber,
        },
        qty,
        dealId
      );

      // Price with contexts
      const priced = await priceWithContexts(lines, { buList, whList, dealId });
      if (priced.tag !== "none") lastAttempt = priced.tag;

      // Pick best row
      let priceRow: any = null;
      for (const row of priced.rows) {
        const id = row.ItemNumber || row.MaterialNumber;
        if (id === ssItem && validPriceRow(row)) { priceRow = row; break; }
      }
      if (!priceRow) priceRow = priced.rows.find(validPriceRow) || priced.rows[0] || null;

      const unit = priceRow ? (priceRow.UnitPrice ?? priceRow.NetPrice ?? priceRow.CustomerPrice ?? priceRow.Price ?? null) : null;
      const msrp = priceRow ? (priceRow.MSRP ?? priceRow.ListPrice ?? null) : null;

      if (!unit || unit <= 0 || priceRow?.PricingError) {
        console.log(`[pricing] MISSING/ERR sku=${ssItem} attempt=${priced.tag} unit=${unit} auth=${priceRow?.DealerAuthorized} err=${priceRow?.PricingError} msg=${priceRow?.PricingErrorDesc ?? priceRow?.ErrorMessage ?? "none"}`);
      } else {
        console.log(`[pricing] OK sku=${ssItem} UnitPrice=${unit} MSRP=${msrp} attempt=${priced.tag}`);
      }

      results.push({
        input: inp,
        skuResolved: ssItem,
        resolvedViaPartType: via,
        moq: moq ?? null,
        detail,
        pricing: priceRow
          ? {
              UnitPrice: unit,
              MSRP: msrp,
              Currency: priceRow.Currency ?? priceRow.UnitPriceCurrencyCode ?? null,
              DealerAuthorized: priceRow.DealerAuthorized ?? null,
              PricingError: priceRow.PricingError ?? null,
              PricingErrorDesc: priceRow.PricingErrorDesc ?? priceRow.ErrorMessage ?? null,
              Raw: priceRow,
            }
          : null,
      });
    }

    return new Response(JSON.stringify({
      meta: {
        customerNumber: env.customerNumber,
        base: env.base,
        businessUnitsTried: buList,
        warehousesTried: whList,
        dealUsed: dealId ?? null,
        pricingAttempt: lastAttempt,
        hint: "Override with ?sku=AXC-01490001&bu=1700&wh=1710&deal=123456789",
      },
      result: results,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
