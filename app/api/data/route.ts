import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await kv.get("aeroclub-products");
    const transactions = await kv.get("aeroclub-transactions");
    const settings = await kv.get("aeroclub-settings");
    const suggestions = await kv.get("aeroclub-suggestions");
    const members = await kv.get("aeroclub-members");
    const procurements = await kv.get("aeroclub-procurements");
    return NextResponse.json({
      products: products || null,
      transactions: transactions || null,
      settings: settings || null,
      suggestions: suggestions || null,
      members: members || null,
      procurements: procurements || null,
    });
  } catch (e) {
    console.error("KV read error:", e);
    return NextResponse.json({ error: "DB read error" }, { status: 500 });
  }
}

const ALLOWED_KEYS = [
  "aeroclub-products",
  "aeroclub-transactions",
  "aeroclub-settings",
  "aeroclub-suggestions",
  "aeroclub-members",
  "aeroclub-procurements",
];

export async function POST(request: Request) {
  try {
    const { key, value } = await request.json();
    if (!key)
      return NextResponse.json({ error: "Key required" }, { status: 400 });
    if (!ALLOWED_KEYS.includes(key))
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    await kv.set(key, value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("KV write error:", e);
    return NextResponse.json({ error: "DB write error" }, { status: 500 });
  }
}
