// /supabase/functions/run-products-stock-update/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.2/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DB_URL = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DATABASE_URL");

const SQL = `
ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_available integer;

UPDATE products p
SET stock_available = COALESCE(
  (si.pricing_json->>'AvailableQuantity')::int,
  (si.pricing_json->>'availableQuantity')::int,
  (si.pricing_json->>'QuantityAvailable')::int,
  (si.pricing_json->>'qtyAvailable')::int,
  (si.detail_json->>'AvailableQuantity')::int,
  0
)
FROM product_sources ps
JOIN supplier_items si ON si.item_number = ps.item_number
WHERE ps.supplier = 'scansource'
  AND ps.product_id = p.id;

ALTER TABLE products
ALTER COLUMN stock_available SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS products_stock_available_idx
ON products (stock_available);
`;

async function requireAdmin(req: Request) {
  const hdr = req.headers.get("Authorization");
  if (!hdr) return { ok: false as const };
  const token = hdr.replace("Bearer ", "");
  const anon = createClient(SUPABASE_URL, ANON);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return { ok: false as const };

  const svc = createClient(SUPABASE_URL, SERVICE);
  const { data: profile } = await svc
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return { ok: profile?.role === "admin" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    if (!DB_URL) {
      return new Response(JSON.stringify({ error: "DB URL not configured (SUPABASE_DB_URL or DATABASE_URL)" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const client = new Client(DB_URL);
    await client.connect();

    // Execute as a single transaction so it all succeeds or fails together
    try {
      await client.queryArray("BEGIN");
      const r1 = await client.queryArray`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_available integer;`;
      const r2 = await client.queryArray`
        UPDATE products p
        SET stock_available = COALESCE(
          (si.pricing_json->>'AvailableQuantity')::int,
          (si.pricing_json->>'availableQuantity')::int,
          (si.pricing_json->>'QuantityAvailable')::int,
          (si.pricing_json->>'qtyAvailable')::int,
          (si.detail_json->>'AvailableQuantity')::int,
          0
        )
        FROM product_sources ps
        JOIN supplier_items si ON si.item_number = ps.item_number
        WHERE ps.supplier = 'scansource'
          AND ps.product_id = p.id;
      `;
      const r3 = await client.queryArray`ALTER TABLE products ALTER COLUMN stock_available SET DEFAULT 0;`;
      const r4 = await client.queryArray`CREATE INDEX IF NOT EXISTS products_stock_available_idx ON products (stock_available);`;

      await client.queryArray("COMMIT");
      await client.end();

      return new Response(JSON.stringify({
        success: true,
        details: {
          alter_column: "ok",
          backfill_updated: r2.rowCount ?? null,
          set_default: "ok",
          index: "ok",
        },
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      try { await client.queryArray("ROLLBACK"); } catch {}
      await client.end();
      throw e;
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
