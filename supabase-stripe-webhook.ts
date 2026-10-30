// Supabase Edge Function "stripe-webhook" (disattiva "Verify JWT"): registra l'acquisto e invia i link via email
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
async function verify(body: string, sig: string, secret: string) {
  const p: Record<string, string> = Object.fromEntries(sig.split(",").map((x) => x.split("=")));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(p.t + "." + body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("") === p.v1;
}
Deno.serve(async (req) => {
  const body = await req.text();
  if (!(await verify(body, req.headers.get("stripe-signature") || "", Deno.env.get("STRIPE_WEBHOOK_SECRET")!)))
    return new Response("firma non valida", { status: 400 });
  const ev = JSON.parse(body);
  if (ev.type !== "checkout.session.completed") return new Response("ok");
  const s = ev.data.object, items = JSON.parse(s.metadata?.items || "[]");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: prods } = await db.from("products").select("id,name,file_path").in("id", items.map((i: any) => i.id));
  const email = s.customer_details?.email || s.customer_email;
  await db.from("orders").upsert({ session_id: s.id, email, total_cents: s.amount_total,
    items: items.map((i: any) => ({ name: prods?.find((p: any) => p.id === i.id)?.name, q: i.q })) }, { onConflict: "session_id" });
  const links: string[] = [];
  for (const p of prods || []) if (p.file_path) {
    const { data } = await db.storage.from("downloads").createSignedUrl(p.file_path, 604800);
    if (data) links.push(`<li><a href="${data.signedUrl}">${p.name}</a></li>`);
  }
  const key = Deno.env.get("RESEND_API_KEY");
  if (key && email) await fetch("https://api.resend.com/emails", { method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM"), to: email, subject: "I tuoi programmi - Endurance Performance",
      html: `<p>Grazie per l’acquisto! Ecco i tuoi download (validi 7 giorni):</p><ul>${links.join("")}</ul>` }) });
  return new Response("ok");
});
