import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const env = {
  base: Deno.env.get("SCANSOURCE_BASE") || "",
  apiKey: Deno.env.get("SCANSOURCE_API_KEY") || "",
  tokenUrl: Deno.env.get("OAUTH_TOKEN_URL") || "",
  clientId: Deno.env.get("OAUTH_CLIENT_ID") || "",
  clientSecret: Deno.env.get("OAUTH_CLIENT_SECRET") || "",
  scope: Deno.env.get("OAUTH_SCOPE") || "",
  customerNumber: Deno.env.get("CUSTOMER_NUMBER") || "",
};

let tokenCache: { token: string; expires: number } | null = null;

async function getToken(): Promise<string> {
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

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Token fetch failed: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const token = await getToken();
    const tests = [];

    console.log(`\n=== Environment Check ===`);
    console.log(`Customer Number: ${env.customerNumber}`);
    console.log(`Base URL: ${env.base}`);
    console.log(`Token obtained: ${token ? 'Yes' : 'No'}`);

    console.log(`\n=== Step 1: Search for Ubiquiti items ===`);
    const searchParams = new URLSearchParams({
      customerNumber: env.customerNumber,
      region: "0",
      includeObsolete: "false",
      pageSize: "5",
      page: "1",
      manufacturers: "Ubiquiti",
    });

    const searchUrl = `${env.base}/scsc/product/v2/search?${searchParams}`;
    console.log(`Search URL:`, searchUrl);

    const searchRes = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": env.apiKey,
      },
    });

    const searchText = await searchRes.text();
    let searchData;
    try {
      searchData = JSON.parse(searchText);
    } catch {
      searchData = { error: "JSON parse failed", raw: searchText.substring(0, 500) };
    }

    tests.push({
      step: "search",
      method: "GET /search",
      status: searchRes.status,
      ok: searchRes.ok,
      data: searchData,
    });

    const items = Array.isArray(searchData) ? searchData : (searchData.items || []);

    console.log(`\nFound ${items.length} items in search`);
    console.log(`Sample items:`, items.slice(0, 5).map((item: any) => ({
      itemNumber: item.ScanSourceItemNumber || item.itemNumber,
      manufacturer: item.Manufacturer || item.manufacturer,
      description: item.Description || item.description,
      status: item.ItemStatus || item.itemStatus
    })));

    const testItems = items.slice(0, 3).map((item: any) =>
      item.ScanSourceItemNumber || item.itemNumber
    );

    console.log(`\n=== Step 2: Test pricing for ${testItems.length} items: ${testItems.join(', ')} ===`);

    for (const itemNumber of testItems) {
      console.log(`\n--- Testing pricing for item: ${itemNumber} ---`);

      const body = {
        Lines: [
          {
            ItemNumber: itemNumber,
            PartNumberType: 1,
            Quantity: 1
          }
        ]
      };

      const testConfigs = [
        { name: "Without warehouse/businessUnit", params: { customerNumber: env.customerNumber } },
        { name: "With warehouse 1710", params: { customerNumber: env.customerNumber, warehouse: "1710" } },
        { name: "With businessUnit 1700", params: { customerNumber: env.customerNumber, businessUnit: "1700" } },
        { name: "With both warehouse & businessUnit", params: { customerNumber: env.customerNumber, warehouse: "1710", businessUnit: "1700" } },
      ];

      for (const config of testConfigs) {
        const params = new URLSearchParams(config.params);
        const url = `${env.base}/scsc/product/v2/pricing?${params}`;

        console.log(`\nTest: ${config.name}`);
        console.log(`Request URL: ${url}`);
        console.log(`Request Body:`, JSON.stringify(body, null, 2));

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Ocp-Apim-Subscription-Key": env.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const text = await res.text();
        console.log(`Response Status: ${res.status}`);

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = {
            parseError: "Failed to parse JSON",
            rawResponse: text.substring(0, 500),
          };
        }

        tests.push({
          itemNumber,
          testName: config.name,
          requestUrl: url,
          requestBody: body,
          status: res.status,
          ok: res.ok,
          responseData: data,
        });
      }
    }

    return new Response(
      JSON.stringify(tests, null, 2),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ 
        error: err.message,
        stack: err.stack 
      }, null, 2),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});