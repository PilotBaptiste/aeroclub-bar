import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await kv.get("aeroclub-products");
    const transactions = await kv.get("aeroclub-transactions");
    const settings = await kv.get("aeroclub-settings");
    const suggestions = await kv.get("aeroclub-suggestions");
    return NextResponse.json({
      products: products || null,
      transactions: transactions || null,
      settings: settings || null,
      suggestions: suggestions || null,
    });
  } catch (e) {
    console.error("KV read error:", e);
    return NextResponse.json({ error: "DB read error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { key, value } = await request.json();
    if (!key)
      return NextResponse.json({ error: "Key required" }, { status: 400 });
    await kv.set(key, value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("KV write error:", e);
    return NextResponse.json({ error: "DB write error" }, { status: 500 });
  }
}
