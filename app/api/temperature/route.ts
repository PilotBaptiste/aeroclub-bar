import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

interface TemperatureData {
  frigo: number | null;
  congelateur: number | null;
  lastUpdate: string;
}

const KV_KEY = "aeroclub-temperatures";

// GET - Lire les dernieres temperatures (appele par le frontend)
export async function GET() {
  try {
    const data = (await kv.get(KV_KEY)) as TemperatureData | null;

    if (!data) {
      return NextResponse.json({
        frigo: null,
        congelateur: null,
        lastUpdate: null,
      });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Temperature GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Recevoir les temperatures de l'ESP32
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const data: TemperatureData = {
      frigo: typeof body.frigo === "number" ? body.frigo : null,
      congelateur: typeof body.congelateur === "number" ? body.congelateur : null,
      lastUpdate: new Date().toISOString(),
    };

    await kv.set(KV_KEY, data);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Temperature POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
