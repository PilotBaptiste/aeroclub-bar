import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

// Table row insert types (shorthand)
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];
type SuggestionInsert = Database["public"]["Tables"]["suggestions"]["Insert"];
type MemberInsert = Database["public"]["Tables"]["members"]["Insert"];
type ProcurementInsert = Database["public"]["Tables"]["procurements"]["Insert"];
type CreditInsert = Database["public"]["Tables"]["credits"]["Insert"];
type BatchInsert = Database["public"]["Tables"]["batches"]["Insert"];
type Json = Database["public"]["Tables"]["organizations"]["Row"]["settings"];

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

/** Resolve an org slug to its UUID. Returns null when not found. */
async function resolveOrgId(slug: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return data.id;
}

/** Known Supabase product columns (excludes org_id, created_at, updated_at, extra). */
const KNOWN_PRODUCT_COLS = new Set([
  "id", "org_id", "name", "emoji", "price", "cost", "stock", "stock_reserve",
  "category_id", "location", "archived", "position", "led_start", "led_end",
  "led_color", "created_at", "updated_at", "extra",
]);

/** Convert a Supabase product row (snake_case) to the Redis/camelCase shape. */
function productToRedisFormat(p: Record<string, unknown>): Record<string, unknown> {
  const { org_id: _, stock_reserve, led_start, led_end, led_color, category_id, extra, created_at: _ca, updated_at: _ua, ...rest } = p;
  const extraObj = (typeof extra === "object" && extra !== null ? extra : {}) as Record<string, unknown>;
  return {
    ...rest,
    ...extraObj,
    stockReserve: stock_reserve,
    ledStart: led_start,
    ledEnd: led_end,
    ledColor: led_color,
    category: category_id,
  };
}

/** Redis camelCase keys → Supabase snake_case equivalents for extraction. */
const CAMEL_TO_SNAKE: Record<string, string> = {
  stockReserve: "stock_reserve", ledStart: "led_start", ledEnd: "led_end",
  ledColor: "led_color", category: "category_id",
};

/** Convert a Redis/camelCase product back to Supabase snake_case columns + extra JSONB. */
function productToSupabaseFormat(
  p: Record<string, unknown>,
  orgId: string
): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (k in CAMEL_TO_SNAKE) continue;
    if (KNOWN_PRODUCT_COLS.has(k)) continue;
    if (v !== undefined && v !== null) extra[k] = v;
  }
  return {
    org_id: orgId,
    ...(p.id ? { id: p.id } : {}),
    name: p.name ?? "",
    emoji: p.emoji ?? "📦",
    price: Number(p.price) || 0,
    cost: Number(p.cost) || 0,
    stock: Number(p.stock) || 0,
    stock_reserve: Number(p.stockReserve) || 0,
    location: (["frigo", "cafe", "congelateur"].includes(String(p.location)) ? p.location : "frigo"),
    archived: Boolean(p.archived),
    position: p.position != null ? Number(p.position) : 0,
    led_start: p.ledStart != null ? Number(p.ledStart) : null,
    led_end: p.ledEnd != null ? Number(p.ledEnd) : null,
    led_color: p.ledColor ? String(p.ledColor) : null,
    category_id: p.category ? String(p.category) : null,
    extra: Object.keys(extra).length > 0 ? extra : {},
  };
}

/** Supabase transaction → Redis format */
function transactionToRedisFormat(t: Record<string, unknown>): Record<string, unknown> {
  const items = t.items;
  return {
    id: t.id,
    items: typeof items === "string" ? items : (items ? JSON.stringify(items) : ""),
    total: t.total ?? 0,
    totalCost: t.total_cost ?? t.totalCost ?? 0,
    buyer: t.member_id ?? t.buyer ?? "",
    date: t.created_at ?? t.date ?? "",
    method: t.payment_method ?? t.method ?? "especes",
    amountPaid: t.amount_paid ?? t.amountPaid ?? null,
  };
}

/** Redis transaction → Supabase format */
function transactionToSupabaseFormat(t: Record<string, unknown>, orgId: string): Record<string, unknown> {
  const items = t.items;
  return {
    org_id: orgId,
    ...(t.id ? { id: t.id } : {}),
    items: typeof items === "string" ? items : JSON.stringify(items ?? ""),
    total: Number(t.total) || 0,
    total_cost: Number(t.totalCost ?? t.total_cost) || 0,
    amount_paid: t.amountPaid ?? t.amount_paid ?? null,
    payment_method: t.method ?? t.payment_method ?? "especes",
    member_id: t.buyer ?? t.member_id ?? null,
    created_by: t.createdBy ?? t.created_by ?? null,
    ...(t.date ? { created_at: t.date } : t.created_at ? { created_at: t.created_at } : {}),
  };
}

/** Supabase member → Redis format (mostly same, strip org_id) */
function memberToRedisFormat(m: Record<string, unknown>): Record<string, unknown> {
  const { org_id: _, created_at: _ca, updated_at: _ua, ...rest } = m;
  return rest;
}

/** Supabase suggestion → Redis format */
function suggestionToRedisFormat(s: Record<string, unknown>): Record<string, unknown> {
  return {
    id: s.id,
    text: s.text ?? "",
    author: s.author ?? "",
    date: s.created_at ?? s.date ?? "",
    status: s.status,
  };
}

/** Redis suggestion → Supabase format */
function suggestionToSupabaseFormat(s: Record<string, unknown>, orgId: string): Record<string, unknown> {
  return {
    org_id: orgId,
    ...(s.id ? { id: s.id } : {}),
    text: String(s.text || s.name || ""),
    author: s.author ?? null,
    status: (["pending", "accepted", "rejected"].includes(String(s.status)) ? s.status : "pending"),
    ...(s.date ? { created_at: s.date } : s.created_at ? { created_at: s.created_at } : {}),
  };
}

/** Supabase procurement → Redis format */
function procurementToRedisFormat(p: Record<string, unknown>): Record<string, unknown> {
  return {
    id: p.id,
    date: p.created_at ?? p.date ?? "",
    productId: p.product_id ?? p.productId ?? "",
    productName: p.product_name ?? p.productName ?? "",
    qty: p.quantity ?? p.qty ?? 0,
    unitCost: p.unit_cost ?? p.unitCost ?? 0,
    totalCost: p.total_cost ?? p.totalCost ?? 0,
    method: p.payment_method ?? p.method ?? "especes",
    supplier: p.supplier ?? null,
  };
}

/** Redis procurement → Supabase format */
function procurementToSupabaseFormat(p: Record<string, unknown>, orgId: string): Record<string, unknown> {
  return {
    org_id: orgId,
    ...(p.id ? { id: p.id } : {}),
    product_id: p.productId ?? p.product_id ?? "",
    product_name: p.productName ?? p.product_name ?? "",
    quantity: Number(p.qty ?? p.quantity) || 0,
    unit_cost: Number(p.unitCost ?? p.unit_cost) || 0,
    total_cost: Number(p.totalCost ?? p.total_cost) || 0,
    payment_method: p.method ?? p.payment_method ?? "especes",
    supplier: p.supplier ?? null,
    created_by: p.createdBy ?? p.created_by ?? null,
    ...(p.date ? { created_at: p.date } : p.created_at ? { created_at: p.created_at } : {}),
  };
}

/** Supabase batch → Redis format */
function batchToRedisFormat(b: Record<string, unknown>): Record<string, unknown> {
  return {
    id: b.id,
    productId: b.product_id ?? b.productId ?? "",
    qty: b.quantity ?? b.qty ?? 0,
    location: b.location ?? "frigo",
    purchaseDate: b.created_at ?? b.purchaseDate ?? "",
    expiryDate: b.expiry_date ?? b.expiryDate ?? null,
    unitCost: b.unit_cost ?? b.unitCost ?? 0,
  };
}

/** Redis batch → Supabase format */
function batchToSupabaseFormat(b: Record<string, unknown>, orgId: string): Record<string, unknown> {
  return {
    org_id: orgId,
    ...(b.id ? { id: b.id } : {}),
    product_id: b.productId ?? b.product_id ?? "",
    quantity: Number(b.qty ?? b.quantity) || 0,
    location: b.location ?? "frigo",
    unit_cost: Number(b.unitCost ?? b.unit_cost) || 0,
    expiry_date: b.expiryDate ?? b.expiry_date ?? null,
    ...(b.purchaseDate ? { created_at: b.purchaseDate } : b.created_at ? { created_at: b.created_at } : {}),
  };
}

/** Credits table rows → Redis productCredits shape: Record<productId, Record<memberName, count>> */
function creditsToRedisFormat(
  rows: Array<{ member_id: string; product_id: string | null; total_bought: number }>
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!r.product_id) continue;
    if (!out[r.product_id]) out[r.product_id] = {};
    out[r.product_id][r.member_id] = r.total_bought;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Supabase GET – read all data for an org and return the same shape as Redis
// ---------------------------------------------------------------------------

async function supabaseGet(orgSlug: string) {
  const supabase = createAdminClient();

  // Resolve org
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, settings")
    .eq("slug", orgSlug)
    .single();

  if (orgErr || !org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const orgId = org.id;

  // Parallel fetches
  const [
    productsRes,
    transactionsRes,
    suggestionsRes,
    membersRes,
    procurementsRes,
    creditsRes,
    batchesRes,
  ] = await Promise.all([
    supabase.from("products").select("*").eq("org_id", orgId).order("position"),
    supabase.from("transactions").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("suggestions").select("*").eq("org_id", orgId),
    supabase.from("members").select("*").eq("org_id", orgId),
    supabase.from("procurements").select("*").eq("org_id", orgId),
    supabase.from("credits").select("member_id, product_id, total_bought").eq("org_id", orgId).eq("type", "product"),
    supabase.from("batches").select("*").eq("org_id", orgId),
  ]);

  return NextResponse.json({
    products: productsRes.data ? productsRes.data.map(p => productToRedisFormat(p as Record<string, unknown>)) : null,
    transactions: transactionsRes.data ? transactionsRes.data.map(t => transactionToRedisFormat(t as Record<string, unknown>)) : null,
    settings: (() => {
      const raw = (org.settings as Record<string, unknown>) || {};
      const { sumupApiKey, sumupReaderId, sumupAffiliateKey, ...safe } = raw;
      return { clubName: org.name, ...safe };
    })(),
    suggestions: suggestionsRes.data ? suggestionsRes.data.map(s => suggestionToRedisFormat(s as Record<string, unknown>)) : null,
    members: membersRes.data ? membersRes.data.map(m => memberToRedisFormat(m as Record<string, unknown>)) : null,
    procurements: procurementsRes.data ? procurementsRes.data.map(p => procurementToRedisFormat(p as Record<string, unknown>)) : null,
    coffeeCredits: null,
    madeleineCredits: null,
    productCredits: creditsRes.data ? creditsToRedisFormat(creditsRes.data as Array<{ member_id: string; product_id: string | null; total_bought: number }>) : {},
    batches: batchesRes.data ? batchesRes.data.map(b => batchToRedisFormat(b as Record<string, unknown>)) : null,
  });
}

// ---------------------------------------------------------------------------
// Supabase POST – write a single key's data for an org
// ---------------------------------------------------------------------------

async function supabasePost(orgSlug: string, key: string, value: unknown) {
  const orgId = await resolveOrgId(orgSlug);
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const supabase = createAdminClient();

  switch (key) {
    // --- Products ---
    case "aeroclub-products": {
      if (!Array.isArray(value)) {
        return NextResponse.json({ error: "Expected array for products" }, { status: 400 });
      }
      // Delete existing, then insert new rows
      await supabase.from("products").delete().eq("org_id", orgId);
      if (value.length > 0) {
        const rows = value.map((p: Record<string, unknown>) => productToSupabaseFormat(p, orgId)) as ProductInsert[];
        const { error } = await supabase.from("products").insert(rows);
        if (error) {
          console.error("Supabase products insert error:", error);
          return NextResponse.json({ error: "Failed to write products" }, { status: 500 });
        }
      }
      break;
    }

    // --- Transactions ---
    case "aeroclub-transactions": {
      if (!Array.isArray(value)) {
        return NextResponse.json({ error: "Expected array for transactions" }, { status: 400 });
      }
      await supabase.from("transactions").delete().eq("org_id", orgId);
      if (value.length > 0) {
        const rows = value.map((t: Record<string, unknown>) => transactionToSupabaseFormat(t, orgId)) as TransactionInsert[];
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) {
          console.error("Supabase transactions insert error:", error);
          return NextResponse.json({ error: "Failed to write transactions" }, { status: 500 });
        }
      }
      break;
    }

    // --- Settings ---
    case "aeroclub-settings": {
      const { error } = await supabase
        .from("organizations")
        .update({ settings: value as Json })
        .eq("id", orgId);
      if (error) {
        console.error("Supabase settings update error:", error);
        return NextResponse.json({ error: "Failed to write settings" }, { status: 500 });
      }
      break;
    }

    // --- Suggestions ---
    case "aeroclub-suggestions": {
      if (!Array.isArray(value)) {
        return NextResponse.json({ error: "Expected array for suggestions" }, { status: 400 });
      }
      await supabase.from("suggestions").delete().eq("org_id", orgId);
      if (value.length > 0) {
        const rows = value.map((s: Record<string, unknown>) => suggestionToSupabaseFormat(s, orgId)) as SuggestionInsert[];
        const { error } = await supabase.from("suggestions").insert(rows);
        if (error) {
          console.error("Supabase suggestions insert error:", error);
          return NextResponse.json({ error: "Failed to write suggestions" }, { status: 500 });
        }
      }
      break;
    }

    // --- Members ---
    case "aeroclub-members": {
      if (!Array.isArray(value)) {
        return NextResponse.json({ error: "Expected array for members" }, { status: 400 });
      }
      await supabase.from("members").delete().eq("org_id", orgId);
      if (value.length > 0) {
        const rows = value.map((m: Record<string, unknown>) => ({
          org_id: orgId,
          ...(m.id ? { id: m.id } : {}),
          name: String(m.name || ""),
          email: m.email ? String(m.email) : null,
          balance: Number(m.balance) || 0,
          archived: Boolean(m.archived),
        })) as MemberInsert[];
        const { error } = await supabase.from("members").insert(rows);
        if (error) {
          console.error("Supabase members insert error:", error);
          return NextResponse.json({ error: "Failed to write members" }, { status: 500 });
        }
      }
      break;
    }

    // --- Procurements ---
    case "aeroclub-procurements": {
      if (!Array.isArray(value)) {
        return NextResponse.json({ error: "Expected array for procurements" }, { status: 400 });
      }
      await supabase.from("procurements").delete().eq("org_id", orgId);
      if (value.length > 0) {
        const rows = value.map((p: Record<string, unknown>) => procurementToSupabaseFormat(p, orgId)) as ProcurementInsert[];
        const { error } = await supabase.from("procurements").insert(rows);
        if (error) {
          console.error("Supabase procurements insert error:", error);
          return NextResponse.json({ error: "Failed to write procurements" }, { status: 500 });
        }
      }
      break;
    }

    // --- Product Credits ---
    case "aeroclub-product-credits": {
      // value is Record<memberId, Record<productId, count>>
      const credits = value as Record<string, Record<string, number>>;
      await supabase.from("credits").delete().eq("org_id", orgId).eq("type", "product");
      const rows: CreditInsert[] = [];
      for (const [memberId, products] of Object.entries(credits)) {
        for (const [productId, totalBought] of Object.entries(products)) {
          rows.push({
            org_id: orgId,
            member_id: memberId,
            product_id: productId,
            type: "product",
            total_bought: totalBought,
            free_earned: 0,
          });
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase.from("credits").insert(rows);
        if (error) {
          console.error("Supabase credits insert error:", error);
          return NextResponse.json({ error: "Failed to write credits" }, { status: 500 });
        }
      }
      break;
    }

    // --- Batches ---
    case "aeroclub-batches": {
      if (!Array.isArray(value)) {
        return NextResponse.json({ error: "Expected array for batches" }, { status: 400 });
      }
      await supabase.from("batches").delete().eq("org_id", orgId);
      if (value.length > 0) {
        const rows = value.map((b: Record<string, unknown>) => batchToSupabaseFormat(b, orgId)) as BatchInsert[];
        const { error } = await supabase.from("batches").insert(rows);
        if (error) {
          console.error("Supabase batches insert error:", error);
          return NextResponse.json({ error: "Failed to write batches" }, { status: 500 });
        }
      }
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid key for Supabase mode" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Redis (original) GET / POST – kept identical
// ---------------------------------------------------------------------------

async function redisGet() {
  const products = await kv.get("aeroclub-products");
  const transactions = await kv.get("aeroclub-transactions");
  const settings = await kv.get("aeroclub-settings");
  const suggestions = await kv.get("aeroclub-suggestions");
  const members = await kv.get("aeroclub-members");
  const procurements = await kv.get("aeroclub-procurements");
  const coffeeCredits = await kv.get("aeroclub-coffee-credits");
  const madeleineCredits = await kv.get("aeroclub-madeleine-credits");
  const productCredits = await kv.get("aeroclub-product-credits");
  const batches = await kv.get("aeroclub-batches");
  return NextResponse.json({
    products: products || null,
    transactions: transactions || null,
    settings: settings || null,
    suggestions: suggestions || null,
    members: members || null,
    procurements: procurements || null,
    coffeeCredits: coffeeCredits || null,
    madeleineCredits: madeleineCredits || null,
    productCredits: productCredits || null,
    batches: batches || null,
  });
}

const ALLOWED_KEYS = [
  "aeroclub-products",
  "aeroclub-transactions",
  "aeroclub-settings",
  "aeroclub-suggestions",
  "aeroclub-members",
  "aeroclub-procurements",
  "aeroclub-coffee-credits",
  "aeroclub-madeleine-credits",
  "aeroclub-product-credits",
  "aeroclub-batches",
];

async function redisPost(key: string, value: unknown) {
  // Safety check: prevent overwriting real data with empty/default arrays
  // If the new value is an array with <= 6 items (default products count),
  // and the existing value has more items, block the write unless force=true
  if (key === "aeroclub-products" && Array.isArray(value)) {
    const existing = await kv.get(key);
    if (Array.isArray(existing) && existing.length > 6 && value.length <= 6) {
      console.warn(`BLOCKED: attempt to overwrite ${key} (${existing.length} items) with only ${value.length} items`);
      return NextResponse.json({ error: "Blocked: would overwrite larger dataset with smaller one", blocked: true }, { status: 409 });
    }
  }

  await kv.set(key, value);
  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const org = searchParams.get("org");

    if (org) {
      return await supabaseGet(org);
    }

    return await redisGet();
  } catch (e) {
    console.error("Data read error:", e);
    return NextResponse.json({ error: "DB read error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const org = searchParams.get("org");
    const { key, value } = await request.json();

    if (!key)
      return NextResponse.json({ error: "Key required" }, { status: 400 });
    if (!ALLOWED_KEYS.includes(key))
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });

    if (org) {
      return await supabasePost(org, key, value);
    }

    return await redisPost(key, value);
  } catch (e) {
    console.error("Data write error:", e);
    return NextResponse.json({ error: "DB write error" }, { status: 500 });
  }
}
