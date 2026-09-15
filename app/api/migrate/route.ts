import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { createAdminClient } from "@/lib/supabase/admin";

const KNOWN_PRODUCT_COLS = new Set([
  "id", "org_id", "name", "emoji", "price", "cost", "stock", "stock_reserve",
  "category_id", "location", "archived", "position", "led_start", "led_end",
  "led_color", "created_at", "updated_at", "extra",
]);
const CAMEL_RENAMES = new Set(["stockReserve", "ledStart", "ledEnd", "ledColor", "category"]);

export async function POST(request: Request) {
  const { authorization } = Object.fromEntries(request.headers);
  if (authorization !== "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    let { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", "acba")
      .single();

    if (!org) {
      const { data: newOrg } = await supabase
        .from("organizations")
        .insert({ slug: "acba", name: "Aéro-Club du Bassin d'Arcachon", settings: {} })
        .select("id")
        .single();
      org = newOrg;
    }
    if (!org) return NextResponse.json({ error: "Failed to get/create org" }, { status: 500 });

    const orgId = org.id;
    const counts: Record<string, number> = {};

    // ── Products (with extra JSONB for unknown fields) ──
    const products = (await kv.get("aeroclub-products")) as Array<Record<string, unknown>> | null;
    if (products && products.length > 0) {
      const rows = products.map((p, i) => {
        const extra: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(p)) {
          if (KNOWN_PRODUCT_COLS.has(k) || CAMEL_RENAMES.has(k)) continue;
          if (v !== undefined && v !== null) extra[k] = v;
        }
        return {
          org_id: orgId,
          name: String(p.name || ""),
          emoji: String(p.emoji || "📦"),
          price: Number(p.price) || 0,
          cost: Number(p.cost) || 0,
          stock: Number(p.stock) || 0,
          stock_reserve: Number(p.stockReserve) || 0,
          location: (["frigo", "cafe", "congelateur"].includes(String(p.location)) ? p.location : "frigo") as "frigo" | "cafe" | "congelateur",
          archived: Boolean(p.archived),
          position: i,
          led_start: p.ledStart != null ? Number(p.ledStart) : null,
          led_end: p.ledEnd != null ? Number(p.ledEnd) : null,
          led_color: p.ledColor ? String(p.ledColor) : null,
          category_id: p.category ? String(p.category) : null,
          extra: (Object.keys(extra).length > 0 ? extra : {}) as import("@/lib/types/database").Json,
        };
      });
      const { error } = await supabase.from("products").insert(rows);
      if (error) return NextResponse.json({ error: "Products: " + error.message }, { status: 500 });
      counts.products = rows.length;
    }

    // ── Members ──
    const members = (await kv.get("aeroclub-members")) as Array<Record<string, unknown>> | null;
    if (members && members.length > 0) {
      const rows = members.map(m => ({
        org_id: orgId,
        name: String(m.name || ""),
        email: m.email ? String(m.email) : null,
        balance: Number(m.balance) || 0,
        archived: Boolean(m.archived),
      }));
      const { error } = await supabase.from("members").insert(rows);
      if (error) return NextResponse.json({ error: "Members: " + error.message }, { status: 500 });
      counts.members = rows.length;
    }

    // ── Settings + categories ──
    const settings = await kv.get("aeroclub-settings") as Record<string, unknown> | null;
    if (settings) {
      const cats = settings.categories as Array<Record<string, unknown>> | undefined;
      if (cats && cats.length > 0) {
        const catRows = cats.map((c, i) => ({
          org_id: orgId,
          name: String(c.name || c.label || ""),
          emoji: String(c.emoji || "📂"),
          position: i,
        }));
        const { error } = await supabase.from("categories").insert(catRows);
        if (error) return NextResponse.json({ error: "Categories: " + error.message }, { status: 500 });
        counts.categories = catRows.length;
      }
      await supabase
        .from("organizations")
        .update({ settings: settings as import("@/lib/types/database").Json })
        .eq("id", orgId);
      counts.settings = 1;
    }

    // ── Transactions ──
    const transactions = (await kv.get("aeroclub-transactions")) as Array<Record<string, unknown>> | null;
    if (transactions && transactions.length > 0) {
      const rows = transactions.map(t => ({
        org_id: orgId,
        items: (typeof t.items === "string" ? t.items : JSON.stringify(t.items ?? "")) as import("@/lib/types/database").Json,
        total: Number(t.total) || 0,
        total_cost: Number(t.totalCost || t.total_cost) || 0,
        amount_paid: (t.amountPaid ?? t.amount_paid ?? null) as number | null,
        payment_method: String(t.method || t.paymentMethod || t.payment_method || "especes"),
        member_id: t.buyer ? String(t.buyer) : t.memberId ? String(t.memberId) : t.member_id ? String(t.member_id) : null,
        created_by: t.createdBy ? String(t.createdBy) : t.created_by ? String(t.created_by) : null,
        ...(t.created_at ? { created_at: String(t.created_at) } : t.date ? { created_at: String(t.date) } : {}),
      }));
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from("transactions").insert(batch);
        if (error) return NextResponse.json({ error: "Transactions batch " + i + ": " + error.message }, { status: 500 });
      }
      counts.transactions = rows.length;
    }

    // ── Suggestions ──
    const suggestions = (await kv.get("aeroclub-suggestions")) as Array<Record<string, unknown>> | null;
    if (suggestions && suggestions.length > 0) {
      const rows = suggestions.map(s => ({
        org_id: orgId,
        text: String(s.text || s.name || ""),
        status: (["pending", "accepted", "rejected"].includes(String(s.status)) ? s.status : "pending") as "pending" | "accepted" | "rejected",
      }));
      const { error } = await supabase.from("suggestions").insert(rows);
      if (error) return NextResponse.json({ error: "Suggestions: " + error.message }, { status: 500 });
      counts.suggestions = rows.length;
    }

    // ── Procurements ──
    const procurements = (await kv.get("aeroclub-procurements")) as Array<Record<string, unknown>> | null;
    if (procurements && procurements.length > 0) {
      const rows = procurements.map(p => ({
        org_id: orgId,
        product_id: String(p.productId || p.product_id || ""),
        product_name: String(p.productName || p.product_name || ""),
        quantity: Number(p.quantity || p.qty) || 0,
        unit_cost: Number(p.unitCost || p.unit_cost) || 0,
        total_cost: Number(p.totalCost || p.total_cost) || 0,
        payment_method: String(p.method || p.paymentMethod || p.payment_method || "especes"),
        supplier: p.supplier ? String(p.supplier) : null,
        created_by: p.createdBy ? String(p.createdBy) : p.created_by ? String(p.created_by) : null,
        ...(p.created_at ? { created_at: String(p.created_at) } : p.date ? { created_at: String(p.date) } : {}),
      }));
      const { error } = await supabase.from("procurements").insert(rows);
      if (error) return NextResponse.json({ error: "Procurements: " + error.message }, { status: 500 });
      counts.procurements = rows.length;
    }

    // ── Batches ──
    const batches = (await kv.get("aeroclub-batches")) as Array<Record<string, unknown>> | null;
    if (batches && batches.length > 0) {
      const rows = batches.map(b => ({
        org_id: orgId,
        product_id: String(b.productId || b.product_id || ""),
        quantity: Number(b.quantity || b.qty) || 0,
        location: String(b.location ?? "frigo"),
        unit_cost: Number(b.unitCost || b.unit_cost) || 0,
        expiry_date: b.expiryDate ? String(b.expiryDate) : b.expiry_date ? String(b.expiry_date) : null,
        ...(b.created_at ? { created_at: String(b.created_at) } : b.purchaseDate ? { created_at: String(b.purchaseDate) } : {}),
      }));
      const { error } = await supabase.from("batches").insert(rows);
      if (error) return NextResponse.json({ error: "Batches: " + error.message }, { status: 500 });
      counts.batches = rows.length;
    }

    // ── Product Credits ──
    const productCredits = (await kv.get("aeroclub-product-credits")) as Record<string, Record<string, number>> | null;
    if (productCredits) {
      const rows: Array<{ org_id: string; member_id: string; product_id: string; type: "product"; total_bought: number; free_earned: number }> = [];
      for (const [memberId, products] of Object.entries(productCredits)) {
        for (const [productId, count] of Object.entries(products as Record<string, number>)) {
          rows.push({ org_id: orgId, member_id: memberId, product_id: productId, type: "product", total_bought: Number(count) || 0, free_earned: 0 });
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase.from("credits").insert(rows);
        if (error) return NextResponse.json({ error: "Credits: " + error.message }, { status: 500 });
        counts.credits = rows.length;
      }
    }

    return NextResponse.json({ success: true, migrated: counts });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
