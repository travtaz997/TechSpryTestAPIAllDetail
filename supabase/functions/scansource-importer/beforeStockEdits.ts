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
});

const publishSchema = z.object({
  item_numbers: z.array(z.string()),
  mapping: z.object({
    fields_to_copy: z.array(z.string()).optional(),
  }).optional(),
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
  const anonSupabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
  const { data: { user }, error } = await anonSupabase.auth.getUser(token);
  if (error || !user) return { authorized: false };

  const serviceSupabase = createClient(env.supabaseUrl, env.supabaseKey);
  const { data: profile } = await serviceSupabase
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";
  return { authorized: isAdmin, userId: user.id, isAdmin };
}

// --- Utils ---
function normalize(s: string): string {
  return (s || "").toLowerCase().trim();
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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
async function callApi(path: string, options: any = {}): Promise<any> {
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
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON parse error: ${text.substring(0, 200)}`);
  }
}

function getMockData(path: string): any {
  if (path.includes("/search")) {
    return {
      items: [
        {
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
        },
      ],
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
    return {
      items: [
        {
          itemNumber: "MOCK001",
          MSRP: 299.99,
          UnitPrice: 249.99,
        },
      ],
    };
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
    for (const wh of safeWarehouses) {
      attempts.push({ tag: `BU:${bu}+WH:${wh}`, body: { ...baseBody, BusinessUnit: bu, Warehouse: wh } });
    }
  }
  for (const bu of [env.businessUnit]) {
    attempts.push({ tag: `BU:${bu}`, body: { ...baseBody, BusinessUnit: bu } });
  }
  for (const wh of safeWarehouses) {
    attempts.push({ tag: `WH:${wh}`, body: { ...baseBody, Warehouse: wh } });
  }
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
            result.set(k, rest);
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const input = runSchema.parse(body);

    const supabase = createClient(env.supabaseUrl, env.supabaseKey);

    const { data: job } = await supabase
      .from("import_jobs")
      .insert({
        status: "pending",
        config: input,
        created_by: auth.userId,
      })
      .select("id")
      .single();

    if (!job) throw new Error("Failed to create job");

    processImportJob(job.id, input).catch(console.error);

    return new Response(JSON.stringify({ jobId: job.id, status: "started" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function processImportJob(jobId: string, config: any) {
  const supabase = createClient(env.supabaseUrl, env.supabaseKey);

  try {
    await supabase
      .from("import_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);

    const progress = { scanned: 0, added: 0, updated: 0, skipped: 0, errors: [] as string[] };

    const filters: Record<string, string> = {};
    if (config.manufacturers?.length) filters.manufacturer = config.manufacturers.join(",");
    if (config.categories?.length) filters.categoryPath = config.categories.join(",");
    if (config.searchText) filters.searchText = config.searchText;

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

      const result = await callApi(`/search?${searchParams}`);
      const items = Array.isArray(result) ? result : (result.items || []);
      if (items.length === 0) break;

      progress.scanned += items.length;

      const itemNumbers = items.map((item: any) => item.ScanSourceItemNumber || item.itemNumber).filter(Boolean);
      const batchPricingMap = await getPricingForBatch(itemNumbers);

      for (const item of items) {
        try {
          const itemNumber = item.ScanSourceItemNumber || item.itemNumber;
          if (!itemNumber) { progress.skipped++; continue; }

          let detailData: any = {};
          try {
            const detailParams = new URLSearchParams({
              customerNumber: env.customerNumber,
              itemNumber,
              partNumberType: "1",
              region: "0",
            });
            detailData = await callApi(`/detail?${detailParams}`);
          } catch {}

          const pricingData = batchPricingMap.get(itemNumber) || {};

          const record = {
            item_number: itemNumber,
            mfr_item_number: item.ManufacturerItemNumber || item.manufacturerItemNumber,
            manufacturer: item.Manufacturer || item.manufacturer,
            title: item.Description || item.description,
            catalog_name: item.CatalogName || item.catalogName,
            category_path: item.CategoryPath || item.categoryPath,
            product_family: item.ProductFamily || item.productFamily,
            product_family_headline: item.ProductFamilyDescription || item.productFamilyDescription,
            item_status: item.ItemStatus || item.itemStatus,
            item_image_url: item.ItemImage || item.itemImage,
            product_family_image_url: item.ProductFamilyImage || item.productFamilyImage,
            detail_json: detailData,
            pricing_json: pricingData,
            discontinued: (item.ItemStatus || item.itemStatus || "").toLowerCase().includes("discontinued") || false,
            last_synced_at: new Date().toISOString(),
            manufacturer_norm: normalize(item.Manufacturer || item.manufacturer),
            category_norm: normalize(item.CategoryPath || item.categoryPath),
          };

          const { data: existing } = await supabase
            .from("supplier_items")
            .select("item_number")
            .eq("item_number", itemNumber)
            .maybeSingle();

          if (existing) {
            await supabase.from("supplier_items").update(record).eq("item_number", itemNumber);
            progress.updated++;
          } else {
            await supabase.from("supplier_items").insert(record);
            progress.added++;
          }
        } catch (err: any) {
          progress.errors.push(`${item?.itemNumber || "unknown"}: ${err.message}`);
          progress.skipped++;
        }
      }

      await supabase.from("import_jobs").update({ progress }).eq("id", jobId);
    }

    await supabase
      .from("import_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        progress,
      })
      .eq("id", jobId);
  } catch (err: any) {
    await supabase
      .from("import_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        progress: { scanned: 0, added: 0, updated: 0, skipped: 0, errors: [err.message] },
      })
      .eq("id", jobId);
  }
}

// ---------- helpers to map into products ----------
function safeNum(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
function uniqStrings(arr: (string | null | undefined)[]) {
  return Array.from(new Set(arr.map(x => (x || "").trim()).filter(Boolean)));
}
function toJsonOrNull(v: any) {
  try {
    if (v == null) return null;
    if (typeof v === "string") return JSON.parse(v);
    return v;
  } catch { return null; }
}
async function resolveBrandId(supabase: ReturnType<typeof createClient>, manufacturer?: string | null) {
  const name = (manufacturer || "").trim();
  if (!name) return null;

  // assumes a "brands" table with unique name column; change if yours differs
  const { data: brand } = await supabase.from("brands").select("id").ilike("name", name).maybeSingle();
  if (brand?.id) return brand.id;

  // create on the fly (optional; comment out if you don't want auto-create)
  const { data: created } = await supabase.from("brands").insert({ name }).select("id").maybeSingle();
  return created?.id || null;
}

// --- Job status ---
async function handleJobStatus(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");

    const supabase = createClient(env.supabaseUrl, env.supabaseKey);

    if (jobId) {
      const { data: job } = await supabase
        .from("import_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      return new Response(JSON.stringify(job || { error: "Job not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const { data: jobs } = await supabase
        .from("import_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      return new Response(JSON.stringify(jobs || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// --- Staging list ---
async function handleStagingItems(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50");

    const supabase = createClient(env.supabaseUrl, env.supabaseKey);

    const { data, count } = await supabase
      .from("supplier_items")
      .select("*", { count: "exact" })
      .order("last_synced_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    return new Response(
      JSON.stringify({ items: data, total: count, page, pageSize }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// --- Diff ---
async function handleDiff(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(env.supabaseUrl, env.supabaseKey);

    const { data: supplierItems } = await supabase
      .from("supplier_items")
      .select("item_number, title, pricing_json, manufacturer, category_path");

    const { data: sources } = await supabase
      .from("product_sources")
      .select("item_number");

    const linkedItems = new Set(sources?.map((s) => s.item_number) || []);
    const newItems = supplierItems?.filter((item) => !linkedItems.has(item.item_number)) || [];

    return new Response(
      JSON.stringify({
        new: newItems.map((item) => ({
          item_number: item.item_number,
          title: item.title,
          msrp: item.pricing_json?.MSRP || item.pricing_json?.msrp,
          manufacturer: item.manufacturer,
          category: item.category_path,
        })),
        changed: [],
        unchanged: Array.from(linkedItems),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// --- Publish (expanded mapping to your products table) ---
async function handlePublish(req: Request): Promise<Response> {
  try {
    const auth = await checkAuth(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const input = publishSchema.parse(body);
    const supabase = createClient(env.supabaseUrl, env.supabaseKey);
    const results: any[] = [];

    for (const itemNumber of input.item_numbers.slice(0, 20)) {
      try {
        const { data: supplierItem } = await supabase
          .from("supplier_items")
          .select("*")
          .eq("item_number", itemNumber)
          .maybeSingle();

        if (!supplierItem) { results.push({ itemNumber, status: "not_found" }); continue; }

        const { data: existingLink } = await supabase
          .from("product_sources")
          .select("product_id")
          .eq("item_number", itemNumber)
          .maybeSingle();

        if (existingLink) { results.push({ itemNumber, status: "already_published" }); continue; }

        const pricing = supplierItem.pricing_json || {};
        const detail  = supplierItem.detail_json || {};

        // derive fields for your products table
        const msrp = pricing.MSRP ?? pricing.msrp ?? null;
        const mapPrice = pricing.UnitPrice ?? pricing.unitPrice ?? msrp ?? null;

        const upc  = detail.UPC || detail.Upc || detail.upc || null;
        const weight = safeNum(detail.GrossWeight ?? detail.Weight ?? null);

        const dimensions =
          (detail.PackagedLength || detail.PackagedWidth || detail.PackagedHeight)
            ? {
                length: safeNum(detail.PackagedLength),
                width:  safeNum(detail.PackagedWidth),
                height: safeNum(detail.PackagedHeight),
              }
            : null;

        const country = detail.CountryofOrigin || detail.CountryOfOrigin || detail.Country || null;

        const images = uniqStrings([
          supplierItem.item_image_url,
          supplierItem.product_family_image_url,
          detail.ImageURL || detail.ImageUrl || detail.imageUrl,
        ]);

        // Prefer a richer long description if present
        const longDesc =
          detail.LongDescription || detail.DescriptionLong || detail.LongDesc || supplierItem.product_family_headline || null;

        // Use manufacturer to resolve/ensure brand_id (brands table with column "name")
        const brand_id = await resolveBrandId(supabase, supplierItem.manufacturer);

        // Categories: store the supplier category_path as an array (like your sample)
        const categories = supplierItem.category_path ? [supplierItem.category_path] : [];

        // Optional fields that may exist in detail_json
        const datasheet_url =
          detail.DataSheetURL || detail.DatasheetUrl || detail.DatasheetURL || detail.SpecSheetURL || null;

        // If you keep structured specs inside detail_json.Specs/Attributes, use those; else empty object
        const specs =
          toJsonOrNull(detail.Specs) ??
          toJsonOrNull(detail.Attributes) ??
          {};

        // If supplier provides tags, map them; else you can derive a few basics
        const tags =
          Array.isArray(detail.Tags) ? detail.Tags :
          uniqStrings([supplierItem.product_family, supplierItem.manufacturer]).filter(Boolean);

        // Map stock_status from the string you have already (don’t change your working behavior)
        const stock_status = supplierItem.item_status || "Unknown";

        // Warranty if present
        const warranty = detail.Warranty || null;

        // lead_time_days if present in detail/pricing; else null
        const lead_time_days = safeNum(detail.LeadTimeDays ?? pricing.LeadTimeDays ?? null);

        const productData: any = {
          sku: supplierItem.item_number,
          title: supplierItem.title,
          brand_id,
          model: supplierItem.mfr_item_number || null,
          upc,
          short_desc: supplierItem.product_family_headline || null,
          long_desc: longDesc,
          images,                // JSON[]
          datasheet_url,
          categories,            // JSON[]
          tags,                  // JSON[]
          specs,                 // JSON
          msrp: msrp != null ? Number(msrp) : null,
          map_price: mapPrice != null ? Number(mapPrice) : null,
          stock_status,
          lead_time_days,
          weight,
          dimensions,            // JSON {length,width,height}
          warranty,
          country_of_origin: country,
          published: true,
        };

        const { data: newProduct, error: insErr } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();

        if (insErr) throw new Error(insErr.message);

        if (newProduct) {
          await supabase.from("product_sources").insert({
            product_id: newProduct.id,
            supplier: "scansource",
            item_number: itemNumber,
          });
          results.push({ itemNumber, status: "created", productId: newProduct.id });
        } else {
          results.push({ itemNumber, status: "error", error: "insert_failed" });
        }
      } catch (err: any) {
        results.push({ itemNumber, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    const supabase = createClient(env.supabaseUrl, env.supabaseKey);
    const { count } = await supabase.from("supplier_items").delete().neq("item_number", "");

    return new Response(JSON.stringify({ success: true, count: count || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// --- Router ---
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    if (url.pathname.endsWith("/import/run") && req.method === "POST") {
      return await handleImportRun(req);
    }
    if (url.pathname.endsWith("/import/status") && req.method === "GET") {
      return await handleJobStatus(req);
    }
    if (url.pathname.endsWith("/staging/items") && req.method === "GET") {
      return await handleStagingItems(req);
    }
    if (url.pathname.endsWith("/import/diff") && req.method === "GET") {
      return await handleDiff(req);
    }
    if (url.pathname.endsWith("/import/publish") && req.method === "POST") {
      return await handlePublish(req);
    }
    if (url.pathname.endsWith("/staging/clear") && req.method === "DELETE") {
      return await handleClearStaging(req);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
