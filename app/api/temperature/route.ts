import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

interface TemperatureData {
  frigo: number | null;
  congelateur: number | null;
  lastUpdate: string;
}

interface TempAlertState {
  frigoAlerted?: boolean;        // true = on est actuellement hors plage (alerte envoyée)
  congelateurAlerted?: boolean;
}

const KV_KEY = "aeroclub-temperatures";
const ALERT_STATE_KEY = "aeroclub-temp-alert-state";

// ── Seuils ──
const FRIGO_SEUIL = 10;          // °C — au-dessus = alerte
const CONGELATEUR_SEUIL = -10;   // °C — au-dessus = alerte

async function sendTelegram(message: string) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return; // pas configuré = silencieux
  await fetch(
    "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    },
  ).catch(() => {}); // on ne bloque pas l'ESP32 si Telegram fail
}

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

// POST - Recevoir les temperatures de l'ESP32 + vérifier les seuils
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const data: TemperatureData = {
      frigo: typeof body.frigo === "number" ? body.frigo : null,
      congelateur: typeof body.congelateur === "number" ? body.congelateur : null,
      lastUpdate: new Date().toISOString(),
    };

    await kv.set(KV_KEY, data);

    // ── Vérification des seuils + alertes Telegram ──
    // Une seule alerte quand la température SORT de la plage,
    // puis une seule notification quand elle REVIENT dans la plage.
    const alertState = ((await kv.get(ALERT_STATE_KEY)) as TempAlertState | null) || {};
    let stateChanged = false;

    // ── FRIGO (alerte si > 10°C) ──
    if (data.frigo !== null) {
      const frigoDanger = data.frigo > FRIGO_SEUIL;
      if (frigoDanger && !alertState.frigoAlerted) {
        await sendTelegram(
          "🌡️🔴 <b>ALERTE TEMPERATURE FRIGO</b>\n\n" +
          "Température trop haute : <b>" + data.frigo.toFixed(1) + "°C</b>\n" +
          "⚠️ Seuil : " + FRIGO_SEUIL + "°C\n\n" +
          "Vérifiez que la porte est bien fermée !"
        );
        alertState.frigoAlerted = true;
        stateChanged = true;
      } else if (!frigoDanger && alertState.frigoAlerted) {
        alertState.frigoAlerted = false;
        stateChanged = true;
      }
    }

    // ── CONGÉLATEUR (alerte si > -10°C) ──
    if (data.congelateur !== null) {
      const congelateurDanger = data.congelateur > CONGELATEUR_SEUIL;
      if (congelateurDanger && !alertState.congelateurAlerted) {
        await sendTelegram(
          "🌡️🔴 <b>ALERTE TEMPERATURE CONGELATEUR</b>\n\n" +
          "Température trop haute : <b>" + data.congelateur.toFixed(1) + "°C</b>\n" +
          "⚠️ Seuil : " + CONGELATEUR_SEUIL + "°C\n\n" +
          "Vérifiez que la porte est bien fermée !"
        );
        alertState.congelateurAlerted = true;
        stateChanged = true;
      } else if (!congelateurDanger && alertState.congelateurAlerted) {
        alertState.congelateurAlerted = false;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      await kv.set(ALERT_STATE_KEY, alertState);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Temperature POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
