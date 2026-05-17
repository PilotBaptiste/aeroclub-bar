import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

interface Locks {
  cafe: boolean;
  frigo: boolean;
  congelateur: boolean;
  both: boolean;
}

const EMPTY: Locks = { cafe: false, frigo: false, congelateur: false, both: false };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const lock = searchParams.get("lock");

  try {
    if (action === "check") {
      // 1 seul kv.get au lieu de 3
      const locks = ((await kv.get("aeroclub-locks")) as Locks | null) || EMPTY;
      const result = { cafe: locks.cafe === true, frigo: locks.frigo === true, congelateur: locks.congelateur === true, both: locks.both === true };
      // Reset seulement si un verrou était actif (1 kv.set au lieu de 3)
      if (result.cafe || result.frigo || result.congelateur || result.both) {
        await kv.set("aeroclub-locks", EMPTY);
      }
      return NextResponse.json(result);
    }

    if (action === "done") {
      return NextResponse.json({ ok: true });
    }

    if (action === "trigger") {
      // Read-modify-write pour ne pas écraser un trigger concurrent
      const current = ((await kv.get("aeroclub-locks")) as Locks | null) || { ...EMPTY };
      if (lock === "cafe") current.cafe = true;
      else if (lock === "frigo") current.frigo = true;
      else if (lock === "congelateur") current.congelateur = true;
      else current.both = true;
      await kv.set("aeroclub-locks", current);
      return NextResponse.json({ ok: true, lock: lock || "both" });
    }

    return NextResponse.json({ error: "Action required" }, { status: 400 });
  } catch (e) {
    console.error("Fridge API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
