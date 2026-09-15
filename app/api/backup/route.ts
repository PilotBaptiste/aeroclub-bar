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
  "aeroclub-batches",
];

function productToRedisFormat(p: Record<string, unknown>): Record<string, unknown> {
  const { org_id: _, stock_reserve, led_start, led_end, led_color, category_id, ...rest } = p;
  return { ...rest, stockReserve: stock_reserve, ledStart: led_start, ledEnd: led_end, ledColor: led_color, category: category_id };
}

function productToSupabaseFormat(p: Record<string, unknown>, orgId: string): Record<string, unknown> {
  return {
    org_id: orgId,
    ...(p.id ? { id: p.id } : {}),
    name: p.name ?? "", emoji: p.emoji ?? "📦",
    price: Number(p.price) || 0, cost: Number(p.cost) || 0,
    stock: Number(p.stock) || 0, stock_reserve: Number(p.stockReserve) || 0,
    location: (["frigo", "cafe", "congelateur"].includes(String(p.location)) ? p.location : "frigo"),
    archived: Boolean(p.archived), position: p.position != null ? Number(p.position) : 0,
    led_start: p.ledStart != null ? Number(p.ledStart) : null,
    led_end: p.ledEnd != null ? Number(p.ledEnd) : null,
    led_color: p.ledColor ? String(p.ledColor) : null,
    category_id: p.category ? String(p.category) : null,
  };
}

async function resolveOrg(slug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("organizations").select("id").eq("slug", slug).single();
  return data?.id ?? null;
}

async function supabaseReadAll(orgSlug: string) {
  const supabase = createAdminClient();
  const { data: org } = await supabase.from("organizations").select("id, settings").eq("slug", orgSlug).single();
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
    if (!productCredits[r.member_id]) productCredits[r.member_id] = {};
    productCredits[r.member_id][r.product_id] = r.total_bought;
  }
  return {
    products: products.data ? products.data.map(p => productToRedisFormat(p as Record<string, unknown>)) : null,
    transactions: transactions.data || null,
    settings: org.settings || null,
    suggestions: suggestions.data || null,
    members: members.data || null,
    procurements: procurements.data || null,
    coffeeCredits: null,
    madeleineCredits: null,
    productCredits,
    batches: batches.data || null,
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
    await supabase.from("transactions").insert(data.transactions.map((t: Record<string, unknown>) => ({ ...t, org_id: orgId })) as never[]);
  }
  if (data.settings) {
    await supabase.from("organizations").update({ settings: data.settings as never }).eq("id", orgId);
  }
  if (Array.isArray(data.suggestions)) {
    await supabase.from("suggestions").delete().eq("org_id", orgId);
    if (data.suggestions.length > 0) await supabase.from("suggestions").insert(data.suggestions.map((s: Record<string, unknown>) => ({ ...s, org_id: orgId })) as never[]);
  }
  if (Array.isArray(data.members) && data.members.length > 0) {
    await supabase.from("members").delete().eq("org_id", orgId);
    await supabase.from("members").insert(data.members.map((m: Record<string, unknown>) => ({ ...m, org_id: orgId })) as never[]);
  }
  if (Array.isArray(data.procurements)) {
    await supabase.from("procurements").delete().eq("org_id", orgId);
    if (data.procurements.length > 0) await supabase.from("procurements").insert(data.procurements.map((p: Record<string, unknown>) => ({ ...p, org_id: orgId })) as never[]);
  }
  if (Array.isArray(data.batches)) {
    await supabase.from("batches").delete().eq("org_id", orgId);
    if (data.batches.length > 0) await supabase.from("batches").insert(data.batches.map((b: Record<string, unknown>) => ({ ...b, org_id: orgId })) as never[]);
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
