import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let userId: string | null = null;
    let requesterUserRecordId: string | null = null;

    if (authHeader) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;

      if (userId) {
        const { data: requesterUser, error: requesterUserError } = await serviceClient
          .from("users")
          .select("id")
          .eq("auth_user_id", userId)
          .maybeSingle();

        if (requesterUserError) {
          throw requesterUserError;
        }

        requesterUserRecordId = requesterUser?.id ?? null;
      }
    }

    const body = await req.json();
    const action = body.action ?? "create";

    const createdByMatchesRequester = (createdBy?: string | null) => {
      if (!createdBy) {
        return true;
      }

      if (requesterUserRecordId && createdBy === requesterUserRecordId) {
        return true;
      }

      if (userId && createdBy === userId) {
        return true;
      }

      return false;
    };

    if (action === "finalize") {
      const { paymentIntentId } = body;

      if (!paymentIntentId) {
        throw new Error("paymentIntentId is required");
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (!paymentIntent || typeof paymentIntent.amount !== "number") {
        throw new Error("Unable to retrieve payment intent");
      }

      if (paymentIntent.status !== "succeeded") {
        throw new Error(`Payment is not complete (status: ${paymentIntent.status})`);
      }

      const orderId = paymentIntent.metadata?.orderId;

      if (!orderId) {
        throw new Error("Payment intent is missing order metadata");
      }

      const { data: order, error: orderError } = await serviceClient
        .from("orders")
        .select("id, created_by, status, stripe_payment_intent_id")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError) {
        throw orderError;
      }

      if (!order) {
        throw new Error("Order not found");
      }

      if (!createdByMatchesRequester(order.created_by)) {
        throw new Error("You do not have permission to modify this order");
      }

      if (order.status === "Confirmed") {
        return new Response(
          JSON.stringify({ orderId, status: "already_confirmed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: updateError } = await serviceClient
        .from("orders")
        .update({
          status: "Confirmed",
          payment_status: paymentIntent.status as string,
          stripe_payment_intent_id: paymentIntent.id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ orderId, status: paymentIntent.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { orderId, currency = "usd", receiptEmail } = body;

    if (!orderId) {
      throw new Error("orderId is required");
    }

    const { data: order, error: orderError } = await serviceClient
      .from("orders")
      .select("id, total, status, stripe_payment_intent_id, created_by, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    if (!order) {
      throw new Error("Order not found");
    }

    if (!createdByMatchesRequester(order.created_by)) {
      throw new Error("You do not have permission to pay for this order");
    }

    if (order.status === "Confirmed") {
      return new Response(
        JSON.stringify({ error: "Order already confirmed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amount = Number(order.total ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Order total is invalid for payment");
    }

    const amountInCents = Math.round(amount * 100);

    let paymentIntent = null;

    if (order.stripe_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);

        if (existing.status === "succeeded") {
          return new Response(
            JSON.stringify({ error: "Order already paid" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (existing.status !== "canceled" && existing.amount !== amountInCents) {
          paymentIntent = await stripe.paymentIntents.update(existing.id, {
            amount: amountInCents,
          });
        } else {
          paymentIntent = existing.status === "canceled" ? null : existing;
        }
      } catch (_err) {
        paymentIntent = null;
      }
    }

    if (!paymentIntent) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        metadata: {
          orderId,
          userId: userId ?? "guest",
        },
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: receiptEmail || undefined,
      });
    }

    const { error: linkError } = await serviceClient
      .from("orders")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        payment_status: paymentIntent.status as string,
      })
      .eq("id", orderId);

    if (linkError) {
      throw linkError;
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});