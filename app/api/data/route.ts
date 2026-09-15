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

/** Convert a Supabase product row (snake_case) to the Redis/camelCase shape. */
function productToRedisFormat(p: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { org_id, stock_reserve, led_start, led_end, led_color, category_id, ...rest } = p;
  return {
    ...rest,
    stockReserve: stock_reserve,
    ledStart: led_start,
    ledEnd: led_end,
    ledColor: led_color,
    category: category_id,
  };
}

/** Convert a Redis/camelCase product back to Supabase snake_case columns. Only known columns. */
function productToSupabaseFormat(
  p: Record<string, unknown>,
  orgId: string
): Record<string, unknown> {
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
  };
}

/**
 * Convert the credits table rows into the Redis productCredits shape:
 *   Record<memberId, Record<productId, total_bought>>
 */
function creditsToRedisFormat(
  rows: Array<{ member_id: string; product_id: string | null; total_bought: number }>
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!r.product_id) continue;
    if (!out[r.member_id]) out[r.member_id] = {};
    out[r.member_id][r.product_id] = r.total_bought;
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
    .select("id, settings")
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
    products: productsRes.data ? productsRes.data.map(productToRedisFormat) : null,
    transactions: transactionsRes.data || null,
    settings: org.settings || null,
    suggestions: suggestionsRes.data || null,
    members: membersRes.data || null,
    procurements: procurementsRes.data || null,
    coffeeCredits: null,
    madeleineCredits: null,
    productCredits: creditsRes.data ? creditsToRedisFormat(creditsRes.data as Array<{ member_id: string; product_id: string | null; total_bought: number }>) : {},
    batches: batchesRes.data || null,
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
        const rows = value.map((t: Record<string, unknown>) => ({ ...t, org_id: orgId })) as TransactionInsert[];
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
        const rows = value.map((s: Record<string, unknown>) => ({ ...s, org_id: orgId })) as SuggestionInsert[];
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
        const rows = value.map((m: Record<string, unknown>) => ({ ...m, org_id: orgId })) as MemberInsert[];
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
        const rows = value.map((p: Record<string, unknown>) => ({ ...p, org_id: orgId })) as ProcurementInsert[];
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
        const rows = value.map((b: Record<string, unknown>) => ({ ...b, org_id: orgId })) as BatchInsert[];
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
