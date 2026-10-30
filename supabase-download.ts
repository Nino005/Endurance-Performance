// Supabase Edge Function "download": dopo il pagamento (o per i prodotti gratuiti) restituisce i link ai file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" };
const j = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { sid, free } = await req.json();
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let items: any[] = [];
    if (sid) {
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sid),
        { headers: { Authorization: "Bearer " + Deno.env.get("STRIPE_SECRET_KEY") } });
      const s = await r.json();
      if (s.payment_status !== "paid") return j({ error: "non pagato" }, 402);
      items = JSON.parse(s.metadata?.items || "[]");
    } else if (free) items = [{ id: free }];
    const { data: prods } = await db.from("products").select("id,name,file_path,price_cents").in("id", items.map((i) => i.id));
    const files: { name: string; url: string }[] = [];
    for (const p of prods || []) {
      if (!p.file_path || (!sid && p.price_cents > 0)) continue;
      const { data } = await db.storage.from("downloads").createSignedUrl(p.file_path, 86400);
      if (data) files.push({ name: p.name, url: data.signedUrl });
    }
    return j({ files });
  } catch { return j({ error: "errore" }, 500); }
});
