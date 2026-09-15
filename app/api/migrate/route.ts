import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { authorization } = Object.fromEntries(request.headers);
  if (authorization !== "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Get or create the ACBA organization
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

    // Migrate products
    const products = (await kv.get("aeroclub-products")) as Array<Record<string, unknown>> | null;
    if (products && products.length > 0) {
      const rows = products.map((p, i) => ({
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
      }));
      const { error } = await supabase.from("products").insert(rows);
      if (error) return NextResponse.json({ error: "Products: " + error.message }, { status: 500 });
    }

    // Migrate members
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
    }

    // Migrate settings
    const settings = await kv.get("aeroclub-settings");
    if (settings) {
      await supabase
        .from("organizations")
        .update({ settings: settings as import("@/lib/types/database").Json })
        .eq("id", orgId);
    }

    return NextResponse.json({
      success: true,
      migrated: {
        products: products?.length || 0,
        members: members?.length || 0,
        settings: settings ? true : false,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
