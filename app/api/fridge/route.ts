import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const lock = searchParams.get("lock"); // "cafe", "frigo", or "both"

  try {
    if (action === "check") {
      const cafe = await kv.get("aeroclub-lock-cafe");
      const frigo = await kv.get("aeroclub-lock-frigo");
      const both = await kv.get("aeroclub-lock-both");
      return NextResponse.json({
        cafe: cafe === true,
        frigo: frigo === true,
        both: both === true,
      });
    }

    if (action === "done") {
      if (lock === "cafe") await kv.set("aeroclub-lock-cafe", false);
      if (lock === "frigo") await kv.set("aeroclub-lock-frigo", false);
      if (lock === "both") {
        await kv.set("aeroclub-lock-both", false);
        await kv.set("aeroclub-lock-cafe", false);
        await kv.set("aeroclub-lock-frigo", false);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "trigger") {
      if (lock === "cafe") await kv.set("aeroclub-lock-cafe", true);
      else if (lock === "frigo") await kv.set("aeroclub-lock-frigo", true);
      else await kv.set("aeroclub-lock-both", true); // default = both
      return NextResponse.json({ ok: true, lock: lock || "both" });
    }

    return NextResponse.json({ error: "Action required" }, { status: 400 });
  } catch (e) {
    console.error("Fridge API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
