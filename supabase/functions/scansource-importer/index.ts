// functions/scansource-importer/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// --- ENV + robust WAREHOUSES normalization ---
const env = {
  base: Deno.env.get("SCANSOURCE_BASE") || "",
  apiKey: Deno.env.get("SCANSOURCE_API_KEY") || "",
  tokenUrl: Deno.env.get("OAUTH_TOKEN_URL") || "",
  clientId: Deno.env.get("OAUTH_CLIENT_ID") || "",
  clientSecret: Deno.env.get("OAUTH_CLIENT_SECRET") || "",
  scope: Deno.env.get("OAUTH_SCOPE") || "",
  customerNumber: Deno.env.get("CUSTOMER_NUMBER") || "",
  businessUnit: Deno.env.get("BUSINESS_UNIT") || "1700",
  warehouses: (() => {
    const raw = Deno.env.get("WAREHOUSES");
    if (raw == null || raw === "") return ["1710"];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
      if (typeof parsed === "string") {
        if (parsed.includes(",")) return parsed.split(",").map((v) => v.trim()).filter(Boolean);
        return [parsed.trim()];
      }
      if (typeof parsed === "number") return [String(parsed)];
      return ["1710"];
    } catch {
      if (raw.includes(",")) return raw.split(",").map((v) => v.trim()).filter(Boolean);
      return [raw.trim()];
    }
  })(),
  pageSize: parseInt(Deno.env.get("DEFAULT_PAGE_SIZE") || "50"),
  maxBatch: parseInt(Deno.env.get("MAX_BATCH") || "40"),
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
};

const mockMode = !env.apiKey || !env.clientId;
let tokenCache: { token: string; expires: number } | null = null;

// --- Schemas ---
const runSchema = z.object({
  manufacturers: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  searchText: z.string().optional(),
  maxPages: z.number().optional(),
  mfrItemNumbers: z.array(z.string()).optional(),
});

const publishSchema = z.object({
  item_numbers: z.array(z.string()),
  mapping: z.object({ fields_to_copy: z.array(z.string()).optional() }).optional(),
  upsert: z.boolean().optional(),
});

const unpublishSchema = z.object({
  product_ids: z.array(z.string()),
});

// --- Auth ---
async function checkAuth(req: Request): Promise<{ authorized: boolean; userId?: string; isAdmin?: boolean }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { authorized: false };

  const token = authHeader.replace("Bearer ", "");
  const anon = createClient(env.supabaseUrl, env.supabaseAnonKey);
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return { authorized: false };

  const svc = createClient(env.supabaseUrl, env.supabaseKey);
  const { data: profile } = await svc.from("users").select("role").eq("auth_user_id", user.id).maybeSingle();

  const isAdmin = profile?.role === "admin";
  return { authorized: isAdmin, userId: user.id, isAdmin };
}

// --- Utils ---
function normalize(s: string): string {
  return (s || "").toLowerCase().trim();
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, "\\$&");
}

function normalizePartKey(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readField(source: any, key: string): any {
  if (!source || typeof source !== "object") return undefined;
  if (key in source) return source[key];

  const lowerCamel = key.charAt(0).toLowerCase() + key.slice(1);
  if (lowerCamel in source) return source[lowerCamel];

  const snake = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
  if (snake in source) return source[snake];

  return undefined;
}

function pickField(detail: any, summary: any, key: string): any {
  const detailValue = readField(detail, key);
  if (detailValue !== undefined && detailValue !== null) return detailValue;
  return readField(summary, key);
}

function toBoolean(value: any): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["y", "yes", "true", "1"].includes(normalized)) return true;
    if (["n", "no", "false", "0"].includes(normalized)) return false;
  }
  return null;
}

function toNumber(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toInteger(value: any): number | null {
  const intVal = Number.parseInt(value, 10);
  return Number.isFinite(intVal) ? intVal : null;
}

function toTimestamp(value: any): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pickDescription(summary: any, detail: any): string | null {
  const nameCandidates: Array<unknown> = [
    detail?.ItemName,
    detail?.itemName,
    detail?.Name,
    detail?.name,
    detail?.ProductName,
    detail?.productName,
    summary?.ItemName,
    summary?.itemName,
    summary?.Name,
    summary?.name,
    summary?.ProductName,
    summary?.productName,
  ];

  for (const candidate of nameCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const candidates: Array<unknown> = [
    detail?.LongDescription,
    detail?.longDescription,
    detail?.Description,
    detail?.description,
    detail?.MarketingDescription,
    detail?.marketingDescription,
    detail?.ProductDescription,
    detail?.productDescription,
    summary?.LongDescription,
    summary?.longDescription,
    summary?.Description,
    summary?.description,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const attributeSources = [
    detail?.ItemAttributes,
    detail?.itemAttributes,
    detail?.Attributes,
    detail?.attributes,
  ].filter(Boolean);

  for (const source of attributeSources) {
    const entries = Array.isArray(source) ? source : [source];
    for (const entry of entries) {
      const attrDesc = entry?.Description || entry?.description;
      if (typeof attrDesc === "string" && attrDesc.trim()) {
        return attrDesc.trim();
      }
    }
  }

  return null;
}
function normalizePricing(resp: unknown): any[] {
  if (!resp) return [];
  if (Array.isArray(resp)) {
    if (resp.length && (resp[0] as any)?.Lines) return (resp as any[]).flatMap((r: any) => r.Lines || []);
    return resp;
  }
  const anyResp = resp as any;
  if (Array.isArray(anyResp?.items)) return anyResp.items;
  if (Array.isArray(anyResp?.Lines)) return anyResp.Lines;
  return [];
}
function validPriceRow(r: any): boolean {
  const v = Number(r?.UnitPrice ?? r?.NetPrice ?? r?.CustomerPrice ?? r?.Price);
  return Number.isFinite(v) && v > 0 && r?.PricingError !== true;
}

// --- Availability extractor (handles row OBJECTS or ARRAYS) ---
function extractAvailability(input: any): number | null {
  if (!input) return null;

  const fromObj = (obj: any) => {
    let sum = 0;
    let hit = false;
    const fields = ["AvailableQty", "AvailableQuantity", "QtyAvailable", "QuantityAvailable", "Available", "Qty", "Quantity"];
    for (const f of fields) {
      const v = Number(obj?.[f]);
      if (Number.isFinite(v)) { sum += v; hit = true; }
    }
    const nests = (obj?.Warehouses || obj?.warehouses || obj?.Availability || obj?.availability || []) as any[];
    if (Array.isArray(nests)) {
      for (const w of nests) {
        for (const f of fields) {
          const v = Number(w?.[f]);
          if (Number.isFinite(v)) { sum += v; hit = true; }
        }
      }
    }
    return hit ? sum : null;
  };

  if (typeof input === "object" && !Array.isArray(input) && !input.items && !input.Lines) {
    return fromObj(input);
  }

  const rows = normalizePricing(input);
  if (!rows.length) return null;
  let total = 0;
  let found = false;
  for (const r of rows) {
    const v = fromObj(r);
    if (v != null) { total += v; found = true; }
  }
  return found ? total : null;
}

// --- OAuth ---
async function getToken(): Promise<string> {
  if (mockMode) return "mock-token";
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.clientId,
    client_secret: env.clientSecret,
    scope: env.scope,
  });

  const res = await fetch(env.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

// --- ScanSource HTTP ---
async function callApi(path: string, options: any = {}) {
  if (mockMode) return getMockData(path);

  const token = await getToken();
  const url = `${env.base}/scsc/product/v2${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Ocp-Apim-Subscription-Key": env.apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.substring(0, 200)}`);
  }

  const text = await res.text();
  if (!text || text.trim() === "") return {};
  try { return JSON.parse(text); } catch { throw new Error(`JSON parse error: ${text.substring(0, 200)}`); }
}

function getMockData(path: string): any {
  if (path.includes("/search")) {
    return {
      items: [{
        itemNumber: "MOCK001",
        manufacturerItemNumber: "MFR001",
        manufacturer: "MockCorp",
        description: "Mock Product 1",
        catalogName: "Main Catalog",
        categoryPath: "Electronics/Monitors",
        productFamily: "Display",
        productFamilyDescription: "LED Displays",
        itemStatus: "Active",
        itemImage: "https://images.pexels.com/photos/356056/pexels-photo-356056.jpeg?w=200",
        productFamilyImage: "https://images.pexels.com/photos/356056/pexels-photo-356056.jpeg?w=200",
      }],
      totalRecords: 1,
    };
  }
  if (path.includes("/detail")) {
    return {
      itemNumber: "MOCK001",
      description: "Mock Product 1",
      UPC: "123456789012",
      GrossWeight: "2.5",
      PackagedLength: "10",
      PackagedWidth: "8",
      PackagedHeight: "6",
      CountryofOrigin: "CN",
    };
  }
  if (path.includes("/pricing")) {
    return { items: [{ itemNumber: "MOCK001", MSRP: 299.99, UnitPrice: 249.99, AvailableQty: 1500 }] };
  }
  return { items: [] };
}

// --- Pricing ---
async function getPricingForBatch(itemNumbers: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  if (itemNumbers.length === 0) return result;

  const qs = new URLSearchParams({ customerNumber: env.customerNumber });
  const baseBody = {
    CustomerNumber: env.customerNumber,
    Lines: itemNumbers.map((n) => ({ ItemNumber: n, PartNumberType: 1, Quantity: 1 })),
  };

  const safeWarehouses = Array.isArray(env.warehouses) ? env.warehouses : [String(env.warehouses || "1710")];
  const attempts: Array<{ tag: string; body: Record<string, unknown> }> = [];

  for (const bu of [env.businessUnit]) {
    for (const wh of safeWarehouses) attempts.push({ tag: `BU:${bu}+WH:${wh}`, body: { ...baseBody, BusinessUnit: bu, Warehouse: wh } });
  }
  for (const bu of [env.businessUnit]) attempts.push({ tag: `BU:${bu}`, body: { ...baseBody, BusinessUnit: bu } });
  for (const wh of safeWarehouses) attempts.push({ tag: `WH:${wh}`, body: { ...baseBody, Warehouse: wh } });
  attempts.push({ tag: "NONE", body: baseBody });

  for (const a of attempts) {
    try {
      const token = await getToken();
      const url = `${env.base}/scsc/product/v2/pricing?${qs.toString()}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": env.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(a.body),
      });
      if (!res.ok) continue;

      const text = await res.text();
      if (!text || text.trim() === "") continue;

      const data = JSON.parse(text);
      const rows = normalizePricing(data);
      const anyValid = rows.some(validPriceRow);

      if (anyValid) {
        for (const row of rows) {
          const k = row.ItemNumber || row.itemNumber || row.MaterialNumber;
          if (!k) continue;
          if (validPriceRow(row)) {
            const { DealInfos, dealInfos, ...rest } = row;
            result.set(k, rest); // keep raw row so availability can be derived
          }
        }
        return result;
      }
    } catch (err: any) {
      console.error(`[pricing] attempt ${a.tag} exception:`, err.message);
    }
  }
  return result;
}

// --- Import run ---
async function handleImportRun(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const input = runSchema.parse(body);

    const svc = createClient(env.supabaseUrl, env.supabaseKey);
    const { data: job } = await svc.from("import_jobs").insert({ status: "pending", config: input, created_by: auth.userId }).select("id").single();
    if (!job) throw new Error("Failed to create job");

    processImportJob(job.id, input).catch(console.error);
    return new Response(JSON.stringify({ jobId: job.id, status: "started" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

async function processImportJob(jobId: string, config: any) {
  const svc = createClient(env.supabaseUrl, env.supabaseKey);
  try {
    await svc.from("import_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", jobId);

    const progress: { scanned: number; added: number; updated: number; skipped: number; errors: string[] } =
      { scanned: 0, added: 0, updated: 0, skipped: 0, errors: [] };

    const directItemInputs = Array.isArray(config.mfrItemNumbers)
      ? Array.from(new Set(config.mfrItemNumbers.map((m: string) => m.trim()).filter(Boolean)))
      : [];

    const processItems = async (items: any[]) => {
      if (!items.length) return;

      progress.scanned += items.length;

      const itemNumbers = items.map((it) => it.ScanSourceItemNumber || it.itemNumber).filter(Boolean);
      const uniqueItemNumbers = Array.from(new Set(itemNumbers));
      const batchPricingMap = await getPricingForBatch(uniqueItemNumbers);

      for (const item of items) {
        const itemNumber: string | undefined = item.ScanSourceItemNumber || item.itemNumber;
        if (!itemNumber) { progress.skipped++; continue; }

        try {
          // Details (best-effort)
          let detailData: any = {};
          try {
            const detailParams = new URLSearchParams({
              customerNumber: env.customerNumber,
              itemNumber,
              partNumberType: "1",
              region: "0",
            });
            detailData = await callApi(`/detail?${detailParams.toString()}`);
          } catch { /* non-fatal */ }

          const detailRecord = detailData?.ProductDetail ?? detailData ?? {};

          // Pricing/availability row (single row object)
          const pricingData = batchPricingMap.get(itemNumber) || {};

          // compute availability from pricing payload
          const availability = extractAvailability(pricingData);
          const normalizedAvailability =
            typeof availability === "number" && Number.isFinite(availability)
              ? Math.trunc(availability)
              : null;
          const description = pickDescription(item, detailRecord);

          const productMediaRaw = pickField(detailRecord, item, "ProductMedia");
          const productMedia = Array.isArray(productMediaRaw)
            ? productMediaRaw.map((media: any) => ({
                MediaType: media?.MediaType ?? media?.mediaType ?? null,
                URL: media?.URL ?? media?.url ?? null,
              }))
            : [];

          // write to staging
          const baseRecord = {
            item_number: itemNumber,
            mfr_item_number: pickField(detailRecord, item, "ManufacturerItemNumber") ?? null,
            manufacturer: pickField(detailRecord, item, "Manufacturer") ?? null,
            title: pickField(detailRecord, item, "Description") ?? null,
            description: pickField(detailRecord, item, "Description") ?? null,
            item_description: description,
            catalog_name: pickField(detailRecord, item, "CatalogName") ?? null,
            category_path: pickField(detailRecord, item, "CategoryPath") ?? null,
            product_family: pickField(detailRecord, item, "ProductFamily") ?? null,
            product_family_description: pickField(detailRecord, item, "ProductFamilyDescription") ?? null,
            product_family_headline: pickField(detailRecord, item, "ProductFamilyHeadline") ?? null,
            item_status: pickField(detailRecord, item, "ItemStatus") ?? null,
            item_image_url: pickField(detailRecord, item, "ItemImage") ?? null,
            product_family_image_url: pickField(detailRecord, item, "ProductFamilyImage") ?? null,
            business_unit: pickField(detailRecord, item, "BusinessUnit") ?? null,
            plant_material_status_valid_from: toTimestamp(pickField(detailRecord, item, "PlantMaterialStatusValidfrom")),
            rebox_item: toBoolean(pickField(detailRecord, item, "ReboxItem")),
            b_stock_item: toBoolean(pickField(detailRecord, item, "BStockItem")),
            base_unit_of_measure: pickField(detailRecord, item, "BaseUnitofMeasure") ?? null,
            general_item_category_group: pickField(detailRecord, item, "GeneralItemCategoryGroup") ?? null,
            gross_weight: toNumber(pickField(detailRecord, item, "GrossWeight")),
            material_group: pickField(detailRecord, item, "MaterialGroup") ?? null,
            material_type: pickField(detailRecord, item, "MaterialType") ?? null,
            battery_indicator: pickField(detailRecord, item, "BatteryIndicator") ?? null,
            rohs_compliance_indicator: pickField(detailRecord, item, "RoHSComplianceIndicator") ?? null,
            manufacturer_division: pickField(detailRecord, item, "ManufacturerDivision") ?? null,
            commodity_import_code_number: pickField(detailRecord, item, "CommodityImportCodeNumber") ?? null,
            country_of_origin: pickField(detailRecord, item, "CountryofOrigin") ?? null,
            unspsc: pickField(detailRecord, item, "UNSPSC") ?? null,
            delivering_plant: pickField(detailRecord, item, "DeliveringPlant") ?? null,
            material_freight_group: pickField(detailRecord, item, "MaterialFreightGroup") ?? null,
            minimum_order_quantity: toInteger(pickField(detailRecord, item, "MinimumOrderQuantity")),
            salesperson_intervention_required: toBoolean(
              pickField(detailRecord, item, "SalespersonInterventionRequired"),
            ),
            sell_via_edi: toBoolean(pickField(detailRecord, item, "SellviaEDI")),
            sell_via_web: pickField(detailRecord, item, "SellviaWeb") ?? null,
            serial_number_profile: pickField(detailRecord, item, "SerialNumberProfile") ?? null,
            packaged_length: toNumber(pickField(detailRecord, item, "PackagedLength")),
            packaged_width: toNumber(pickField(detailRecord, item, "PackagedWidth")),
            packaged_height: toNumber(pickField(detailRecord, item, "PackagedHeight")),
            date_added: toTimestamp(pickField(detailRecord, item, "DateAdded")),
            product_media: productMedia,

            // raw payloads
            detail_json: detailData,
            pricing_json: pricingData,

            // availability
            stock_available: normalizedAvailability,
            stock_updated_at: normalizedAvailability != null ? new Date().toISOString() : null,

            discontinued:
              String(pickField(detailRecord, item, "ItemStatus") || "")
                .toLowerCase()
                .includes("discontinued") || false,
            last_synced_at: new Date().toISOString(),
            manufacturer_norm: normalize(pickField(detailRecord, item, "Manufacturer") || ""),
            category_norm: normalize(pickField(detailRecord, item, "CategoryPath") || ""),
          } as const;

          // upsert by item_number (safe if unique key exists)
          const { data: existing, error: exErr } = await svc
            .from("supplier_items")
            .select("item_number")
            .eq("item_number", itemNumber)
            .maybeSingle();

          if (exErr) {
            progress.errors.push(`${itemNumber}: lookup error ${exErr.message}`);
            progress.skipped++;
            continue;
          }

          if (existing) {
            const { error: updErr } = await svc.from("supplier_items").update(baseRecord).eq("item_number", itemNumber);
            if (updErr) {
              progress.errors.push(`${itemNumber}: update error ${updErr.message}`);
              progress.skipped++;
            } else {
              progress.updated++;
            }
          } else {
            const { error: insErr } = await svc.from("supplier_items").insert(baseRecord);
            if (insErr) {
              progress.errors.push(`${itemNumber}: insert error ${insErr.message}`);
              progress.skipped++;
            } else {
              progress.added++;
            }
          }
        } catch (err: any) {
          progress.errors.push(`${itemNumber}: ${err.message}`);
          progress.skipped++;
        }
      }

      await svc.from("import_jobs").update({ progress }).eq("id", jobId);
    };

    if (directItemInputs.length > 0) {
      const matchedItems = new Map<string, any>();
      for (const lookup of directItemInputs) {
        const normalizedLookup = normalizePartKey(lookup);
        let page = 1;
        let found = false;
        const seenKeys = new Set<string>();

        while (!found && page <= 10) {
          const searchParams = new URLSearchParams({
            customerNumber: env.customerNumber,
            region: "0",
            includeObsolete: "false",
            pageSize: "50",
            page: String(page),
            searchText: lookup,
          });

          let items: any[] = [];
          try {
            const result = await callApi(`/search?${searchParams.toString()}`);
            items = Array.isArray(result) ? result : (result.items || []);
          } catch (err: any) {
            progress.errors.push(`${lookup}: search error ${err.message}`);
            break;
          }

          if (!items.length) break;

          const directItemMatches = items.filter((item) => {
            const candidateNumber = normalizePartKey(item.ScanSourceItemNumber || item.itemNumber || "");
            return candidateNumber !== "" && candidateNumber === normalizedLookup;
          });

          const manufacturerMatches = directItemMatches.length
            ? []
            : items.filter((item) => {
                const candidateMfr = normalizePartKey(item.ManufacturerItemNumber || item.manufacturerItemNumber || "");
                return candidateMfr !== "" && candidateMfr === normalizedLookup;
              });

          const matches = directItemMatches.length
            ? directItemMatches
            : manufacturerMatches.slice(0, 3);

          const beforeAdd = seenKeys.size;

          for (const item of matches) {
            const keySource = item.ScanSourceItemNumber || item.itemNumber || "";
            const key = normalizePartKey(keySource);
            if (!key || seenKeys.has(key)) continue;
            seenKeys.add(key);
            matchedItems.set(key, item);
          }

          found = seenKeys.size > beforeAdd;

          if (!found) page++;
        }

        if (!found) {
          progress.errors.push(`${lookup}: not found`);
        }
      }

      await processItems(Array.from(matchedItems.values()));

      // Ensure progress (including not-found errors) is persisted even if no matches
      await svc.from("import_jobs").update({ progress }).eq("id", jobId);
    } else {
      // IMPORTANT: manufacturer filter key is manufacturerName
      const filters: Record<string, string> = {};
      if (Array.isArray(config.manufacturers) && config.manufacturers.length) {
        const mf = config.manufacturers.map((m: string) => m.trim()).filter(Boolean).join(",");
        // Set BOTH keys; different API deployments expect one or the other
        filters.manufacturer = mf;
        filters.manufacturerName = mf;
      }
      if (Array.isArray(config.categories) && config.categories.length) {
        filters.categoryPath = config.categories.map((c: string) => c.trim()).filter(Boolean).join(",");
      }
      if (config.searchText) {
        filters.searchText = String(config.searchText).trim();
      }

      const maxPages = Math.min(config.maxPages || 2, 10);

      for (let page = 1; page <= maxPages; page++) {
        const searchParams = new URLSearchParams({
          customerNumber: env.customerNumber,
          region: "0",
          includeObsolete: "false",
          pageSize: String(env.pageSize),
          page: String(page),
          ...filters,
        });

        const result = await callApi(`/search?${searchParams.toString()}`);
        const items: any[] = Array.isArray(result) ? result : (result.items || []);
        if (items.length === 0) break;

        await processItems(items);

        if (items.length < env.pageSize) break;
      }
    }

    await svc.from("import_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      progress,
    }).eq("id", jobId);
  } catch (err: any) {
    await svc.from("import_jobs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      progress: { scanned: 0, added: 0, updated: 0, skipped: 0, errors: [err.message] },
    }).eq("id", jobId);
  }
}

// --- Job status ---
async function handleJobStatus(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");
    const svc = createClient(env.supabaseUrl, env.supabaseKey);

    if (jobId) {
      const { data: job } = await svc.from("import_jobs").select("*").eq("id", jobId).maybeSingle();
      return new Response(JSON.stringify(job || { error: "Job not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const { data: jobs } = await svc.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(10);
      return new Response(JSON.stringify(jobs || []), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// --- Staging list ---
async function handleStagingItems(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = new URL(req.url);
    const pageParam = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const pageSizeParam = Number.parseInt(url.searchParams.get("pageSize") || "50", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 50;
    const manufacturer = url.searchParams.get("manufacturer")?.trim();
    const category = url.searchParams.get("category")?.trim();
    const search = url.searchParams.get("q")?.trim();

    const svc = createClient(env.supabaseUrl, env.supabaseKey);
    let query = svc
      .from("supplier_items")
      .select("*", { count: "exact" });

    if (manufacturer) {
      query = query.ilike("manufacturer", `%${escapeIlike(manufacturer)}%`);
    }

    if (category) {
      query = query.ilike("category_path", `%${escapeIlike(category)}%`);
    }

    if (search) {
      const escaped = escapeIlike(search);
      query = query.or(
        ["item_number", "title", "description", "mfr_item_number", "item_description"].map(
          (field) => `${field}.ilike.%${escaped}%`,
        ).join(","),
      );
    }

    const { data, count, error } = await query
      .order("last_synced_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    return new Response(JSON.stringify({ items: data, total: count, page, pageSize }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// --- Diff (returns availability; only treats scansource-linked items as "published") ---
async function handleDiff(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(env.supabaseUrl, env.supabaseKey);

    const { data: supplierItems, error: siErr } = await svc
      .from("supplier_items")
      .select("item_number, title, description, pricing_json, manufacturer, category_path")
      .order("last_synced_at", { ascending: false });

    if (siErr) throw siErr;

    const { data: links, error: psErr } = await svc
      .from("product_sources")
      .select("item_number")
      .eq("supplier", "scansource");

    if (psErr) throw psErr;

    const linked = new Set((links || []).map((r) => r.item_number));
    const newItems = (supplierItems || []).filter((i) => !linked.has(i.item_number));

    const shapedNew = newItems.map((i) => {
      const msrpValue = Number(i.pricing_json?.MSRP ?? i.pricing_json?.msrp ?? i.pricing_json?.Msrp ?? NaN);
      return {
        item_number: i.item_number,
        title: i.description || i.title,
        msrp: Number.isFinite(msrpValue) ? msrpValue : undefined,
        manufacturer: i.manufacturer,
        category: i.category_path,
        availability: extractAvailability(i.pricing_json),
      };
    });

    return new Response(
      JSON.stringify({ new: shapedNew, changed: [], unchanged: Array.from(linked) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// --- Publish ---
async function handlePublish(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const input = publishSchema.parse(body);
    const svc = createClient(env.supabaseUrl, env.supabaseKey);
    const results: any[] = [];

    for (const itemNumber of input.item_numbers.slice(0, 20)) {
      try {
        const { data: supplierItem } = await svc.from("supplier_items").select("*").eq("item_number", itemNumber).maybeSingle();
        if (!supplierItem) { results.push({ itemNumber, status: "not_found" }); continue; }

        const { data: existingLink } = await svc.from("product_sources").select("product_id").eq("item_number", itemNumber).maybeSingle();
        if (existingLink) { results.push({ itemNumber, status: "already_published" }); continue; }

        const pricing = supplierItem.pricing_json || {};
        const rawMsrp = Number(pricing.MSRP ?? pricing.msrp ?? pricing.Msrp ?? 0);
        const msrp = Number.isFinite(rawMsrp) ? rawMsrp : 0;
        const rawReseller = Number(pricing.UnitPrice ?? pricing.unitPrice ?? pricing.Unitprice ?? msrp);
        const resellerPrice = Number.isFinite(rawReseller) ? rawReseller : 0;
        const defaultSalePrice = Math.max(msrp > 0 ? msrp : 0, resellerPrice);
        const adjustmentValue = defaultSalePrice - resellerPrice;
        const computedAvailability = extractAvailability(pricing);
        const stockAvailable =
          typeof supplierItem.stock_available === "number" && Number.isFinite(supplierItem.stock_available)
            ? supplierItem.stock_available
            : computedAvailability ?? null;

        const categoryList = supplierItem.category_path
          ? (supplierItem.category_path as string)
              .split("//")
              .map((segment) => segment.trim())
              .filter((segment) => segment.length > 0)
          : null;

        const productMedia = Array.isArray(supplierItem.product_media) ? supplierItem.product_media : [];
        const detailJson = supplierItem.detail_json && typeof supplierItem.detail_json === "object" ? supplierItem.detail_json : {};

        const { data: newProduct } = await svc
          .from("products")
          .insert({
            sku: supplierItem.item_number,
            title: supplierItem.description || supplierItem.title || supplierItem.item_number,
            manufacturer: supplierItem.manufacturer || null,
            manufacturer_item_number: supplierItem.mfr_item_number || null,
            model: supplierItem.mfr_item_number || null,
            short_desc:
              supplierItem.product_family_headline ||
              supplierItem.product_family_description ||
              supplierItem.item_description ||
              null,
            long_desc: supplierItem.item_description || supplierItem.description || null,
            item_description: supplierItem.item_description || null,
            product_family: supplierItem.product_family || null,
            product_family_description: supplierItem.product_family_description || null,
            product_family_headline:
              supplierItem.product_family_headline ||
              supplierItem.product_family_description ||
              supplierItem.item_description ||
              null,
            product_family_image_url: supplierItem.product_family_image_url || null,
            item_image_url: supplierItem.item_image_url || null,
            catalog_name: supplierItem.catalog_name || null,
            business_unit: supplierItem.business_unit || null,
            category_path: supplierItem.category_path || null,
            categories: categoryList,
            msrp,
            map_price: defaultSalePrice,
            reseller_price: resellerPrice,
            sale_price: defaultSalePrice,
            price_adjustment_type: 'fixed',
            price_adjustment_value: adjustmentValue,
            item_status: supplierItem.item_status || null,
            stock_status: supplierItem.item_status || "Unknown",
            plant_material_status_valid_from: supplierItem.plant_material_status_valid_from || null,
            stock_available: stockAvailable ?? 0,
            rebox_item: typeof supplierItem.rebox_item === "boolean" ? supplierItem.rebox_item : null,
            b_stock_item: typeof supplierItem.b_stock_item === "boolean" ? supplierItem.b_stock_item : null,
            base_unit_of_measure: supplierItem.base_unit_of_measure || null,
            general_item_category_group: supplierItem.general_item_category_group || null,
            gross_weight: supplierItem.gross_weight ?? null,
            weight: supplierItem.gross_weight ?? null,
            material_group: supplierItem.material_group || null,
            material_type: supplierItem.material_type || null,
            battery_indicator: supplierItem.battery_indicator || null,
            rohs_compliance_indicator: supplierItem.rohs_compliance_indicator || null,
            manufacturer_division: supplierItem.manufacturer_division || null,
            commodity_import_code_number: supplierItem.commodity_import_code_number || null,
            country_of_origin: supplierItem.country_of_origin || null,
            unspsc: supplierItem.unspsc || null,
            delivering_plant: supplierItem.delivering_plant || null,
            material_freight_group: supplierItem.material_freight_group || null,
            minimum_order_quantity: supplierItem.minimum_order_quantity ?? null,
            salesperson_intervention_required:
              typeof supplierItem.salesperson_intervention_required === "boolean"
                ? supplierItem.salesperson_intervention_required
                : null,
            sell_via_edi: typeof supplierItem.sell_via_edi === "boolean" ? supplierItem.sell_via_edi : null,
            sell_via_web: supplierItem.sell_via_web || null,
            serial_number_profile: supplierItem.serial_number_profile || null,
            packaged_length: supplierItem.packaged_length ?? null,
            packaged_width: supplierItem.packaged_width ?? null,
            packaged_height: supplierItem.packaged_height ?? null,
            date_added: supplierItem.date_added || null,
            product_media: productMedia,
            detail_json: detailJson,
            published: true,
          })
          .select("id")
          .single();

        if (newProduct) {
          await svc.from("product_sources").insert({ product_id: newProduct.id, supplier: "scansource", item_number: itemNumber });
          results.push({ itemNumber, status: "created", productId: newProduct.id });
        }
      } catch (err: any) {
        results.push({ itemNumber, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// --- Clear staging ---
async function handleClearStaging(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(env.supabaseUrl, env.supabaseKey);
    const { count } = await svc.from("supplier_items").delete().neq("item_number", "");
    return new Response(JSON.stringify({ success: true, count: count || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

// --- Router ---
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  try {
    if (url.pathname.endsWith("/import/run") && req.method === "POST") return await handleImportRun(req);
    if (url.pathname.endsWith("/import/status") && req.method === "GET") return await handleJobStatus(req);
    if (url.pathname.endsWith("/staging/items") && req.method === "GET") return await handleStagingItems(req);
    if (url.pathname.endsWith("/import/diff") && req.method === "GET") return await handleDiff(req);
    if (url.pathname.endsWith("/import/publish") && req.method === "POST") return await handlePublish(req);
    if (url.pathname.endsWith("/staging/clear") && req.method === "DELETE") return await handleClearStaging(req);

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
