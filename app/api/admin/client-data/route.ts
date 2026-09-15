import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

    const supabase = createAdminClient();
    const { data: org } = await supabase.from("organizations").select("*").eq("slug", slug).single();
    if (!org) return NextResponse.json({ error: "not found" }, { status: 404 });

    const [products, members, categories] = await Promise.all([
      supabase.from("products").select("*").eq("org_id", org.id).order("position"),
      supabase.from("members").select("*").eq("org_id", org.id).order("name"),
      supabase.from("categories").select("*").eq("org_id", org.id).order("position"),
    ]);

    return NextResponse.json({
      org,
      products: products.data || [],
      members: members.data || [],
      categories: categories.data || [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const body = await request.json();
    const supabase = createAdminClient();

    switch (action) {
      case "update-product": {
        const { error } = await supabase.from("products").update(body.updates).eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "delete-product": {
        const { error } = await supabase.from("products").delete().eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "add-product": {
        const { data, error } = await supabase.from("products").insert(body).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ product: data });
      }
      case "update-member": {
        const { error } = await supabase.from("members").update(body.updates).eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "add-member": {
        const { data, error } = await supabase.from("members").insert(body).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ member: data });
      }
      case "update-category": {
        const { error } = await supabase.from("categories").update(body.updates).eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "delete-category": {
        const { error } = await supabase.from("categories").delete().eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "add-category": {
        const { data, error } = await supabase.from("categories").insert(body).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ category: data });
      }
      case "save-settings": {
        const { error } = await supabase.from("organizations").update({ settings: body.settings }).eq("id", body.org_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      case "update-org": {
        const { error } = await supabase.from("organizations").update(body.updates).eq("id", body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action: " + action }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
