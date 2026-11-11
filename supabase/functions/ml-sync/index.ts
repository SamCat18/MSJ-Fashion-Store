import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mlFetch, mlToken } from "../_shared/mercadolibre.ts";

// Procesa la cola sync_queue hacia Mercado Libre: publicar productos, actualizar stock y precio, pausar o cerrar.
// La cola la llenan triggers de la base (cambios de stock/precio) y el panel (Preparar publicaciones).
// Quién puede ejecutarla: un administrador (sesión) o un cron con el encabezado x-cron-secret = ML_CRON_SECRET.
// Despliegue: supabase functions deploy ml-sync --no-verify-jwt
// Cron sugerido (SQL Editor, con pg_net): cada 10 minutos POST a /functions/v1/ml-sync con x-cron-secret (ver la guía).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Job = { id: number; action: string; product_id: string; attempts: number; payload: Record<string, unknown> };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const cronSecret = Deno.env.get("ML_CRON_SECRET");
  const fromCron = Boolean(cronSecret) && request.headers.get("x-cron-secret") === cronSecret;
  if (!fromCron) {
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: request.headers.get("Authorization") || "" } } });
    const { data: isAdmin } = await caller.rpc("has_role", { p_role_key: "admin" });
    if (!isAdmin) return json({ error: "No autorizado." }, 403);
  }
  const { data: integration } = await admin.from("integrations").select("enabled,public_config").eq("provider", "mercado_libre").maybeSingle();
  if (!integration?.enabled) return json({ ok: true, skipped: "Mercado Libre no está activo." });

  let token: string;
  try { ({ token } = await mlToken(admin)); } catch (error) { return json({ error: (error as Error).message }, 503); }
  const config = integration.public_config || {};
  const siteId = String(config.site_id || "MPE");

  const { data: jobs } = await admin.from("sync_queue").select("id,action,product_id,attempts,payload")
    .in("status", ["pendiente", "error"]).lt("attempts", 5).lte("run_after", new Date().toISOString())
    .order("created_at").limit(20);
  const summary: Record<string, number> = { hecho: 0, error: 0, omitido: 0 };

  for (const job of (jobs || []) as Job[]) {
    await admin.from("sync_queue").update({ status: "procesando", attempts: job.attempts + 1 }).eq("id", job.id);
    try {
      const { data: product } = await admin.from("products")
        .select("id,name,description,price,discount_percent,image_url,is_active,brands(name),product_variants(size,color,stock,is_active),product_images(url,sort_order)")
        .eq("id", job.product_id).maybeSingle();
      const { data: listing } = await admin.from("ml_listings").select("*").eq("product_id", job.product_id).maybeSingle();
      if (!product || !listing) { await done(job.id, "omitido", "Producto o publicación no encontrados"); summary.omitido++; continue; }
      const variants = (product.product_variants || []).filter((variant: Record<string, any>) => variant.is_active);
      const stock = variants.reduce((sum: number, variant: Record<string, any>) => sum + Math.max(0, Number(variant.stock) || 0), 0);
      const markup = 1 + Number(listing.price_markup_percent || config.price_markup_percent || 0) / 100;
      const price = Math.round(Number(product.price) * (1 - Number(product.discount_percent || 0) / 100) * markup * 100) / 100;

      if (job.action === "publicar") {
        if (listing.ml_item_id) { await done(job.id, "omitido", "Ya estaba publicado"); summary.omitido++; continue; }
        let categoryId = listing.ml_category_id;
        if (!categoryId) {
          // Predictor de categorías de Mercado Libre a partir del nombre del producto.
          const guess = await mlFetch(token, `/sites/${siteId}/domain_discovery/search?limit=1&q=${encodeURIComponent(product.name)}`);
          categoryId = Array.isArray(guess) ? guess[0]?.category_id : null;
          if (!categoryId) throw new Error("No se pudo deducir la categoría: complétala en ml_category_map o en la publicación.");
        }
        const pictures = [product.image_url, ...((product.product_images || []) as Record<string, any>[]).sort((a, b) => a.sort_order - b.sort_order).map((image) => image.url)]
          .filter((url: string) => /^https:\/\//.test(url || "")).slice(0, 10).map((source: string) => ({ source }));
        const sizes = [...new Set(variants.map((variant: Record<string, any>) => variant.size))].join(", ");
        const colors = [...new Set(variants.map((variant: Record<string, any>) => variant.color))].join(", ");
        const item = await mlFetch(token, "/items", {
          method: "POST",
          body: JSON.stringify({
            title: String(product.name).slice(0, 60), category_id: categoryId, price, currency_id: "PEN",
            available_quantity: Math.max(1, stock), buying_mode: "buy_it_now", condition: "new",
            listing_type_id: listing.listing_type || config.listing_type || "gold_special", pictures,
            attributes: [{ id: "BRAND", value_name: (product.brands as Record<string, any>)?.name || "MSJ" }],
          }),
        });
        await mlFetch(token, `/items/${item.id}/description`, { method: "POST", body: JSON.stringify({ plain_text: `${product.description || product.name}\n\nTallas: ${sizes || "única"}\nColores: ${colors || "único"}\n\nMSJ Fashion Store · Envíos a todo el Perú.` }) }).catch(() => null);
        await admin.from("ml_listings").update({ ml_item_id: item.id, ml_category_id: categoryId, permalink: item.permalink, status: stock > 0 ? "activo" : "pausado", last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", listing.id);
      } else if (!listing.ml_item_id) {
        await done(job.id, "omitido", "La publicación aún no existe en Mercado Libre"); summary.omitido++; continue;
      } else if (job.action === "actualizar_stock") {
        await mlFetch(token, `/items/${listing.ml_item_id}`, { method: "PUT", body: JSON.stringify({ available_quantity: stock }) });
        await admin.from("ml_listings").update({ last_synced_at: new Date().toISOString(), last_error: null, status: stock > 0 ? "activo" : "pausado" }).eq("id", listing.id);
      } else if (job.action === "actualizar_precio") {
        await mlFetch(token, `/items/${listing.ml_item_id}`, { method: "PUT", body: JSON.stringify({ price }) });
        await admin.from("ml_listings").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", listing.id);
      } else {
        const status = { pausar: "paused", reactivar: "active", cerrar: "closed" }[job.action] || "paused";
        await mlFetch(token, `/items/${listing.ml_item_id}`, { method: "PUT", body: JSON.stringify({ status }) });
        await admin.from("ml_listings").update({ status: { paused: "pausado", active: "activo", closed: "cerrado" }[status], last_synced_at: new Date().toISOString() }).eq("id", listing.id);
      }
      await done(job.id, "hecho"); summary.hecho++;
    } catch (error) {
      const message = (error as Error).message || "Error desconocido";
      // Reintento con espera creciente: 2, 4, 8, 16 minutos.
      await admin.from("sync_queue").update({ status: "error", last_error: message.slice(0, 500), run_after: new Date(Date.now() + 2 ** (job.attempts + 1) * 60000).toISOString() }).eq("id", job.id);
      await admin.from("ml_listings").update({ last_error: message.slice(0, 500), ...(job.action === "publicar" ? { status: "error" } : {}) }).eq("product_id", job.product_id);
      summary.error++;
    }
  }
  await admin.from("integrations").update({ last_sync_at: new Date().toISOString() }).eq("provider", "mercado_libre");
  return json({ ok: true, procesados: (jobs || []).length, ...summary });

  async function done(id: number, status: string, note: string | null = null) {
    await admin.from("sync_queue").update({ status, last_error: note, done_at: new Date().toISOString() }).eq("id", id);
  }
});
