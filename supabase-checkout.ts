// Supabase Edge Function "checkout": crea il pagamento Stripe leggendo i prezzi dal database
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" };
const j = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { items, email, origin } = await req.json();
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prods } = await db.from("products").select("id,name,price_cents")
      .in("id", (items || []).map((i: any) => i.id)).eq("active", true).gt("price_cents", 0);
    const ok = (items || []).filter((i: any) => prods?.some((p: any) => p.id === i.id))
      .map((i: any) => ({ id: i.id, q: Math.min(Math.max(+i.q || 1, 1), 5) }));
    if (!ok.length) return j({ error: "carrello vuoto" }, 400);
    const f = new URLSearchParams({ mode: "payment", customer_email: email,
      success_url: origin + "/?sid={CHECKOUT_SESSION_ID}", cancel_url: origin + "/#shop",
      "metadata[items]": JSON.stringify(ok) });
    ok.forEach((i: any, k: number) => {
      const p = prods!.find((x: any) => x.id === i.id)!;
      f.append(`line_items[${k}][quantity]`, String(i.q));
      f.append(`line_items[${k}][price_data][currency]`, "eur");
      f.append(`line_items[${k}][price_data][unit_amount]`, String(p.price_cents));
      f.append(`line_items[${k}][price_data][product_data][name]`, p.name);
    });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST",
      headers: { Authorization: "Bearer " + Deno.env.get("STRIPE_SECRET_KEY"), "Content-Type": "application/x-www-form-urlencoded" }, body: f });
    const s = await r.json();
    return s.url ? j({ url: s.url }) : j({ error: "stripe" }, 500);
  } catch { return j({ error: "errore" }, 500); }
});
