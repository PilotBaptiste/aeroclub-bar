import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

interface Locks {
  cafe: boolean;
  frigo: boolean;
  congelateur: boolean;
  both: boolean;
  leds?: string;  // plages LED WS2812B, ex: "0-2,5-7"
}

const EMPTY: Locks = { cafe: false, frigo: false, congelateur: false, both: false };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const lock = searchParams.get("lock");
  const leds = searchParams.get("leds");

  try {
    if (action === "check") {
      // Locks + état LED dans la même requête (pollé toutes les 2s)
      const [locks, settings] = await Promise.all([
        kv.get("aeroclub-locks") as Promise<Locks | null>,
        kv.get("aeroclub-settings") as Promise<Record<string, unknown> | null>,
      ]);
      const l = locks || EMPTY;
      const result = { cafe: l.cafe === true, frigo: l.frigo === true, congelateur: l.congelateur === true, both: l.both === true, led: false, leds: l.leds || "" };

      // Calculer l'état LED
      if (settings && settings.ledEnabled) {
        const force = settings.ledForceState as string | undefined;
        if (force === "on") {
          result.led = true;
        } else if (force === "off") {
          result.led = false;
        } else {
          // Mode auto : plage horaire
          const onTime = (settings.ledOnTime as string) || "08:00";
          const offTime = (settings.ledOffTime as string) || "20:00";
          const now = new Date();
          const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
          const cur = paris.getHours() * 60 + paris.getMinutes();
          const [onH, onM] = onTime.split(":").map(Number);
          const [offH, offM] = offTime.split(":").map(Number);
          const onMin = onH * 60 + onM;
          const offMin = offH * 60 + offM;
          result.led = onMin < offMin
            ? cur >= onMin && cur < offMin
            : cur >= onMin || cur < offMin;
        }
      }

      // Reset locks seulement si un verrou était actif
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
      // Supporte les locks séparés par virgule (ex: "cafe,frigo")
      const locks = lock ? lock.split(",") : [];
      for (const l of locks) {
        if (l === "cafe") current.cafe = true;
        else if (l === "frigo") current.frigo = true;
        else if (l === "congelateur") current.congelateur = true;
        else if (l === "both") current.both = true;
      }
      // Fallback si aucun lock reconnu
      if (!current.cafe && !current.frigo && !current.congelateur && !current.both) {
        current.both = true;
      }
      // Stocker les plages LED (fusionner si déjà existantes)
      if (leds) {
        current.leds = current.leds ? current.leds + "," + leds : leds;
      }
      await kv.set("aeroclub-locks", current);
      return NextResponse.json({ ok: true, lock: lock || "both" });
    }

    return NextResponse.json({ error: "Action required" }, { status: 400 });
  } catch (e) {
    console.error("Fridge API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
