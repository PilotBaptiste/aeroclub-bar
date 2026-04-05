import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const lock = searchParams.get("lock");

  try {
    if (action === "check") {
      const cafe = await kv.get("aeroclub-lock-cafe");
      const frigo = await kv.get("aeroclub-lock-frigo");
      const both = await kv.get("aeroclub-lock-both");
      // Auto-reset after reading to prevent loops
      if (cafe === true) await kv.set("aeroclub-lock-cafe", false);
      if (frigo === true) await kv.set("aeroclub-lock-frigo", false);
      if (both === true) await kv.set("aeroclub-lock-both", false);
      return NextResponse.json({
        cafe: cafe === true,
        frigo: frigo === true,
        both: both === true,
      });
    }

    if (action === "done") {
      return NextResponse.json({ ok: true });
    }

    if (action === "trigger") {
      if (lock === "cafe") await kv.set("aeroclub-lock-cafe", true);
      else if (lock === "frigo") await kv.set("aeroclub-lock-frigo", true);
      else await kv.set("aeroclub-lock-both", true);
      return NextResponse.json({ ok: true, lock: lock || "both" });
    }

    return NextResponse.json({ error: "Action required" }, { status: 400 });
  } catch (e) {
    console.error("Fridge API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
