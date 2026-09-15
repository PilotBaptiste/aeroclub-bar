import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DATA_KEYS = [
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

const KNOWN_PRODUCT_COLS = new Set([
  "id", "org_id", "name", "emoji", "price", "cost", "stock", "stock_reserve",
  "category_id", "location", "archived", "position", "led_start", "led_end",
  "led_color", "created_at", "updated_at", "extra",
]);
const CAMEL_TO_SNAKE: Record<string, string> = {
  stockReserve: "stock_reserve", ledStart: "led_start", ledEnd: "led_end",
  ledColor: "led_color", category: "category_id",
};

function productToRedisFormat(p: Record<string, unknown>): Record<string, unknown> {
  const { org_id: _, stock_reserve, led_start, led_end, led_color, category_id, extra, created_at: _ca, updated_at: _ua, ...rest } = p;
  const extraObj = (typeof extra === "object" && extra !== null ? extra : {}) as Record<string, unknown>;
  return { ...rest, ...extraObj, stockReserve: stock_reserve, ledStart: led_start, ledEnd: led_end, ledColor: led_color, category: category_id };
}

function productToSupabaseFormat(p: Record<string, unknown>, orgId: string): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (k in CAMEL_TO_SNAKE || KNOWN_PRODUCT_COLS.has(k)) continue;
    if (v !== undefined && v !== null) extra[k] = v;
  }
  return {
    org_id: orgId, ...(p.id ? { id: p.id } : {}),
    name: p.name ?? "", emoji: p.emoji ?? "📦",
    price: Number(p.price) || 0, cost: Number(p.cost) || 0,
    stock: Number(p.stock) || 0, stock_reserve: Number(p.stockReserve) || 0,
    location: (["frigo", "cafe", "congelateur"].includes(String(p.location)) ? p.location : "frigo"),
    archived: Boolean(p.archived), position: p.position != null ? Number(p.position) : 0,
    led_start: p.ledStart != null ? Number(p.ledStart) : null,
    led_end: p.ledEnd != null ? Number(p.ledEnd) : null,
    led_color: p.ledColor ? String(p.ledColor) : null,
    category_id: p.category ? String(p.category) : null,
    extra: Object.keys(extra).length > 0 ? extra : {},
  };
}

async function resolveOrg(slug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("organizations").select("id").eq("slug", slug).single();
  return data?.id ?? null;
}

async function supabaseReadAll(orgSlug: string) {
  const supabase = createAdminClient();
  const { data: org } = await supabase.from("organizations").select("id, name, settings").eq("slug", orgSlug).single();
  if (!org) return null;
  const orgId = org.id;
  const [products, transactions, suggestions, members, procurements, credits, batches] = await Promise.all([
    supabase.from("products").select("*").eq("org_id", orgId).order("position"),
    supabase.from("transactions").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("suggestions").select("*").eq("org_id", orgId),
    supabase.from("members").select("*").eq("org_id", orgId),
    supabase.from("procurements").select("*").eq("org_id", orgId),
    supabase.from("credits").select("member_id, product_id, total_bought").eq("org_id", orgId).eq("type", "product"),
    supabase.from("batches").select("*").eq("org_id", orgId),
  ]);
  const productCredits: Record<string, Record<string, number>> = {};
  for (const r of (credits.data || []) as Array<{ member_id: string; product_id: string | null; total_bought: number }>) {
    if (!r.product_id) continue;
    if (!productCredits[r.product_id]) productCredits[r.product_id] = {};
    productCredits[r.product_id][r.member_id] = r.total_bought;
  }
  const txToRedis = (t: Record<string, unknown>) => {
    const items = t.items;
    return {
      id: t.id, items: typeof items === "string" ? items : (items ? JSON.stringify(items) : ""),
      total: t.total ?? 0, totalCost: t.total_cost ?? t.totalCost ?? 0,
      buyer: t.member_id ?? "", date: t.created_at ?? "", method: t.payment_method ?? "especes",
      amountPaid: t.amount_paid ?? null,
    };
  };
  const sugToRedis = (s: Record<string, unknown>) => ({
    id: s.id, text: s.text ?? "", author: s.author ?? "", date: s.created_at ?? "",
  });
  const memToRedis = (m: Record<string, unknown>) => {
    const { org_id: _, created_at: _ca, updated_at: _ua, ...rest } = m; return rest;
  };
  const procToRedis = (p: Record<string, unknown>) => ({
    id: p.id, date: p.created_at ?? "", productId: p.product_id ?? "", productName: p.product_name ?? "",
    qty: p.quantity ?? 0, unitCost: p.unit_cost ?? 0, totalCost: p.total_cost ?? 0, method: p.payment_method ?? "especes",
  });
  const batchToRedis = (b: Record<string, unknown>) => ({
    id: b.id, productId: b.product_id ?? "", qty: b.quantity ?? 0, location: b.location ?? "frigo",
    purchaseDate: b.created_at ?? "", expiryDate: b.expiry_date ?? null, unitCost: b.unit_cost ?? 0,
  });
  return {
    products: products.data ? products.data.map(p => productToRedisFormat(p as Record<string, unknown>)) : null,
    transactions: transactions.data ? transactions.data.map(t => txToRedis(t as Record<string, unknown>)) : null,
    settings: { clubName: org.name, ...((org.settings as Record<string, unknown>) || {}) },
    suggestions: suggestions.data ? suggestions.data.map(s => sugToRedis(s as Record<string, unknown>)) : null,
    members: members.data ? members.data.map(m => memToRedis(m as Record<string, unknown>)) : null,
    procurements: procurements.data ? procurements.data.map(p => procToRedis(p as Record<string, unknown>)) : null,
    coffeeCredits: null,
    madeleineCredits: null,
    productCredits,
    batches: batches.data ? batches.data.map(b => batchToRedis(b as Record<string, unknown>)) : null,
  };
}

function txToSupabase(t: Record<string, unknown>, orgId: string) {
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
function sugToSupabase(s: Record<string, unknown>, orgId: string) {
  return {
    org_id: orgId, ...(s.id ? { id: s.id } : {}),
    text: String(s.text || s.name || ""), author: s.author ?? null,
    status: (["pending", "accepted", "rejected"].includes(String(s.status)) ? s.status : "pending"),
    ...(s.date ? { created_at: s.date } : s.created_at ? { created_at: s.created_at } : {}),
  };
}
function memToSupabase(m: Record<string, unknown>, orgId: string) {
  return {
    org_id: orgId, ...(m.id ? { id: m.id } : {}),
    name: String(m.name || ""), email: m.email ? String(m.email) : null,
    balance: Number(m.balance) || 0, archived: Boolean(m.archived),
  };
}
function procToSupabase(p: Record<string, unknown>, orgId: string) {
  return {
    org_id: orgId, ...(p.id ? { id: p.id } : {}),
    product_id: p.productId ?? p.product_id ?? "",
    product_name: p.productName ?? p.product_name ?? "",
    quantity: Number(p.qty ?? p.quantity) || 0,
    unit_cost: Number(p.unitCost ?? p.unit_cost) || 0,
    total_cost: Number(p.totalCost ?? p.total_cost) || 0,
    payment_method: p.method ?? p.payment_method ?? "especes",
    supplier: p.supplier ?? null,
    ...(p.date ? { created_at: p.date } : p.created_at ? { created_at: p.created_at } : {}),
  };
}
function batchToSupabase(b: Record<string, unknown>, orgId: string) {
  return {
    org_id: orgId, ...(b.id ? { id: b.id } : {}),
    product_id: b.productId ?? b.product_id ?? "",
    quantity: Number(b.qty ?? b.quantity) || 0,
    location: b.location ?? "frigo",
    unit_cost: Number(b.unitCost ?? b.unit_cost) || 0,
    expiry_date: b.expiryDate ?? b.expiry_date ?? null,
    ...(b.purchaseDate ? { created_at: b.purchaseDate } : b.created_at ? { created_at: b.created_at } : {}),
  };
}

async function supabaseWriteAll(orgSlug: string, data: Record<string, unknown>) {
  const orgId = await resolveOrg(orgSlug);
  if (!orgId) return false;
  const supabase = createAdminClient();

  if (Array.isArray(data.products) && data.products.length > 0) {
    await supabase.from("products").delete().eq("org_id", orgId);
    await supabase.from("products").insert(data.products.map((p: Record<string, unknown>) => productToSupabaseFormat(p, orgId)) as never[]);
  }
  if (Array.isArray(data.transactions) && data.transactions.length > 0) {
    await supabase.from("transactions").delete().eq("org_id", orgId);
    await supabase.from("transactions").insert(data.transactions.map((t: Record<string, unknown>) => txToSupabase(t, orgId)) as never[]);
  }
  if (data.settings) {
    await supabase.from("organizations").update({ settings: data.settings as never }).eq("id", orgId);
  }
  if (Array.isArray(data.suggestions)) {
    await supabase.from("suggestions").delete().eq("org_id", orgId);
    if (data.suggestions.length > 0) await supabase.from("suggestions").insert(data.suggestions.map((s: Record<string, unknown>) => sugToSupabase(s, orgId)) as never[]);
  }
  if (Array.isArray(data.members) && data.members.length > 0) {
    await supabase.from("members").delete().eq("org_id", orgId);
    await supabase.from("members").insert(data.members.map((m: Record<string, unknown>) => memToSupabase(m, orgId)) as never[]);
  }
  if (Array.isArray(data.procurements)) {
    await supabase.from("procurements").delete().eq("org_id", orgId);
    if (data.procurements.length > 0) await supabase.from("procurements").insert(data.procurements.map((p: Record<string, unknown>) => procToSupabase(p, orgId)) as never[]);
  }
  if (Array.isArray(data.batches)) {
    await supabase.from("batches").delete().eq("org_id", orgId);
    if (data.batches.length > 0) await supabase.from("batches").insert(data.batches.map((b: Record<string, unknown>) => batchToSupabase(b, orgId)) as never[]);
  }
  return true;
}

// GET — Récupérer le backup
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const org = searchParams.get("org");

    if (org) {
      const snapshot = await kv.get(`backup-snapshot-${org}`);
      if (!snapshot) return NextResponse.json({ error: "Aucun backup trouvé" }, { status: 404 });
      return NextResponse.json(snapshot);
    }

    const backup = await kv.get("aeroclub-backup-snapshot");
    if (!backup) return NextResponse.json({ error: "Aucun backup trouvé" }, { status: 404 });
    return NextResponse.json(backup);
  } catch (e) {
    console.error("Backup read error:", e);
    return NextResponse.json({ error: "Erreur lecture backup" }, { status: 500 });
  }
}

// POST — Créer un backup OU restaurer depuis un backup
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const org = searchParams.get("org");
    const body = await request.json();
    const action = body.action;

    if (org) {
      if (action === "save") {
        const allData = await supabaseReadAll(org);
        if (!allData) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
        const snapshot = { ...allData, _backupDate: new Date().toISOString(), _version: 1 };
        await kv.set(`backup-snapshot-${org}`, snapshot);
        return NextResponse.json({ ok: true, date: snapshot._backupDate });
      }
      if (action === "restore") {
        const snapshot = (await kv.get(`backup-snapshot-${org}`)) as Record<string, unknown> | null;
        if (!snapshot) return NextResponse.json({ error: "Aucun backup à restaurer" }, { status: 404 });
        const ok = await supabaseWriteAll(org, snapshot);
        if (!ok) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
        return NextResponse.json({ ok: true, restoredFrom: snapshot._backupDate });
      }
      if (action === "restore-upload") {
        const data = body.data;
        if (!data || !data.products) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
        const ok = await supabaseWriteAll(org, data);
        if (!ok) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    // Redis mode (original)
    if (action === "save") {
      const snapshot: Record<string, unknown> = {};
      for (const key of DATA_KEYS) {
        const val = await kv.get(key);
        snapshot[key] = val;
      }
      snapshot["_backupDate"] = new Date().toISOString();
      snapshot["_version"] = 1;
      await kv.set("aeroclub-backup-snapshot", snapshot);
      return NextResponse.json({ ok: true, date: snapshot["_backupDate"] });
    }

    if (action === "restore") {
      const backup = (await kv.get("aeroclub-backup-snapshot")) as Record<string, unknown> | null;
      if (!backup) return NextResponse.json({ error: "Aucun backup à restaurer" }, { status: 404 });
      for (const key of DATA_KEYS) {
        if (backup[key] !== undefined && backup[key] !== null) {
          await kv.set(key, backup[key]);
        }
      }
      return NextResponse.json({ ok: true, restoredFrom: backup["_backupDate"] });
    }

    if (action === "restore-upload") {
      const data = body.data;
      if (!data || !data.products) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
      const keyMap: Record<string, string> = {
        products: "aeroclub-products",
        transactions: "aeroclub-transactions",
        settings: "aeroclub-settings",
        suggestions: "aeroclub-suggestions",
        members: "aeroclub-members",
        procurements: "aeroclub-procurements",
        coffeeCredits: "aeroclub-coffee-credits",
        madeleineCredits: "aeroclub-madeleine-credits",
        batches: "aeroclub-batches",
      };
      for (const [jsonKey, redisKey] of Object.entries(keyMap)) {
        if (data[jsonKey] !== undefined && data[jsonKey] !== null) {
          await kv.set(redisKey, data[jsonKey]);
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Action invalide (save/restore/restore-upload)" }, { status: 400 });
  } catch (e) {
    console.error("Backup error:", e);
    return NextResponse.json({ error: "Erreur backup" }, { status: 500 });
  }
}
